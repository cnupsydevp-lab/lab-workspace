/**
 * PixelLab 서버 (server.js)
 *
 * Express + Socket.io 기반 실시간 멀티 출근 게임 서버.
 * Google Cloud Run에서 실행되며, public/ 폴더의 정적 파일(프론트엔드)도 함께 제공한다.
 *
 * 배포:
 *   Cloud Run → Dockerfile 빌드 → gcloud run deploy
 *   반드시 --min-instances=1 옵션 사용 (WebSocket은 인스턴스가 꺼지면 연결 끊김)
 *
 * 상태 관리:
 *   메모리 내 객체(users, desks)로만 관리하므로, 컨테이너 재시작 시 모든 세션이 초기화된다.
 *   영구 저장이 필요하면 Redis 등 외부 저장소로 확장 필요.
 *
 * 멀티 제한:
 *   출근(책상 점유) 최대 MAX_DESKS명. 관찰자(출근 안 한 접속자)는 제한 없음.
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app        = express();
const httpServer = http.createServer(app);

// Socket.io 서버 초기화.
// Cloud Run은 기본적으로 HTTP/1.1 WebSocket을 지원하므로 별도 설정 불필요.
const io = new Server(httpServer);

// Cloud Run이 주입하는 PORT 환경변수를 우선 사용한다 (로컬 개발 시 8080 폴백).
const PORT = process.env.PORT || 8080;

// public/ 폴더의 정적 파일(index.html, game.js 등)을 루트 경로에서 제공.
app.use(express.static(path.join(__dirname, 'public')));

// ─── 게임 상수 ────────────────────────────────────────────────────────────────

// 캐릭터 색상 풀. 먼저 들어온 순서대로 배정되며, 모두 사용되면 랜덤 재사용.
const COLORS = [
  '#E05252', // 빨강
  '#5271E0', // 파랑
  '#52C87A', // 초록
  '#A052E0', // 보라
  '#E09052', // 주황
  '#E052B8', // 분홍
  '#52D4E0', // 하늘
  '#C8D452', // 라임
];

// 최대 출근 가능 인원 = 연구실 책상 수.
// 늘리려면 이 값과 game.js 의 DESKS 배열 크기를 함께 수정.
const MAX_DESKS = 6;

// ─── 서버 상태 ─────────────────────────────────────────────────────────────────

/**
 * 현재 출근 중인 사용자 정보.
 * key: socket.id (접속마다 고유 생성)
 * value: {
 *   name:        string   닉네임 (최대 8자)
 *   color:       string   캐릭터 색상 hex (#RRGGBB)
 *   desk:        number   점유 중인 책상 인덱스 (0~MAX_DESKS-1)
 *   status:      string   'working' | 'away'
 *   checkInTime: number|null  현재 근무 시작 타임스탬프(ms). away 상태면 null.
 *   totalToday:  number   오늘 누적 근무 시간(초). away 전환 시 누적.
 *   message:     string|null  말풍선 메시지. 5초 후 자동 null.
 *   msgTimer:    Timeout|null  말풍선 자동 삭제 타이머 핸들.
 * }
 */
const users = {};

/**
 * 책상 점유 상태 배열. 인덱스 = 책상 번호.
 * 값이 null이면 빈 책상, socket.id이면 점유 중.
 */
const desks = new Array(MAX_DESKS).fill(null);

// ─── 헬퍼 함수 ────────────────────────────────────────────────────────────────

/**
 * 현재 사용 중이지 않은 색상을 반환한다.
 * 모든 색상이 사용 중이면 랜덤으로 하나를 선택한다.
 */
function assignColor() {
  const used = new Set(Object.values(users).map(u => u.color));
  return COLORS.find(c => !used.has(c)) ?? COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * 비어있는 첫 번째 책상 인덱스를 반환한다.
 * 모든 책상이 꽉 찼으면 -1 반환.
 */
function freeDesk() {
  return desks.indexOf(null);
}

/**
 * 현재 접속 중인 모든 사용자의 공개 정보를 배열로 반환한다.
 * 이 배열이 클라이언트에게 'state_sync' 이벤트로 전송되어
 * 화면의 캐릭터 상태가 갱신된다.
 */
function snapshot() {
  return Object.values(users).map(u => ({
    name:        u.name,
    color:       u.color,
    desk:        u.desk,
    status:      u.status,
    checkInTime: u.checkInTime, // 클라이언트에서 타이머 계산에 사용
    totalToday:  u.totalToday,
    message:     u.message,
  }));
}

// ─── Socket.io 이벤트 핸들러 ──────────────────────────────────────────────────

io.on('connection', (socket) => {
  // 새 접속자에게 현재 연구실 상태를 즉시 전송 (관찰자도 포함).
  // 이로써 출근 없이도 누가 있는지 볼 수 있다.
  socket.emit('state_sync', snapshot());

  /**
   * 출근 (check_in)
   * 빈 책상에 사용자를 배정하고, 캐릭터를 연구실에 등록한다.
   * 이미 출근한 소켓이거나 책상이 꽉 찼으면 무시하거나 에러 전송.
   *
   * Client → Server: { name: string }
   * Server → All:    state_sync(snapshot)
   */
  socket.on('check_in', ({ name }) => {
    // 동일 소켓이 이미 출근한 경우 무시 (중복 체크인 방지)
    if (users[socket.id]) return;

    const desk = freeDesk();
    if (desk === -1) {
      // 빈 책상 없음 → 해당 클라이언트에게만 에러 전송
      socket.emit('lab_error', '자리가 꽉 찼어요! (최대 6명)');
      return;
    }

    users[socket.id] = {
      name:        String(name).slice(0, 8), // 8자 초과 방어
      color:       assignColor(),
      desk,
      status:      'working',
      checkInTime: Date.now(),
      totalToday:  0,
      message:     null,
      msgTimer:    null,
    };
    desks[desk] = socket.id; // 책상 점유

    // 전체 브로드캐스트 → 모든 클라이언트 화면에 새 캐릭터가 나타남
    io.emit('state_sync', snapshot());
  });

  /**
   * 퇴근 (check_out)
   * 근무 시간을 totalToday에 누적하고, 사용자 및 책상 점유를 해제한다.
   *
   * Client → Server: (없음)
   * Server → All:    state_sync(snapshot)
   */
  socket.on('check_out', () => {
    const u = users[socket.id];
    if (!u) return;

    // working 상태였다면 지금까지 근무 시간을 누적
    if (u.status === 'working' && u.checkInTime) {
      u.totalToday += Math.floor((Date.now() - u.checkInTime) / 1000);
    }

    if (u.msgTimer) clearTimeout(u.msgTimer); // 말풍선 타이머 정리
    desks[u.desk] = null;    // 책상 해제
    delete users[socket.id]; // 사용자 삭제

    io.emit('state_sync', snapshot());
  });

  /**
   * 자리비움 전환 (set_away)
   * working → away. 타이머를 멈추고 지금까지 시간을 totalToday에 누적.
   * 캐릭터는 반투명 상태로 화면에 유지된다.
   *
   * Client → Server: (없음)
   * Server → All:    state_sync(snapshot)
   */
  socket.on('set_away', () => {
    const u = users[socket.id];
    if (!u || u.status === 'away') return; // 이미 away면 무시

    // 자리비움 전까지의 시간 누적
    if (u.checkInTime) u.totalToday += Math.floor((Date.now() - u.checkInTime) / 1000);
    u.checkInTime = null; // 타이머 정지
    u.status = 'away';

    io.emit('state_sync', snapshot());
  });

  /**
   * 자리 복귀 (set_back)
   * away → working. 타이머를 재시작한다.
   *
   * Client → Server: (없음)
   * Server → All:    state_sync(snapshot)
   */
  socket.on('set_back', () => {
    const u = users[socket.id];
    if (!u || u.status !== 'away') return; // away 상태가 아니면 무시

    u.status = 'working';
    u.checkInTime = Date.now(); // 타이머 재시작

    io.emit('state_sync', snapshot());
  });

  /**
   * 말풍선 메시지 전송 (send_message)
   * 캐릭터 위에 5초간 말풍선을 표시한다.
   * 20자 초과 잘림, 5초 후 자동 삭제.
   *
   * Client → Server: { message: string }
   * Server → All:    state_sync(snapshot)
   */
  socket.on('send_message', ({ message }) => {
    const u = users[socket.id];
    if (!u || !message) return;

    // 이전 말풍선 타이머가 남아있으면 초기화
    if (u.msgTimer) clearTimeout(u.msgTimer);

    u.message = String(message).slice(0, 20);
    io.emit('state_sync', snapshot());

    // 5초 후 말풍선 자동 삭제
    u.msgTimer = setTimeout(() => {
      if (users[socket.id]) {
        users[socket.id].message = null;
        io.emit('state_sync', snapshot());
      }
    }, 5000);
  });

  /**
   * 소켓 연결 끊김 (disconnect)
   * 브라우저 닫기, 네트워크 오류, Cloud Run 인스턴스 재시작 등 모든 경우에 발생.
   * 출근 중이었다면 자동 퇴근 처리한다.
   *
   * ⚠️ Cloud Run 주의:
   *   --min-instances=1 로 설정하지 않으면 트래픽 없을 때 인스턴스가 종료되어
   *   모든 WebSocket 연결이 끊기고 사용자 상태가 초기화된다.
   */
  socket.on('disconnect', () => {
    const u = users[socket.id];
    if (!u) return; // 관찰자(출근 안 한 접속)는 처리할 것 없음

    if (u.msgTimer) clearTimeout(u.msgTimer);
    desks[u.desk] = null;
    delete users[socket.id];

    io.emit('state_sync', snapshot());
  });
});

// ─── 서버 시작 ────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => console.log(`PixelLab server running on port ${PORT}`));

/**
 * PixelLab 프론트엔드 (game.js)
 *
 * Phaser 3 기반 픽셀 아트 실시간 멀티 출근 게임.
 * 서버(server.js)와 Socket.io로 실시간 통신하며,
 * 접속 즉시 연구실 화면을 보여준다 (관찰자 모드).
 * 출근하기 버튼 → 닉네임 입력 모달 → 캐릭터 등장.
 *
 * 씬 흐름:
 *   BootScene  →  LabScene
 *   (소켓 연결)    (연구실 표시, 상태 동기화)
 *
 * Socket 이벤트 (수신):
 *   state_sync  현재 접속자 전체 목록 배열 (모든 변경 시마다 수신)
 *   lab_error   서버 오류 메시지 (예: 자리가 꽉 찼음)
 *
 * Socket 이벤트 (발신):
 *   check_in    { name }   출근
 *   check_out              퇴근
 *   set_away               자리비움 전환
 *   set_back               자리 복귀
 *   send_message { message } 말풍선 (향후 기능)
 *
 * 반응형:
 *   Phaser Scale.FIT + autoCenter로 PC·태블릿·모바일 모두 대응.
 *   모바일은 가로 방향 권장 (세로는 화면이 작아짐).
 */
'use strict';

// ─── 상수 ────────────────────────────────────────────────────────────────────

/** 게임 캔버스 기준 해상도. Scale.FIT로 화면 크기에 맞게 자동 스케일됨. */
const W = 960, H = 640;

/** 벽 하단 y좌표 (바닥 시작점). */
const WALL_H = 168;

/** 하단 UI 바 높이. */
const UI_H = 64;

/**
 * 6개 책상의 중심 좌표 (cx = 가로 중심, y = 책상 상단).
 * 2행 × 3열 배치.
 * MAX_DESKS(server.js)와 배열 크기를 반드시 맞출 것.
 */
const DESKS = [
  { x: 160, y: 280 }, { x: 480, y: 280 }, { x: 800, y: 280 },
  { x: 160, y: 462 }, { x: 480, y: 462 }, { x: 800, y: 462 },
];

/** 책상 가로/세로 크기 (픽셀). */
const DW = 186, DH = 54;

/** 캐릭터 이동 속도 (px/초). */
const SPEED = 180;

/** 캐릭터 최대 depth ≈ (H - UI_H) + 14 ≈ 590. UI/모달은 그보다 위에 그린다. */
const Z_UI    = 600;
const Z_MODAL = 720;

/**
 * 전체 컬러 팔레트.
 * 연구실/UI/캐릭터에서 공통으로 사용.
 * 16진수 값은 Phaser Graphics API, 문자열은 Phaser Text API에서 사용.
 */
const C = {
  // 연구실 배경 — 따뜻한 아이보리 / 그레이 / 브라운 톤
  wallTop: 0xf2ede6, // 벽 상단 (따뜻한 아이보리 화이트)
  wallMid: 0xe8e1d8, // 벽 하단 (크림)
  wallBdr: 0xd0c8bc, // 걸레받이 (웜 그레이-브라운)
  floor:   0xcdc5bc, // 바닥 기본색 (웜 그레이)
  floorLn: 0xb8b0a4, // 바닥 타일 선

  rug:    0xeadccc, // 가운데 러그 (크림 베이지)
  rugBdr: 0xc09868, // 러그 테두리 (웜 브라운)

  // 책상 — 따뜻한 원목 브라운
  deskSurf: 0x9a7252, // 책상 상면
  deskHi:   0xba8e6a, // 하이라이트
  deskSha:  0x6c4a30, // 그림자
  deskLeg:  0x4e3220, // 다리

  // 모니터 — 따뜻한 차콜
  mon: 0x3c3630, // 모니터 프레임
  scr: 0x201c18, // 모니터 화면

  // 캐릭터
  skin:  0xffcc99, // 피부색
  blush: 0xff9988, // 볼터치
  eye:   0x2a1808, // 눈 (따뜻한 다크 브라운)
  chair: 0x72604e, // 의자 등받이 (웜 브라운-그레이)
  seat:  0x5a4838, // 의자 방석

  // UI 바
  barBg: 0x28221e, // 하단 바 배경 (따뜻한 다크 브라운)

  // 버튼 색상 (기본 / 호버)
  btnIn:    0x7a5c3a, btnInH:  0x9a7a52, // 출근하기 (웜 탄 브라운)
  btnOut:   0x8c3030, btnOutH: 0xb04040, // 퇴근하기 (웜 다크 레드)
  btnAway:  0x5c5040, btnAwayA: 0x7a6a52, // 자리비움 (웜 그레이-브라운)

  // 텍스트 색상 (Phaser Text에서 string으로 사용)
  tPri: '#f2ede6', // 기본 텍스트 (따뜻한 화이트)
  tMut: '#9a8a78', // 보조 텍스트 (웜 뮤트)
  tGrn: '#5c9060', // 접속 표시 (뮤트 그린)
  tYel: '#c09840', // 경고/강조 (웜 앰버)
};

const STATUS_META = {
  working:    { label: '작업중', short: '작업', alpha: 1,    faceAway: false },
  away:       { label: '자리비움', short: '비움', alpha: 0.42, faceAway: true },
  meeting:    { label: '회의중', short: '회의', alpha: 0.65, faceAway: true },
  experiment: { label: '실험중', short: '실험', alpha: 0.85, faceAway: false },
};

const STATUS_FLOW = ['working', 'away', 'meeting', 'experiment'];

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * Press Start 2P 폰트로 텍스트 오브젝트를 생성한다.
 * resolution:2 로 고DPI 화면에서도 선명하게 렌더링.
 * @param {Phaser.Scene} sc  현재 씬
 * @param {number} x, y      위치
 * @param {string} s         문자열
 * @param {number} sz        폰트 크기 (px)
 * @param {string} col       색상 문자열 (#RRGGBB)
 */
const $t = (sc, x, y, s, sz, col) =>
  sc.add.text(x, y, s, { fontFamily: '"Press Start 2P"', fontSize: sz, color: col, resolution: 2 });

/**
 * 색상 hex 문자열('#RRGGBB')을 Phaser Graphics가 사용하는 숫자로 변환.
 * 예: '#E05252' → 0xE05252
 */
const $hex = s => parseInt((s ?? '#888888').replace('#', ''), 16);

/**
 * 캐릭터 레지스트리 — 닉네임(한글) → 스프라이트 에셋 정의.
 * 이미지 경로: public/assets/characters/<key>/<expression>.png  (폴더·파일명 모두 영어)
 *
 *   key          에셋 폴더명 (영어 소문자)
 *   expressions  보유 표정 목록. 'normal'은 필수(기본/작업중 얼굴).
 *                선택: 'happy'(출근 환영), 'cry'(자리비움), 'angry'(회의·실험)
 *
 * 새 캐릭터 추가(최대 9명):
 *   1) public/assets/characters/<key>/ 폴더 생성
 *   2) normal.png (+ happy/cry/angry) 추가
 *   3) 아래에 한 줄 추가:  '닉네임': { key: '<key>', expressions: [...] }
 */
const CHARACTERS = {
  '이은빈': {
    key: 'eunbin',
    expressions: ['normal', 'happy', 'cry'],
    // anim: expression → { frameW, frameH, start, end, frameRate }
    // normal: front-facing walk cycle (4 frames), happy: 15-frame expression, cry: 8-frame
    anim: {
      // normal.png = 4x4 spritesheet (row0=down, row1=left, row2=right, row3=up)
      // start/end 0-3: idle (front row). 방향별 walk 애니는 _createAnims()에서 등록.
      normal: { frameW: 210, frameH: 285, start: 0, end: 3,  frameRate: 6 },
      happy:  { frameW: 215, frameH: 330, start: 0, end: 14, frameRate: 8 },
      cry:    { frameW: 315, frameH: 440, start: 0, end: 7,  frameRate: 5 },
    },
  },
  // '홍길동': { key: 'gildong', expressions: ['normal', 'happy', 'cry', 'angry'] },
};

/** 캐릭터 표정 이미지의 Phaser 텍스처 키. */
const charTexKey = (key, expr) => `char_${key}_${expr}`;

/**
 * 상태 → 표정 결정. 보유하지 않은 표정은 'normal'로 폴백.
 *   away               → cry
 *   meeting/experiment → angry
 *   그 외(working 등)   → normal
 */
const expressionForStatus = (reg, status) => {
  const want = status === 'away' ? 'cry'
    : (status === 'meeting' || status === 'experiment') ? 'angry'
    : 'normal';
  return reg.expressions.includes(want) ? want : 'normal';
};

/** 출근 직후 환영 표정 (happy 있으면 happy, 없으면 normal). */
const greetExpression = reg => (reg.expressions.includes('happy') ? 'happy' : 'normal');

/** 스프라이트 캐릭터의 화면상 목표 높이(px). 원본 해상도와 무관하게 일정한 크기로 보이도록 스케일. */
const SPRITE_TARGET_H = 88;

// ─── BootScene ───────────────────────────────────────────────────────────────

/**
 * 부팅 씬. Socket.io로 서버에 연결하는 동안 로딩 화면을 보여준다.
 * 연결 성공 시 LabScene으로 전환.
 */
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // 등록된 모든 캐릭터 이미지를 로드.
    // anim 스펙이 있으면 spritesheet, 없으면 정적 image 로드.
    Object.values(CHARACTERS).forEach(reg =>
      reg.expressions.forEach(expr => {
        const key = charTexKey(reg.key, expr);
        const url = `assets/characters/${reg.key}/${expr}.png`;
        const spec = reg.anim?.[expr];
        if (spec) {
          this.load.spritesheet(key, url, { frameWidth: spec.frameW, frameHeight: spec.frameH });
        } else {
          this.load.image(key, url);
        }
      })
    );
  }

  create() {
    const g = this.add.graphics();

    // 따뜻한 아이보리 배경
    g.fillStyle(C.wallTop); g.fillRect(0, 0, W, H);

    // 연구실 책상 실루엣 (로딩 중임을 시각적으로 표현)
    g.fillStyle(0xd4c8b4);
    DESKS.forEach(d => g.fillRect(d.x - DW / 2, d.y, DW, DH + 20));

    // 타이틀 + 로딩 점 애니메이션
    $t(this, W / 2, H / 2 - 24, 'PPAI Lab', 22, '#4a3a2a').setOrigin(0.5);
    const dot = $t(this, W / 2, H / 2 + 16, '· · ·', 10, '#9a8a78').setOrigin(0.5);
    this.tweens.add({ targets: dot, alpha: { from: 0.3, to: 1 }, duration: 520, yoyo: true, repeat: -1 });

    // 소켓 연결 시도
    const socket = io();
    socket.once('connect',       () => this.scene.start('Lab', { socket }));
    socket.once('connect_error', () => {
      dot.destroy();
      $t(this, W / 2, H / 2 + 16, '연결 실패 · 새로고침', 8, '#cc4444').setOrigin(0.5);
    });
  }
}

// ─── LabScene ─────────────────────────────────────────────────────────────────

/**
 * 메인 연구실 씬.
 * 접속 즉시 연구실 화면을 보여주며(관찰자 모드),
 * 출근하기 버튼을 눌러 닉네임을 입력하면 캐릭터가 등장한다.
 *
 * 내부 상태:
 *   myName  현재 접속자 닉네임. null이면 관찰자 모드.
 *   myStatus  현재 접속자의 상태.
 *   users   서버에서 받은 현재 접속자 배열.
 *   chars   이름 → 캐릭터 오브젝트 맵.
 */
class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  /** 씬 초기화. scene.start() 시 전달받은 인자로 상태를 설정한다. */
  init({ socket }) {
    this.socket = socket;
    this.myName = null;   // null = 관찰자 모드 (출근 전)
    this.myStatus = 'working';
    this.users  = [];
    this.chars  = {};     // 이름 → { container, g, timerTxt, msgG, msgTxt, tween, ... }
    this._modal = null;   // 출근 모달 오브젝트. null이면 닫힌 상태.
    this._pendingCheckinOk = null;
    this._keys = null;    // 키보드 입력 오브젝트
    this._wasMoving = false;
    this._lastMoveEmit = 0;
  }

  create() {
    this._createAnims(); // 애니메이션 등록 (spritesheet 캐릭터 전용)
    this._setupKeys();   // 키보드 입력 설정
    this._drawRoom();  // 연구실 배경 (벽, 바닥, 창문, 책장, 러그 등)
    this._drawDesks(); // 6개 책상 + 모니터/키보드/커피잔
    this._deskRects = DESKS.map(d => ({
      l: d.x - DW / 2 - 8, r: d.x + DW / 2 + 8,
      t: d.y - 8,           b: d.y + DH + 30,
    }));
    this._buildUI();   // 하단 UI 바 (출근/퇴근/자리비움 버튼, 접속자 수)

    // 서버 이벤트 수신 등록
    const onState = u => this._sync(u);    // 전체 상태 갱신
    const onErr   = m => this._labErr(m);  // 에러 메시지 (모달 안에 표시)
    const onMove  = ({ name, x, y }) => {  // 다른 사용자 실시간 이동 수신
      const c = this.chars[name];
      if (!c || name === this.myName) return;
      c.container.x = x;
      c.container.y = y;
      c.container.setDepth(Math.round(y) + 14);
    };
    this.socket.on('state_sync', onState);
    this.socket.on('lab_error',  onErr);
    this.socket.on('player_move', onMove);

    // 씬 종료 시 이벤트 리스너 정리 (메모리 누수 방지)
    this.events.once('shutdown', () => {
      this.socket.off('state_sync', onState);
      this.socket.off('lab_error',  onErr);
      this.socket.off('player_move', onMove);
      if (this._pendingCheckinOk) this.socket.off('check_in_ok', this._pendingCheckinOk);
    });

    // 1초마다 타이머 갱신 (캐릭터 위 업무 시간 표시)
    this.time.addEvent({ delay: 1000, loop: true, callback: this._tick, callbackScope: this });
  }

  // ─── 키보드 이동 ─────────────────────────────────────────────────────────────

  /** 발 좌표(x, y)가 책상 충돌 영역 안에 있는지 확인한다. */
  _collidesDesk(x, y) {
    return this._deskRects.some(r => x > r.l && x < r.r && y > r.t && y < r.b);
  }

  /** 방향키 / WASD 입력 오브젝트를 생성한다. */
  _setupKeys() {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this._keys = this.input.keyboard.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
    });
  }

  /**
   * 매 프레임 호출. 방향키/WASD로 내 캐릭터를 이동시키고
   * 방향에 맞는 walk 애니메이션을 재생한다.
   */
  update(time, delta) {
    if (!this.myName || this._modal) return;
    const c = this.chars[this.myName];
    if (!c) return;

    const k = this._keys;
    const spd = SPEED * delta / 1000;
    let dx = 0, dy = 0;
    if (k.left.isDown  || k.a.isDown) dx -= spd;
    if (k.right.isDown || k.d.isDown) dx += spd;
    if (k.up.isDown    || k.w.isDown) dy -= spd;
    if (k.down.isDown  || k.s.isDown) dy += spd;

    // 대각선 이동 정규화
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const moving = dx !== 0 || dy !== 0;

    if (moving && !this._wasMoving) {
      // 이동 시작: 떠다니는 idle tween 정지
      c.tween?.pause();
    } else if (!moving && this._wasMoving) {
      // 이동 정지: idle 상태로 복귀
      const cont = c.container;
      c.tween?.destroy();
      c.tween = this.tweens.add({
        targets: cont, y: cont.y - 3, yoyo: true, repeat: -1,
        duration: 1400 + Math.random() * 700, ease: 'Sine.easeInOut',
      });
      if (this.myStatus === 'working') {
        const reg = CHARACTERS[this.myName];
        if (reg) this._setSpriteExpr(c, reg.key, 'normal');
      }
    }
    this._wasMoving = moving;
    if (!moving) return;

    // 위치 업데이트 (충돌 처리 포함)
    const cont = c.container;
    const FOOT = 14;
    let nx = Phaser.Math.Clamp(cont.x + dx, 30, W - 30);
    let ny = Phaser.Math.Clamp(cont.y + dy, WALL_H + 20, H - UI_H - 20);
    // 현재 이미 충돌 영역 안(책상 위 스폰 등)이면 이동 허용 — 빠져나올 수 있어야 함
    if (!this._collidesDesk(cont.x, cont.y + FOOT) && this._collidesDesk(nx, ny + FOOT)) {
      if      (!this._collidesDesk(nx,     cont.y + FOOT)) ny = cont.y;
      else if (!this._collidesDesk(cont.x, ny + FOOT))     nx = cont.x;
      else    { nx = cont.x; ny = cont.y; }
    }
    cont.x = nx; cont.y = ny;
    // y 기반 depth: 앞에 있을수록(y 클수록) 높은 depth
    cont.setDepth(Math.round(cont.y) + 14);
    // 이동 위치를 서버로 전송 (20fps 쓰로틀)
    if (time - this._lastMoveEmit > 50) {
      this.socket.emit('move', { x: cont.x, y: cont.y });
      this._lastMoveEmit = time;
    }

    // 방향 walk 애니메이션 (working 상태일 때만)
    if (this.myStatus !== 'working') return;
    const reg = CHARACTERS[this.myName];
    if (!reg) return;

    const ax = Math.abs(dx), ay = Math.abs(dy);
    const dir = ax > ay
      ? (dx < 0 ? 'walk_left' : 'walk_right')
      : (dy < 0 ? 'walk_up'   : 'walk_down');
    const animKey = `${reg.key}_${dir}`;
    if (this.anims.exists(animKey) && c.sprite?.anims.currentAnim?.key !== animKey) {
      c.sprite.play(animKey);
      if (c.sprite.height) c.sprite.setScale(SPRITE_TARGET_H / c.sprite.height);
    }
  }

  // ─── 애니메이션 등록 ─────────────────────────────────────────────────────────

  /** CHARACTERS 레지스트리의 anim 스펙을 Phaser 애니메이션으로 등록한다. */
  _createAnims() {
    Object.values(CHARACTERS).forEach(reg => {
      if (!reg.anim) return;

      // 표정 애니메이션 (normal/happy/cry)
      Object.entries(reg.anim).forEach(([expr, spec]) => {
        const animKey = `${reg.key}_${expr}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: this.anims.generateFrameNumbers(charTexKey(reg.key, expr), { start: spec.start ?? 0, end: spec.end }),
            frameRate: spec.frameRate ?? 6,
            repeat: -1,
          });
        }
      });

      // 방향별 walk 애니메이션 (normal.png 4x4 기준)
      if (reg.anim.normal) {
        const normTex = charTexKey(reg.key, 'normal');
        [['walk_down',0,3],['walk_left',4,7],['walk_up',8,11],['walk_right',12,15]].forEach(([dir, s, e]) => {
          const key = `${reg.key}_${dir}`;
          if (!this.anims.exists(key)) {
            this.anims.create({ key, frames: this.anims.generateFrameNumbers(normTex, { start: s, end: e }), frameRate: 8, repeat: -1 });
          }
        });
      }
    });
  }

  // ─── 연구실 배경 그리기 ──────────────────────────────────────────────────────

  /** 연구실 전체 배경을 그린다 (벽, 바닥, 창문, 책장, 시계, 화분 등). */
  _drawRoom() {
    const g = this.add.graphics();

    // ── 벽 ──
    g.fillStyle(C.wallTop); g.fillRect(0, 0, W, WALL_H);          // 위쪽 벽
    g.fillStyle(C.wallMid); g.fillRect(0, WALL_H - 52, W, 52);    // 바닥 근처 밝은 띠
    g.fillStyle(C.wallBdr); g.fillRect(0, WALL_H - 6,  W, 6);     // 걸레받이
    g.fillStyle(0xb8b0a8);  g.fillRect(0, WALL_H, W, 3);           // 벽/바닥 경계 하이라이트

    // ── 바닥 + 타일 선 ──
    g.fillStyle(C.floor); g.fillRect(0, WALL_H, W, H - WALL_H - UI_H);
    g.lineStyle(1, C.floorLn, 1);
    for (let x = 0; x <= W; x += 80)             { g.beginPath(); g.moveTo(x, WALL_H);     g.lineTo(x, H - UI_H); g.strokePath(); }
    for (let y = WALL_H; y <= H - UI_H; y += 80) { g.beginPath(); g.moveTo(0, y);          g.lineTo(W, y);        g.strokePath(); }

    // ── 러그 (책상 사이 가운데) ──
    g.fillStyle(C.rug);    g.fillRect(54, 350, W - 108, 144);
    g.lineStyle(2, C.rugBdr, 1);   g.strokeRect(60, 356, W - 120, 132);  // 외곽 테두리
    g.lineStyle(1, C.rugBdr, 0.5); g.strokeRect(70, 366, W - 140, 112);  // 내곽 테두리
    // 러그 코너 장식 (작은 점)
    [[60,356],[W-60,356],[60,488],[W-60,488]].forEach(([rx, ry]) => {
      g.fillStyle(C.rugBdr); g.fillRect(rx - 3, ry - 3, 6, 6);
    });

    // ── 따뜻한 천장 조명 글로우 ──
    const glow = this.add.graphics();
    glow.fillStyle(0xffe8aa, 0.07); glow.fillEllipse(W / 2, 50, 680, 320);

    // ── 창문 (좌우) ──
    this._window(g, 36, 8);        // 왼쪽 창문 (x=36)
    this._window(g, W - 152, 8);   // 오른쪽 창문 (x=W-152)

    // ── 책장 ──
    this._shelf(g, 224, 4);

    // ── 벽시계 ──
    this._wallClock(g, 480, 16);

    // ── 화분 (좌우 코너) ──
    this._plant(g, 14,     WALL_H);
    this._plant(g, W - 14, WALL_H);

    // ── 사이드 비네트 (가장자리 어둡게) ──
    const vig = this.add.graphics();
    vig.fillStyle(0x000000, 0.12); vig.fillRect(0,     0, 44, H);
    vig.fillStyle(0x000000, 0.12); vig.fillRect(W - 44, 0, 44, H);
  }

  /**
   * 창문을 그린다. 야간 설정: 달, 별, 커튼 포함.
   * @param {Phaser.GameObjects.Graphics} g  그래픽스 오브젝트
   * @param {number} x  창문 좌상단 x
   * @param {number} y  창문 좌상단 y
   */
  _window(g, x, y) {
    const ww = 116, wh = 130;
    g.fillStyle(0x5a3a28); g.fillRect(x - 16, y, ww + 32, 6);    // 커튼 레일
    g.fillStyle(0x3e2c1a); g.fillRect(x, y + 4, ww, wh);          // 창틀
    g.fillStyle(0x08102e); g.fillRect(x + 5, y + 9, ww - 10, wh - 14); // 야간 하늘
    // 별들
    g.fillStyle(0xffffff, 1);
    [[16,10],[48,6],[86,16],[28,40],[70,28],[96,50],[10,58],[54,64],[80,44]].forEach(
      ([dx, dy]) => g.fillRect(x + dx, y + dy, 2, 2)
    );
    // 달 (초승달 느낌)
    g.fillStyle(0xfff8cc); g.fillCircle(x + 82, y + 22, 13); // 달 본체
    g.fillStyle(0x08102e); g.fillCircle(x + 87, y + 19, 10); // 달 그림자 (초승달)
    // 창틀 분리대
    g.fillStyle(0x3e2c1a);
    g.fillRect(x + 55, y + 9,  5, wh - 14); // 세로 분리대
    g.fillRect(x + 5,  y + 64, ww - 10, 5); // 가로 분리대
    // 커튼 (양쪽) — 웜 테라코타 브라운
    g.fillStyle(0x8a5038);
    g.fillRect(x - 14, y + 4, 16, wh);      // 왼쪽 커튼
    g.fillRect(x + ww - 2, y + 4, 16, wh);  // 오른쪽 커튼
    // 커튼 하이라이트 (입체감)
    g.fillStyle(0xa86848, 0.55);
    g.fillRect(x - 12, y + 4, 5, wh);
    g.fillRect(x + ww - 2, y + 4, 5, wh);
  }

  /**
   * 벽에 걸린 책장을 그린다. 책, 액자, 화분 소품 포함.
   * @param {Phaser.GameObjects.Graphics} g
   * @param {number} x  책장 좌상단 x
   * @param {number} y  책장 좌상단 y
   */
  _shelf(g, x, y) {
    const sw = 512, sh = 100;
    // 책장 본체 + 테두리
    g.fillStyle(0x5a4030); g.fillRect(x, y, sw, sh);
    g.fillStyle(0x3e2c1a); g.fillRect(x, y, sw, 5);
    g.fillStyle(0x3e2c1a); g.fillRect(x, y + sh - 5, sw, 5);
    // 선반 분리판
    g.fillStyle(0x3e2c1a);
    g.fillRect(x + 4,          y + sh / 2 - 3,  sw - 8, 5); // 수평 선반
    g.fillRect(x + sw / 3 - 2,     y + 4, 4, sh - 8);       // 세로 칸막이 1
    g.fillRect(x + sw * 2 / 3 - 2, y + 4, 4, sh - 8);       // 세로 칸막이 2

    // 책들 (색상 풀에서 순서대로 배정)
    const bc = [0xcc4444,0x4488cc,0x44aa66,0xcc8844,0x8844cc,0xcc4488,0x44cccc,0xaacc44,0xcc6644,0x4466cc,0x44cc88,0xdd8844,0x55aadd,0xcc4466,0xaa44cc];
    // 위쪽 칸 (2/3 지점까지)
    let bx = x + 8;
    for (let i = 0; i < 14 && bx < x + sw * 2 / 3 - 12; i++) {
      const bw = 13 + (i % 4) * 3, bh = 26 + (i % 5) * 5;
      const by = y + sh / 2 - bh - 6;
      g.fillStyle(bc[i]);          g.fillRect(bx, by, bw, bh);      // 책 본체
      g.fillStyle(0x000000, 0.2);  g.fillRect(bx, by, 2, bh);       // 왼쪽 그림자
      g.fillStyle(0xffffff, 0.08); g.fillRect(bx + bw - 2, by, 2, bh); // 오른쪽 하이라이트
      bx += bw + 2;
    }
    // 아래쪽 칸 (2/3 지점 이후)
    bx = x + sw * 2 / 3 + 8;
    for (let i = 0; i < 7 && bx < x + sw - 10; i++) {
      const bw = 14 + (i % 3) * 4, bh = 30 + (i % 3) * 6;
      const by = y + sh - bh - 8;
      g.fillStyle(bc[(i + 8) % bc.length]); g.fillRect(bx, by, bw, bh);
      g.fillStyle(0x000000, 0.2);            g.fillRect(bx, by, 2, bh);
      bx += bw + 2;
    }
    // 소품: 액자 + 작은 화분
    g.fillStyle(0x88aacc); g.fillRect(x + sw / 3 + 12, y + sh / 2 + 6, 24, 30);
    g.fillStyle(0x5588aa); g.fillRect(x + sw / 3 + 15, y + sh / 2 + 9, 18, 24);
    g.fillStyle(0x88cc88); g.fillCircle(x + sw * 2 / 3 - 28, y + 20, 9);
    g.fillStyle(0x2a5a28); g.fillRect(x + sw * 2 / 3 - 31, y + 14, 6, 10);
  }

  /**
   * 벽시계를 그린다. 시침/분침은 정적(10:10 위치 — 시계 광고 표준 포즈).
   */
  _wallClock(g, cx, y) {
    const r = 25;
    g.fillStyle(0x5a4838); g.fillCircle(cx, y + r, r + 5); // 외곽 프레임 (웜 다크 브라운)
    g.fillStyle(0xfaf6f0); g.fillCircle(cx, y + r, r);     // 시계 면 (따뜻한 화이트)
    g.fillStyle(0xf0ece4); g.fillCircle(cx, y + r, r - 2); // 내부 (크림)
    // 12개 시각 눈금
    g.fillStyle(0x4a3a2a);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillRect(cx + Math.cos(a) * (r - 4) - 1, y + r + Math.sin(a) * (r - 4) - 1, 2, 2);
    }
    // 시침 (10시 방향), 분침 (2시 방향)
    g.lineStyle(2, 0x3a2a1a, 1);
    g.beginPath(); g.moveTo(cx, y + r); g.lineTo(cx - 9, y + r - 13); g.strokePath();
    g.beginPath(); g.moveTo(cx, y + r); g.lineTo(cx + 12, y + r - 10); g.strokePath();
    g.fillStyle(0x4a3a2a); g.fillCircle(cx, y + r, 3); // 중심 핀
  }

  /**
   * 화분을 그린다. 흙, 화분, 잎사귀로 구성.
   * @param {Phaser.GameObjects.Graphics} g
   * @param {number} x  화분 중심 x
   * @param {number} y  화분이 놓이는 바닥 y (WALL_H)
   */
  _plant(g, x, y) {
    g.fillStyle(0x7a3e18); g.fillRect(x - 14, y - 30, 28, 26); // 화분 본체
    g.fillStyle(0x6a3210); g.fillRect(x - 16, y - 36, 32,  8); // 화분 테두리
    g.fillStyle(0x9a6030); g.fillRect(x - 13, y - 28, 26,  5); // 화분 상단 하이라이트
    g.fillStyle(0x2e1a08); g.fillRect(x - 11, y - 26, 22, 10); // 흙
    // 잎사귀 (중앙 + 좌우 + 위쪽)
    g.fillStyle(0x2a6a30); g.fillCircle(x,      y - 52, 19);
    g.fillStyle(0x3a8a40); g.fillCircle(x - 16, y - 40, 14);
    g.fillStyle(0x3a8a40); g.fillCircle(x + 16, y - 40, 14);
    g.fillStyle(0x4aaa50); g.fillCircle(x,      y - 62, 13);
    g.fillStyle(0x2a5a28); g.fillRect(x - 2,   y - 44,  4, 18); // 줄기
  }

  // ─── 책상 그리기 ─────────────────────────────────────────────────────────────

  /** 모든 책상을 그린다. */
  _drawDesks() {
    // 책상 행(row)별로 depth 설정: depth = desk.y + DH
    // 캐릭터 depth = container.y + 14 이므로, 캐릭터가 책상 앞(y 큰 쪽)이면 자동으로 앞에 렌더링
    const byY = new Map();
    DESKS.forEach(d => {
      if (!byY.has(d.y)) byY.set(d.y, this.add.graphics().setDepth(d.y + DH));
      this._desk(byY.get(d.y), d.x, d.y);
    });
  }

  /**
   * 책상 1개를 그린다. 모니터, 키보드, 마우스, 커피잔 포함.
   * @param {Phaser.GameObjects.Graphics} g
   * @param {number} cx  책상 중심 x
   * @param {number} cy  책상 상단 y
   */
  _desk(g, cx, cy) {
    // ── 책상 상판 ──
    g.fillStyle(C.deskSurf);     g.fillRect(cx - DW / 2, cy, DW, DH);
    g.fillStyle(C.deskHi);       g.fillRect(cx - DW / 2, cy, DW, 7);           // 상단 하이라이트
    g.fillStyle(C.deskSha);      g.fillRect(cx - DW / 2, cy + DH - 4, DW, 4); // 하단 그림자
    g.fillStyle(C.deskSha, 0.4);
    g.fillRect(cx - DW / 2, cy, 3, DH);      // 왼쪽 측면
    g.fillRect(cx + DW / 2 - 3, cy, 3, DH); // 오른쪽 측면

    // ── 다리 ──
    g.fillStyle(C.deskLeg);
    g.fillRect(cx - DW / 2 + 7,  cy + DH, 10, 22);
    g.fillRect(cx + DW / 2 - 17, cy + DH, 10, 22);

    // ── 모니터 ──
    g.fillStyle(C.mon);  g.fillRect(cx - 24, cy - 44, 48, 36); // 프레임
    g.fillStyle(C.scr);  g.fillRect(cx - 21, cy - 41, 42, 30); // 화면
    g.fillStyle(0x1a2888, 0.5); g.fillRect(cx - 18, cy - 38, 36,  8); // 상단 글로우
    g.fillStyle(0x0a1040, 0.4); g.fillRect(cx - 18, cy - 30, 36, 18); // 화면 내용 느낌
    g.fillStyle(C.mon);
    g.fillRect(cx - 5,  cy - 10, 10, 10); // 모니터 스탠드 기둥
    g.fillRect(cx - 14, cy - 2,  28,  4); // 스탠드 베이스

    // ── 키보드 ──
    g.fillStyle(0x3a3028); g.fillRect(cx - 36, cy + 9, 50, 14); // 외관 (따뜻한 차콜)
    g.fillStyle(0x4a4038); g.fillRect(cx - 34, cy + 11, 46, 10); // 키패드 영역
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 8; k++) { g.fillStyle(0x5c5048); g.fillRect(cx - 33 + k * 6, cy + 12 + r * 5, 5, 4); }

    // ── 마우스 ──
    g.fillStyle(0x382e28); g.fillRect(cx + 26, cy + 9, 13, 18);
    g.fillStyle(0x48403a); g.fillRect(cx + 28, cy + 11, 9, 7); // 클릭 영역

    // ── 커피잔 ☕ ──
    g.fillStyle(0xcc8855); g.fillRect(cx + 52, cy + 4, 17, 21);  // 잔 본체
    g.fillStyle(0xddaa77); g.fillRect(cx + 53, cy + 5, 15,  6);  // 잔 상단 하이라이트
    g.fillStyle(0x3a2010); g.fillRect(cx + 54, cy + 11, 13, 12); // 커피
    g.fillStyle(C.deskSurf); g.fillRect(cx + 51, cy + 23, 19, 3); // 받침
    g.fillStyle(0xcc8855); g.fillRect(cx + 68, cy + 7, 4, 10);    // 손잡이
    // 커피 김 (반투명 흰색)
    g.fillStyle(0xffffff, 0.14);
    g.fillRect(cx + 57, cy + 1, 2, 3);
    g.fillRect(cx + 61, cy - 1, 2, 4);
  }

  // ─── 캐릭터 ──────────────────────────────────────────────────────────────────

  /**
   * 새 캐릭터를 연구실에 추가한다.
   * Phaser Container를 사용해 여러 오브젝트를 하나로 묶어 함께 이동/애니메이션.
   * @param {Object} user  서버에서 받은 사용자 데이터
   */
  _addChar(user) {
    const pos = DESKS[user.desk];
    if (!pos) return; // 유효하지 않은 책상 번호면 무시

    const { x: cx, y: cy } = pos;
    const col = $hex(user.color);
    // 서버에 저장된 위치가 있으면 그 위치(이미 이동한 경우), 없으면 책상 위치
    const initX = (typeof user.x === 'number') ? user.x : cx;
    const initY = (typeof user.y === 'number') ? user.y : cy;

    // Container: 이 캐릭터의 모든 Phaser 오브젝트를 담는 그룹.
    // 위치는 책상 상단(cx, cy)이 기준점(0,0). 모든 자식은 이 기준으로 그려짐.
    // depth = y + foot_offset → 이동 시 y-sort 기반 자동 깊이 정렬
    const container = this.add.container(initX, initY).setDepth(initY + 14);

    // 캐릭터 몸체 — 레지스트리에 등록되고 이미지가 있으면 스프라이트, 아니면 도형으로 그린다.
    const reg = CHARACTERS[user.name];
    const hasSprite = !!reg && this.textures.exists(charTexKey(reg.key, 'normal'));
    const g = this.add.graphics();
    if (hasSprite) {
      this._drawShadow(g);                                   // 서 있는 스프라이트용 바닥 그림자
    } else {
      this._drawChar(g, col, STATUS_META[user.status]?.faceAway ?? false);
    }
    container.add(g);

    // 스프라이트 (등록 캐릭터 전용). origin 하단 중앙 → 발이 책상 앞쪽에 닿도록 배치.
    // Sprite 오브젝트를 사용해 정적/애니메이션 모두 지원.
    let sprite = null;
    if (hasSprite) {
      const initExpr = greetExpression(reg);
      sprite = this.add.sprite(0, 14, charTexKey(reg.key, initExpr)).setOrigin(0.5, 1);
      const initAnimKey = `${reg.key}_${initExpr}`;
      if (this.anims.exists(initAnimKey)) sprite.play(initAnimKey);
      if (sprite.height) sprite.setScale(SPRITE_TARGET_H / sprite.height);
      container.add(sprite);
      // 출근 직후 2.5초간 환영(happy) 애니메이션, 이후 상태별 표정으로 전환
      this.time.delayedCall(2500, () => {
        const c = this.chars[user.name];
        if (c?.sprite) this._setSpriteExpr(c, reg.key, expressionForStatus(reg, user.status));
      });
    }

    // ── 이름표 배경 (RoundedRect) ── 스프라이트는 키가 커서 더 위에 띄운다.
    const tagBase = hasSprite ? -150 : -92;
    const nw = user.name.length * 9 + 20; // 이름 길이에 따라 너비 동적 조정
    const tagG = this.add.graphics();
    tagG.fillStyle(0x000000, 0.68);
    tagG.fillRoundedRect(-nw / 2, tagBase, nw, 20, 3);  // 배경
    tagG.lineStyle(1, col, 0.5);
    tagG.strokeRoundedRect(-nw / 2, tagBase, nw, 20, 3); // 색상 테두리

    const nameTxt = this.add.text(0, tagBase + 10, user.name, {
      fontFamily: '"Press Start 2P"', fontSize: 7, color: user.color, resolution: 2,
    }).setOrigin(0.5, 1);
    container.add([tagG, nameTxt]);

    // ── 타이머 텍스트 (MM:SS 또는 HH:MM:SS) ──
    const timerTxt = this.add.text(0, tagBase + 24, '00:00', {
      fontFamily: '"Press Start 2P"', fontSize: 6, color: C.tMut, resolution: 2,
    }).setOrigin(0.5, 1);
    container.add(timerTxt);

    // ── 말풍선 (그래픽스 기반, 기본 비표시) ──
    // msgG: 말풍선 배경 + 꼬리 그림
    // msgTxt: 메시지 텍스트
    const msgG   = this.add.graphics();
    const msgTxt = this.add.text(0, -102, '', {
      fontFamily: '"Press Start 2P"', fontSize: 7, color: '#111111', resolution: 2,
    }).setOrigin(0.5, 1).setVisible(false);
    container.add([msgG, msgTxt]);

    // ── 떠다니는 idle 애니메이션 (내 캐릭터만) ──
    // 다른 사람 캐릭터는 player_move로 위치가 갱신되므로 tween을 걸면 위치가 충돌함
    const tween = user.name === this.myName
      ? this.tweens.add({
          targets: container, y: initY - 3,
          yoyo: true, repeat: -1,
          duration: 1400 + Math.random() * 700, ease: 'Sine.easeInOut',
        })
      : null;

    this.chars[user.name] = { container, g, tagG, nameTxt, timerTxt, msgG, msgTxt, tween, sprite, charKey: reg ? reg.key : null };

    // 초기 상태 적용
    this._applyStatus(user.name, user.status);
    if (user.message) this._showMsg(user.name, user.message);
  }

  /**
   * 캐릭터 픽셀 아트를 그린다.
   * Container의 로컬 좌표계 사용: (0, 0) = 책상 상단 중앙.
   * 캐릭터는 모두 음수 y 위치 (책상 위쪽)에 그려짐.
   *
   * @param {Phaser.GameObjects.Graphics} g
   * @param {number} col    캐릭터 색상 (셔츠/머리카락)
   * @param {boolean} away  자리비움 여부 (true면 눈 감음)
   */
  _drawChar(g, col, away) {
    g.clear();
    // 머리카락은 셔츠 색상보다 조금 더 어두운 계열
    const hair = Math.max(0, col - 0x2a2a2a);

    // ── 의자 ──
    g.fillStyle(C.chair, 1); g.fillRect(-20, -50, 40, 38); // 등받이
    g.fillStyle(0x8a7860, 1); g.fillRect(-18, -48, 36, 7);  // 등받이 상단 강조
    g.fillStyle(C.seat, 1);  g.fillRect(-17, -14, 34, 8);  // 방석

    // ── 몸 (셔츠) ──
    g.fillStyle(col, 1);     g.fillRect(-13, -30, 26, 16); // 상체
    g.fillStyle(C.skin, 1); g.fillRect(-4, -30, 8, 7);    // 칼라 (목 부분)

    // ── 머리 ──
    g.fillStyle(C.skin, 1); g.fillRect(-11, -56, 22, 26); // 얼굴
    // 헤어 (위 + 양 옆)
    g.fillStyle(hair, 1);
    g.fillRect(-11, -56, 22, 10); // 정수리
    g.fillRect(-14, -54,  5, 18); // 왼쪽 귀밑
    g.fillRect(  9, -54,  5, 14); // 오른쪽 귀밑

    if (away) {
      // 자리비움: 눈 감음 (가로선)
      g.fillStyle(C.eye, 1);
      g.fillRect(-7, -43, 5, 2);
      g.fillRect( 2, -43, 5, 2);
    } else {
      // 정상: 눈 + 하이라이트 + 볼터치 + 미소
      g.fillStyle(C.eye, 1);
      g.fillRect(-7, -46, 5, 5); // 왼눈
      g.fillRect( 2, -46, 5, 5); // 오른눈
      // 눈 하이라이트 (작은 흰 점)
      g.fillStyle(0xffffff, 1);
      g.fillRect(-6, -46, 2, 2);
      g.fillRect( 3, -46, 2, 2);
      // 볼터치 (반투명 분홍)
      g.fillStyle(C.blush, 0.75);
      g.fillRect(-10, -40, 5, 3); // 왼쪽 볼
      g.fillRect(  5, -40, 5, 3); // 오른쪽 볼
      // 입 (작은 미소)
      g.fillStyle(0xcc9977, 1);
      g.fillRect(-3, -34, 6, 2);
    }
  }

  /** 서 있는 스프라이트 캐릭터용: 발밑 바닥 그림자만 그린다. */
  _drawShadow(g) {
    g.clear();
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(0, 18, 58, 16);
  }

  /**
   * 스프라이트 캐릭터의 표정/애니메이션을 바꾸고 목표 높이에 맞춰 스케일을 재계산한다.
   * anim이 등록된 표정은 Phaser 애니메이션을 재생하고, 없으면 정적 텍스처로 전환.
   */
  _setSpriteExpr(c, key, expr) {
    if (!c?.sprite) return;
    const tex = charTexKey(key, expr);
    if (!this.textures.exists(tex)) return;
    const animKey = `${key}_${expr}`;
    if (this.anims.exists(animKey)) {
      c.sprite.play(animKey);
    } else {
      c.sprite.stop().setTexture(tex);
    }
    if (c.sprite.height) c.sprite.setScale(SPRITE_TARGET_H / c.sprite.height);
  }

  /**
   * 기존 캐릭터 상태를 업데이트한다.
   * 서버에서 state_sync를 받을 때마다 호출됨.
   */
  _updateChar(user) {
    const c = this.chars[user.name];
    if (!c) return;
    if (c.sprite && c.charKey) {
      this._setSpriteExpr(c, c.charKey, expressionForStatus(CHARACTERS[user.name], user.status));
    } else {
      this._drawChar(c.g, $hex(user.color), STATUS_META[user.status]?.faceAway ?? false);
    }
    this._applyStatus(user.name, user.status);                       // 투명도 적용
    user.message ? this._showMsg(user.name, user.message) : this._hideMsg(user.name);
  }

  /**
   * 캐릭터를 화면에서 제거한다 (퇴근 또는 연결 끊김).
   * Tween 먼저 중지 후 Container 파괴 (메모리 정리).
   */
  _removeChar(name) {
    const c = this.chars[name];
    if (!c) return;
    c.tween?.remove();      // 애니메이션 중지
    c.container?.destroy(); // 컨테이너 + 모든 자식 오브젝트 파괴
    delete this.chars[name];
  }

  /**
   * 상태에 따라 캐릭터 투명도를 조절한다.
   */
  _applyStatus(name, status) {
    const c = this.chars[name];
    if (c) c.container.setAlpha(STATUS_META[status]?.alpha ?? 1);
  }

  /**
   * 캐릭터 위에 말풍선을 표시한다.
   * 말풍선 너비는 텍스트 길이에 맞게 자동 조정.
   * 서버에서 5초 후 message=null 로 state_sync가 오면 자동 숨겨짐.
   */
  _showMsg(name, msg) {
    const c = this.chars[name];
    if (!c) return;
    c.msgTxt.setText(msg).setVisible(true);
    const tw = Math.min(188, c.msgTxt.width + 16); // 최대 너비 188px
    c.msgG.clear();
    c.msgG.fillStyle(0xffffff, 0.94);
    c.msgG.fillRoundedRect(-tw / 2, -122, tw, 22, 3); // 말풍선 배경
    c.msgG.fillTriangle(-6, -100, 6, -100, 0, -93);   // 꼬리 (아래 방향 삼각형)
  }

  /** 말풍선을 숨긴다. */
  _hideMsg(name) {
    const c = this.chars[name];
    if (!c) return;
    c.msgTxt.setVisible(false);
    c.msgG.clear();
  }

  // ─── 상태 동기화 ──────────────────────────────────────────────────────────────

  /**
   * 서버에서 받은 전체 상태로 연구실을 갱신한다.
   * - 더 이상 없는 캐릭터 제거
   * - 새로 생긴 캐릭터 추가
   * - 기존 캐릭터 상태 업데이트 (자리비움, 말풍선 등)
   *
   * @param {Array} users  서버 state_sync 데이터
   */
  _sync(users) {
    this.users = users;
    if (this.countTxt) this.countTxt.setText(`${users.length}명`);

    const live = new Set(users.map(u => u.name));
    // 서버에 없는 캐릭터 제거 (퇴근/연결 끊김)
    Object.keys(this.chars).forEach(n => { if (!live.has(n)) this._removeChar(n); });
    // 신규 추가 또는 상태 업데이트
    users.forEach(u => this.chars[u.name] ? this._updateChar(u) : this._addChar(u));

    // 내 상태가 서버와 다르면 동기화
    const me = this.myName && users.find(u => u.name === this.myName);
    if (me) {
      if (this.myStatus !== me.status) {
        this.myStatus = me.status;
        this._refreshStatusBtn();
      }
    }
  }

  /**
   * 1초마다 호출되어 각 캐릭터 위의 타이머를 갱신한다.
   * 클라이언트에서 직접 계산 (서버 부하 감소):
   *   표시 시간 = totalToday + (현재시각 - checkInTime)
   * away 상태에서는 checkInTime이 null이므로 totalToday만 표시.
   */
  _tick() {
    const now = Date.now();
    this.users.forEach(u => {
      const c = this.chars[u.name];
      if (!c) return;
      let s = u.totalToday ?? 0;
      if (u.status === 'working' && u.checkInTime) s += Math.floor((now - u.checkInTime) / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      const p = n => String(n).padStart(2, '0');
      const elapsed = h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
      c.timerTxt.setText(`${STATUS_META[u.status]?.label ?? u.status} ${elapsed}`);
    });
  }

  // ─── UI 바 ────────────────────────────────────────────────────────────────────

  /** 하단 UI 바를 만든다. 접속자 수 표시 + 출근/자리비움/퇴근 버튼. */
  _buildUI() {
    const by = H - UI_H; // 바 상단 y 좌표

    // ── 바 배경 ──
    const bar = this.add.graphics().setDepth(Z_UI);
    bar.fillStyle(C.barBg, 0.97);  bar.fillRect(0, by, W, UI_H);
    // 상단 경계선 (얇은 선)
    bar.lineStyle(1, 0x5a4838, 1);  bar.beginPath(); bar.moveTo(0, by);     bar.lineTo(W, by);     bar.strokePath();
    bar.lineStyle(1, 0x9a8070, 0.3); bar.beginPath(); bar.moveTo(0, by + 1); bar.lineTo(W, by + 1); bar.strokePath();

    // ── 접속자 표시 (왼쪽) ──
    // 맥박처럼 깜박이는 초록 점
    const dot = this.add.circle(20, by + 22, 5, 0x5c9060).setDepth(Z_UI + 1);
    this.tweens.add({ targets: dot, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    this.countTxt = $t(this, 33, by + 22, '0명', 9, C.tGrn).setOrigin(0, 0.5).setDepth(Z_UI + 1);
    $t(this, 33, by + 38, '접속 중', 6, C.tMut).setOrigin(0, 0.5).setDepth(Z_UI + 1);

    // 버전 표시 (오른쪽 하단)
    $t(this, W - 10, by + 8, 'v1.0', 6, '#7a6858').setOrigin(1, 0).setDepth(Z_UI + 1);

    // ── 출근하기 버튼 (관찰자 모드에서 표시) ──
    const [ciB, ciL] = this._makeBtn(W / 2, by + 32, 210, 42, C.btnIn, C.btnInH, '출근하기', 11);
    ciB.on('pointerdown', () => this._openModal());
    this._ciG = [ciB, ciL]; // 관찰자 모드 버튼 그룹

    // ── 상태 변경 버튼 (근무 중 모드에서 표시) ──
    const [stB, stL] = this._makeBtn(W / 2 - 108, by + 32, 182, 42, C.btnAway, C.btnAwayA, '상태:작업', 9);
    stB.on('pointerdown', () => {
      this.myStatus = this._nextStatus(this.myStatus);
      this.socket.emit('set_status', { status: this.myStatus });
      this._refreshStatusBtn();
    });
    this.stB = stB; this.stL = stL;

    // ── 퇴근하기 버튼 ──
    const [outB, outL] = this._makeBtn(W - 112, by + 32, 186, 42, C.btnOut, C.btnOutH, '퇴근하기', 10);
    outB.on('pointerdown', () => this._checkout());
    this._wkG = [stB, stL, outB, outL]; // 근무 중 버튼 그룹

    this._setMode('observer'); // 초기: 관찰자 모드
  }

  /**
   * 픽셀 아트 스타일 버튼을 만든다.
   * @returns {[Rectangle, Text]}  버튼 배경 + 레이블
   */
  _makeBtn(x, y, w, h, fill, hover, label, fontSize) {
    const btn = this.add.rectangle(x, y, w, h, fill).setDepth(Z_UI + 1).setInteractive({ useHandCursor: true });
    // 픽셀 테두리 (흰색 반투명 선)
    const bd  = this.add.graphics().setDepth(Z_UI + 1);
    bd.lineStyle(1, 0xffffff, 0.1); bd.strokeRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
    const lbl = $t(this, x, y, label, fontSize, C.tPri).setOrigin(0.5).setDepth(Z_UI + 2);
    btn.on('pointerover',  () => btn.setFillStyle(hover));     // 호버: 밝아짐
    btn.on('pointerout',   () => btn.setFillStyle(fill));      // 호버 해제
    btn.on('pointerdown',  () => btn.setScale(0.96));          // 클릭: 약간 축소
    btn.on('pointerup',    () => btn.setScale(1));             // 클릭 해제: 원래 크기
    return [btn, lbl];
  }

  _nextStatus(status) {
    const idx = STATUS_FLOW.indexOf(status);
    return STATUS_FLOW[(idx + 1) % STATUS_FLOW.length] ?? 'working';
  }

  /** 상태 버튼 텍스트/색상을 현재 상태에 맞게 갱신한다. */
  _refreshStatusBtn() {
    const working = this.myStatus === 'working';
    this.stB?.setFillStyle(working ? C.btnAway : C.btnAwayA);
    this.stL?.setText(`상태:${STATUS_META[this.myStatus]?.short ?? this.myStatus}`);
  }

  /**
   * UI 모드를 전환한다.
   * @param {string} m  'observer' (관찰자) | 'worker' (근무 중)
   */
  _setMode(m) {
    const w = m === 'worker';
    this._ciG?.forEach(o => o.setVisible(!w)); // 출근하기: 관찰자일 때만 보임
    this._wkG?.forEach(o => o.setVisible(w));  // 자리비움/퇴근: 근무 중일 때만 보임
  }

  // ─── 출근 모달 ──────────────────────────────────────────────────────────────

  /**
   * 출근하기 모달을 연다.
   * Phaser 오브젝트(배경, 패널, 텍스트) + DOM input(닉네임 입력) 조합.
   * 모든 생성 오브젝트는 this._modal._objs 배열에 추적되어 닫을 때 일괄 파괴됨.
   */
  _openModal() {
    if (this._modal) return; // 이미 열려있으면 무시

    const objs = [];
    // 헬퍼: 오브젝트를 추적 배열에 추가하고 반환
    const keep = o => { objs.push(o); return o; };

    // ── 어두운 오버레이 (클릭 차단 + 페이드 인) ──
    const ov = keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setAlpha(0).setDepth(Z_MODAL).setInteractive());
    this.tweens.add({ targets: ov, alpha: 0.76, duration: 200 });

    // ── 패널 (스케일+페이드 인 애니메이션) ──
    const pw = 440, ph = 280, px = W / 2, py = H / 2;
    const panel = keep(this.add.rectangle(px, py, pw, ph, 0x2a2218).setAlpha(0).setScale(0.88).setDepth(Z_MODAL + 1));
    this.tweens.add({ targets: panel, alpha: 1, scaleX: 1, scaleY: 1, duration: 240, ease: 'Back.easeOut' });

    // ── 패널 테두리 ──
    const pbdr = keep(this.add.graphics().setDepth(Z_MODAL + 1).setAlpha(0));
    pbdr.lineStyle(2, 0x9a7a50, 1);    pbdr.strokeRect(px - pw / 2, py - ph / 2, pw, ph);        // 외곽 (웜 골드-브라운)
    pbdr.lineStyle(1, 0xc0a070, 0.22); pbdr.strokeRect(px - pw / 2 + 3, py - ph / 2 + 3, pw - 6, ph - 6); // 내곽
    this.tweens.add({ targets: pbdr, alpha: 1, duration: 240 });

    // ── 코너 별 장식 ──
    [[px - pw / 2 + 12, py - ph / 2 + 12, '✦', '#c09860'],
     [px + pw / 2 - 12, py - ph / 2 + 12, '✦', '#c09860'],
     [px - pw / 2 + 12, py + ph / 2 - 12, '✧', '#9a7840'],
     [px + pw / 2 - 12, py + ph / 2 - 12, '✧', '#9a7840']].forEach(([cx, cy, s, col]) => {
      const st = keep($t(this, cx, cy, s, 10, col).setOrigin(0.5).setDepth(Z_MODAL + 2).setAlpha(0));
      this.tweens.add({ targets: st, alpha: 1, duration: 300, delay: 80 });
    });

    // ── 타이틀 ──
    const title = keep($t(this, px, py - 102, '오늘도 출근! ✨', 13, '#f0e8d8').setOrigin(0.5).setDepth(Z_MODAL + 2).setAlpha(0));
    this.tweens.add({ targets: title, alpha: 1, duration: 240, delay: 60 });

    const sub = keep($t(this, px, py - 76, '닉네임을 입력하세요', 7, C.tMut).setOrigin(0.5).setDepth(Z_MODAL + 2).setAlpha(0));
    this.tweens.add({ targets: sub, alpha: 1, duration: 240, delay: 100 });

    // ── 닉네임 입력 필드 (DOM) ──
    // font-size:16px → iOS에서 자동 줌 방지
    // transform:scale(0.78) → 시각적 크기를 12px 수준으로 보정
    const domEl = keep(this.add.dom(px, py - 24).createFromHTML(`
      <input id="ci" type="text" autocomplete="off" maxlength="8" placeholder="최대 8자"
        style="font-family:'Press Start 2P',monospace;font-size:16px;
               background:transparent;color:#e8d8c0;
               border:none;border-bottom:2px solid #9a7a50;
               padding:8px 12px;width:280px;text-align:center;
               outline:none;letter-spacing:3px;display:block;
               transform:scale(0.78);transform-origin:center;">
    `).setDepth(Z_MODAL + 2));
    // Enter: 출근 시도 / Escape: 모달 닫기
    domEl.addListener('keydown').on('keydown', e => {
      if (e.key === 'Enter')  this._submitCheckin();
      if (e.key === 'Escape') this._closeModal();
      if (this._modal?.errTxt) this._modal.errTxt.setText(''); // 오류 메시지 지우기
    });

    // ── 오류 메시지 텍스트 ──
    const errTxt = keep($t(this, px, py + 24, '', 7, '#ff7777').setOrigin(0.5).setDepth(Z_MODAL + 2));

    // ── 버튼 ──
    const btnY = py + 88;
    const [okB, okL, okBd] = this._modalBtn(px - 68, btnY, 124, 40, 0x7a5c3a, 0x9a7a52, '출근!', 9);
    const [cnB, cnL, cnBd] = this._modalBtn(px + 68, btnY, 124, 40, 0x2a2218, 0x3a3028, '취소', 9);
    // 버튼도 추적 배열에 추가 + 페이드 인
    [okB, okL, okBd, cnB, cnL, cnBd].forEach(o => {
      keep(o); o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 200, delay: 140 });
    });
    okB.on('pointerdown', () => this._submitCheckin());
    cnB.on('pointerdown', () => this._closeModal());

    // errTxt는 _submitCheckin()에서 직접 접근하므로 this._modal에 별도 저장
    this._modal = { errTxt, _objs: objs };
    // 약간의 딜레이 후 포커스 (DOM 렌더링 완료 대기)
    setTimeout(() => document.getElementById('ci')?.focus(), 80);
  }

  /**
   * 모달 전용 버튼을 만든다 (크기가 작고 딜레이 페이드 인).
   * @returns {[Rectangle, Text, Graphics]}  배경, 레이블, 테두리
   */
  _modalBtn(x, y, w, h, fill, hover, label, fontSize) {
    const btn = this.add.rectangle(x, y, w, h, fill).setDepth(Z_MODAL + 2).setInteractive({ useHandCursor: true });
    const bd  = this.add.graphics().setDepth(Z_MODAL + 2);
    bd.lineStyle(1, 0xb09070, 0.25); bd.strokeRect(x - w / 2, y - h / 2, w, h);
    const lbl = $t(this, x, y, label, fontSize, C.tPri).setOrigin(0.5).setDepth(Z_MODAL + 3);
    btn.on('pointerover',  () => btn.setFillStyle(hover));
    btn.on('pointerout',   () => btn.setFillStyle(fill));
    btn.on('pointerdown',  () => btn.setScale(0.95));
    btn.on('pointerup',    () => btn.setScale(1));
    return [btn, lbl, bd];
  }

  /**
   * 모달을 닫는다. 추적 배열의 모든 오브젝트를 파괴하고 트윈을 중지.
   */
  _closeModal() {
    if (!this._modal) return;
    this._modal._objs.forEach(o => { this.tweens.killTweensOf(o); o?.destroy?.(); });
    this._modal = null;
  }

  /**
   * 닉네임을 서버에 전송하고 출근을 시도한다.
   * 서버에서 check_in_ok를 받으면 근무 모드로 전환.
   */
  _submitCheckin() {
    const el   = document.getElementById('ci');
    const name = (el?.value ?? '').trim();
    if (!name) {
      if (this._modal?.errTxt) this._modal.errTxt.setText('닉네임을 입력해주세요');
      return;
    }
    if (this._pendingCheckinOk) this.socket.off('check_in_ok', this._pendingCheckinOk);

    const onOk = ({ name: acceptedName }) => {
      this._pendingCheckinOk = null;
      this.myName = acceptedName; this.myStatus = 'working';
      this._closeModal();
      this._setMode('worker');
      this._refreshStatusBtn();
      this._toast(`${acceptedName}님, 오늘도 화이팅! ✨`);
    };
    this._pendingCheckinOk = onOk;
    this.socket.once('check_in_ok', onOk);
    this.socket.emit('check_in', { name });
  }

  /** 퇴근 처리. 캐릭터를 제거하고 관찰자 모드로 돌아간다. */
  _checkout() {
    this.socket.emit('check_out');
    this.myName = null; this.myStatus = 'working';
    this._refreshStatusBtn();
    this._setMode('observer');
  }

  /** 서버 에러 메시지를 모달 안에 표시한다 (예: 자리 꽉 참). */
  _labErr(msg) {
    if (this._pendingCheckinOk) {
      this.socket.off('check_in_ok', this._pendingCheckinOk);
      this._pendingCheckinOk = null;
    }
    if (this._modal?.errTxt) this._modal.errTxt.setText(msg);
  }

  /**
   * 화면 중앙에 잠깐 나타났다 사라지는 알림 메시지.
   * 출근 성공 시 환영 메시지로 사용.
   */
  _toast(msg) {
    const t = $t(this, W / 2, H / 2 - 32, msg, 9, '#ffffff')
      .setOrigin(0.5).setDepth(Z_MODAL + 10)
      .setBackgroundColor('#2a221866').setPadding(10, 6);
    this.tweens.add({
      targets: t, y: H / 2 - 74,
      alpha: { from: 1, to: 0 },
      duration: 2400, ease: 'Cubic.easeIn',
      onComplete: () => t.destroy(), // 애니메이션 완료 후 메모리 해제
    });
  }
}

// ─── Phaser 게임 초기화 ──────────────────────────────────────────────────────

new Phaser.Game({
  type: Phaser.AUTO,        // WebGL 우선, 미지원 시 Canvas로 폴백
  width: W, height: H,
  backgroundColor: '#f2ede6',
  parent: 'game-container', // index.html의 #game-container 에 캔버스 삽입
  dom: { createContainer: true }, // DOM 오브젝트(input 등) 사용 허용
  scene: [BootScene, LabScene],
  scale: {
    mode: Phaser.Scale.FIT,              // 화면 크기에 맞게 비율 유지하며 스케일
    autoCenter: Phaser.Scale.CENTER_BOTH, // 가로/세로 모두 중앙 정렬
    width: W, height: H,
    min: { width: 320, height: 213 },    // 최소 크기 (매우 작은 화면 방어)
  },
  render: {
    pixelArt: true,    // 픽셀 아트 렌더링 (anti-aliasing 끔)
    antialias: false,
  },
});

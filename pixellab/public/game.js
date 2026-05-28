/* PixelLab v1.0
 * Phaser 3 + Socket.io | 반응형 PC + 모바일
 * Boot → Lab (관찰자 모드 기본, 모달로 출근 참여)
 */
'use strict';

const W = 960, H = 640;
const WALL_H = 168, UI_H = 64;

const DESKS = [
  { x: 160, y: 280 }, { x: 480, y: 280 }, { x: 800, y: 280 },
  { x: 160, y: 462 }, { x: 480, y: 462 }, { x: 800, y: 462 },
];
const DW = 186, DH = 54;

// 컬러 팔레트
const C = {
  wallTop: 0x0c0b1e, wallMid: 0x14123a, wallBdr: 0x201e4e,
  floor:   0x161528, floorLn: 0x1c1b36,
  rug:     0x1d1c3c, rugBdr:  0x2a2858,
  deskSurf:0x7c5c46, deskHi:  0x9c7860, deskSha: 0x543c28, deskLeg: 0x3c2a18,
  mon: 0x0c0c1e, scr: 0x070d3e,
  skin: 0xffcc99, blush: 0xff8888, eye: 0x1a1a2a,
  chair: 0x1a1838, seat: 0x111128,
  barBg: 0x080810,
  btnIn:   0x4e4bcc, btnInH:  0x6e6bee,
  btnOut:  0xbb3232, btnOutH: 0xdd4444,
  btnAway: 0x553818, btnAwayA:0x7a5020,
  tPri: '#e8e8ff', tMut: '#666699', tGrn: '#33cc88', tYel: '#ffdd44',
};

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

const $t = (sc, x, y, s, sz, col) =>
  sc.add.text(x, y, s, { fontFamily: '"Press Start 2P"', fontSize: sz, color: col, resolution: 2 });

const $hex = s => parseInt((s ?? '#888888').replace('#', ''), 16);

// ─── BootScene ───────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const g = this.add.graphics();
    g.fillStyle(C.wallTop); g.fillRect(0, 0, W, H);
    // 책상 실루엣
    g.fillStyle(0x18163a);
    DESKS.forEach(d => g.fillRect(d.x - DW / 2, d.y, DW, DH + 20));

    $t(this, W / 2, H / 2 - 24, 'PPAI Lab', 22, '#23206a').setOrigin(0.5);
    const dot = $t(this, W / 2, H / 2 + 16, '· · ·', 10, '#2e2a88').setOrigin(0.5);
    this.tweens.add({ targets: dot, alpha: { from: 0.3, to: 1 }, duration: 520, yoyo: true, repeat: -1 });

    const socket = io();
    socket.once('connect',       () => this.scene.start('Lab', { socket }));
    socket.once('connect_error', () => {
      dot.destroy();
      $t(this, W / 2, H / 2 + 16, '연결 실패 · 새로고침', 8, '#cc4444').setOrigin(0.5);
    });
  }
}

// ─── LabScene ─────────────────────────────────────────────────────────────────

class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  init({ socket }) {
    this.socket = socket;
    this.myName = null;
    this.isAway = false;
    this.users  = [];
    this.chars  = {};
    this._modal = null;
  }

  create() {
    this._drawRoom();
    this._drawDesks();
    this._buildUI();

    const onState = u => this._sync(u);
    const onErr   = m => this._labErr(m);
    this.socket.on('state_sync', onState);
    this.socket.on('lab_error',  onErr);
    this.events.once('shutdown', () => {
      this.socket.off('state_sync', onState);
      this.socket.off('lab_error',  onErr);
    });
    this.time.addEvent({ delay: 1000, loop: true, callback: this._tick, callbackScope: this });
  }

  // ── 방 그리기 ──────────────────────────────────────────────────────────────

  _drawRoom() {
    const g = this.add.graphics();

    // 벽
    g.fillStyle(C.wallTop); g.fillRect(0, 0, W, WALL_H);
    g.fillStyle(C.wallMid); g.fillRect(0, WALL_H - 52, W, 52);
    g.fillStyle(C.wallBdr); g.fillRect(0, WALL_H - 6, W, 6);
    g.fillStyle(0x28265a);  g.fillRect(0, WALL_H, W, 3);

    // 바닥
    g.fillStyle(C.floor); g.fillRect(0, WALL_H, W, H - WALL_H - UI_H);
    g.lineStyle(1, C.floorLn, 1);
    for (let x = 0; x <= W; x += 80)           { g.beginPath(); g.moveTo(x, WALL_H);     g.lineTo(x, H - UI_H); g.strokePath(); }
    for (let y = WALL_H; y <= H - UI_H; y += 80) { g.beginPath(); g.moveTo(0, y);         g.lineTo(W, y);        g.strokePath(); }

    // 러그
    g.fillStyle(C.rug);    g.fillRect(54, 350, W - 108, 144);
    g.lineStyle(2, C.rugBdr, 1);   g.strokeRect(60, 356, W - 120, 132);
    g.lineStyle(1, C.rugBdr, 0.5); g.strokeRect(70, 366, W - 140, 112);
    // 러그 코너 장식
    [[60,356],[W-60,356],[60,488],[W-60,488]].forEach(([rx, ry]) => {
      g.fillStyle(C.rugBdr); g.fillRect(rx - 3, ry - 3, 6, 6);
    });

    // 따뜻한 천장 조명 느낌
    const glow = this.add.graphics();
    glow.fillStyle(0xffeeaa, 0.035); glow.fillEllipse(W / 2, 50, 680, 320);

    // 창문
    this._window(g, 36, 8);
    this._window(g, W - 152, 8);

    // 책장
    this._shelf(g, 224, 4);

    // 벽시계
    this._wallClock(g, 480, 16);

    // 화분
    this._plant(g, 14,     WALL_H);
    this._plant(g, W - 14, WALL_H);

    // 사이드 비네트
    const vig = this.add.graphics();
    vig.fillStyle(0x000000, 0.12); vig.fillRect(0,     0, 44, H);
    vig.fillStyle(0x000000, 0.12); vig.fillRect(W - 44, 0, 44, H);
  }

  _window(g, x, y) {
    const ww = 116, wh = 130;
    // 커튼 레일
    g.fillStyle(0x5a3a28); g.fillRect(x - 16, y, ww + 32, 6);
    // 프레임
    g.fillStyle(0x3e2c1a); g.fillRect(x, y + 4, ww, wh);
    // 하늘
    g.fillStyle(0x08102e); g.fillRect(x + 5, y + 9, ww - 10, wh - 14);
    // 별
    g.fillStyle(0xffffff, 1);
    [[16,10],[48,6],[86,16],[28,40],[70,28],[96,50],[10,58],[54,64],[80,44]].forEach(
      ([dx, dy]) => g.fillRect(x + dx, y + dy, 2, 2)
    );
    // 달
    g.fillStyle(0xfff8cc); g.fillCircle(x + 82, y + 22, 13);
    g.fillStyle(0x08102e); g.fillCircle(x + 87, y + 19, 10);
    // 창틀 분리대
    g.fillStyle(0x3e2c1a);
    g.fillRect(x + 55, y + 9,  5, wh - 14);
    g.fillRect(x + 5,  y + 64, ww - 10, 5);
    // 커튼
    g.fillStyle(0x3d2252);
    g.fillRect(x - 14, y + 4, 16, wh);
    g.fillRect(x + ww - 2, y + 4, 16, wh);
    g.fillStyle(0x5a3370, 0.55);
    g.fillRect(x - 12, y + 4, 5, wh);
    g.fillRect(x + ww - 2, y + 4, 5, wh);
  }

  _shelf(g, x, y) {
    const sw = 512, sh = 100;
    g.fillStyle(0x5a4030); g.fillRect(x, y, sw, sh);
    g.fillStyle(0x3e2c1a); g.fillRect(x, y,      sw, 5);
    g.fillStyle(0x3e2c1a); g.fillRect(x, y + sh - 5, sw, 5);
    // 선반 판
    g.fillStyle(0x3e2c1a);
    g.fillRect(x + 4, y + sh / 2 - 3, sw - 8, 5);
    g.fillRect(x + sw / 3 - 2,     y + 4, 4, sh - 8);
    g.fillRect(x + sw * 2 / 3 - 2, y + 4, 4, sh - 8);

    // 책들
    const bc = [0xcc4444,0x4488cc,0x44aa66,0xcc8844,0x8844cc,0xcc4488,0x44cccc,0xaacc44,0xcc6644,0x4466cc,0x44cc88,0xdd8844,0x55aadd,0xcc4466,0xaa44cc];
    let bx = x + 8;
    for (let i = 0; i < 14 && bx < x + sw * 2 / 3 - 12; i++) {
      const bw = 13 + (i % 4) * 3, bh = 26 + (i % 5) * 5;
      const by = y + sh / 2 - bh - 6;
      g.fillStyle(bc[i]); g.fillRect(bx, by, bw, bh);
      g.fillStyle(0x000000, 0.2); g.fillRect(bx, by, 2, bh);
      g.fillStyle(0xffffff, 0.08); g.fillRect(bx + bw - 2, by, 2, bh);
      bx += bw + 2;
    }
    bx = x + sw * 2 / 3 + 8;
    for (let i = 0; i < 7 && bx < x + sw - 10; i++) {
      const bw = 14 + (i % 3) * 4, bh = 30 + (i % 3) * 6;
      const by = y + sh - bh - 8;
      g.fillStyle(bc[(i + 8) % bc.length]); g.fillRect(bx, by, bw, bh);
      g.fillStyle(0x000000, 0.2); g.fillRect(bx, by, 2, bh);
      bx += bw + 2;
    }
    // 소품 (액자, 작은 화분)
    g.fillStyle(0x88aacc); g.fillRect(x + sw / 3 + 12, y + sh / 2 + 6, 24, 30);
    g.fillStyle(0x5588aa); g.fillRect(x + sw / 3 + 15, y + sh / 2 + 9, 18, 24);
    g.fillStyle(0x88cc88); g.fillCircle(x + sw * 2 / 3 - 28, y + 20, 9);
    g.fillStyle(0x2a5a28); g.fillRect(x + sw * 2 / 3 - 31, y + 14, 6, 10);
  }

  _wallClock(g, cx, y) {
    const r = 25;
    g.fillStyle(0x28245e); g.fillCircle(cx, y + r, r + 5);
    g.fillStyle(0xf4f0ff); g.fillCircle(cx, y + r, r);
    g.fillStyle(0xe8e4f8); g.fillCircle(cx, y + r, r - 2);
    g.fillStyle(0x333366);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      g.fillRect(cx + Math.cos(a) * (r - 4) - 1, y + r + Math.sin(a) * (r - 4) - 1, 2, 2);
    }
    // 시침/분침 (10:10 — 미관상 최적)
    g.lineStyle(2, 0x222255, 1);
    g.beginPath(); g.moveTo(cx, y + r); g.lineTo(cx - 9, y + r - 13); g.strokePath();
    g.beginPath(); g.moveTo(cx, y + r); g.lineTo(cx + 12, y + r - 10); g.strokePath();
    g.fillStyle(0x333366); g.fillCircle(cx, y + r, 3);
  }

  _plant(g, x, y) {
    g.fillStyle(0x7a3e18); g.fillRect(x - 14, y - 30, 28, 26);
    g.fillStyle(0x6a3210); g.fillRect(x - 16, y - 36, 32,  8);
    g.fillStyle(0x9a6030); g.fillRect(x - 13, y - 28, 26,  5);
    g.fillStyle(0x2e1a08); g.fillRect(x - 11, y - 26, 22, 10);
    g.fillStyle(0x2a6a30); g.fillCircle(x,      y - 52, 19);
    g.fillStyle(0x3a8a40); g.fillCircle(x - 16, y - 40, 14);
    g.fillStyle(0x3a8a40); g.fillCircle(x + 16, y - 40, 14);
    g.fillStyle(0x4aaa50); g.fillCircle(x,      y - 62, 13);
    g.fillStyle(0x2a5a28); g.fillRect(x - 2,   y - 44,  4, 18);
  }

  // ── 책상 ───────────────────────────────────────────────────────────────────

  _drawDesks() {
    const g = this.add.graphics();
    DESKS.forEach(d => this._desk(g, d.x, d.y));
  }

  _desk(g, cx, cy) {
    g.fillStyle(C.deskSurf);  g.fillRect(cx - DW / 2, cy, DW, DH);
    g.fillStyle(C.deskHi);    g.fillRect(cx - DW / 2, cy, DW, 7);
    g.fillStyle(C.deskSha);   g.fillRect(cx - DW / 2, cy + DH - 4, DW, 4);
    g.fillStyle(C.deskSha, 0.4);
    g.fillRect(cx - DW / 2, cy, 3, DH);
    g.fillRect(cx + DW / 2 - 3, cy, 3, DH);
    g.fillStyle(C.deskLeg);
    g.fillRect(cx - DW / 2 + 7, cy + DH, 10, 22);
    g.fillRect(cx + DW / 2 - 17, cy + DH, 10, 22);
    // 모니터
    g.fillStyle(C.mon);  g.fillRect(cx - 24, cy - 44, 48, 36);
    g.fillStyle(C.scr);  g.fillRect(cx - 21, cy - 41, 42, 30);
    g.fillStyle(0x1a2888, 0.5); g.fillRect(cx - 18, cy - 38, 36, 8);
    g.fillStyle(0x0a1040, 0.4); g.fillRect(cx - 18, cy - 30, 36, 18);
    g.fillStyle(C.mon);
    g.fillRect(cx - 5, cy - 10, 10, 10);
    g.fillRect(cx - 14, cy - 2, 28, 4);
    // 키보드
    g.fillStyle(0x181826); g.fillRect(cx - 36, cy + 9, 50, 14);
    g.fillStyle(0x222234); g.fillRect(cx - 34, cy + 11, 46, 10);
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 8; k++) { g.fillStyle(0x2c2c42); g.fillRect(cx - 33 + k * 6, cy + 12 + r * 5, 5, 4); }
    // 마우스
    g.fillStyle(0x1e1e2e); g.fillRect(cx + 26, cy + 9, 13, 18);
    g.fillStyle(0x2a2a3e); g.fillRect(cx + 28, cy + 11, 9, 7);
    // 커피잔 ☕
    g.fillStyle(0xcc8855); g.fillRect(cx + 52, cy + 4, 17, 21);
    g.fillStyle(0xddaa77); g.fillRect(cx + 53, cy + 5, 15, 6);
    g.fillStyle(0x3a2010); g.fillRect(cx + 54, cy + 11, 13, 12);
    g.fillStyle(C.deskSurf); g.fillRect(cx + 51, cy + 23, 19, 3);
    g.fillStyle(0xcc8855); g.fillRect(cx + 68, cy + 7, 4, 10);
    g.fillStyle(0xffffff, 0.14);
    g.fillRect(cx + 57, cy + 1, 2, 3);
    g.fillRect(cx + 61, cy - 1, 2, 4);
  }

  // ── 캐릭터 (Container 기반, 애니메이션) ──────────────────────────────────

  _addChar(user) {
    const pos = DESKS[user.desk];
    if (!pos) return;
    const { x: cx, y: cy } = pos;
    const col = $hex(user.color);

    const container = this.add.container(cx, cy).setDepth(5);

    // 캐릭터 그래픽스
    const g = this.add.graphics();
    this._drawChar(g, col, user.status === 'away');
    container.add(g);

    // 이름표
    const nw = user.name.length * 9 + 20;
    const tagG = this.add.graphics();
    tagG.fillStyle(0x000000, 0.68); tagG.fillRoundedRect(-nw / 2, -92, nw, 20, 3);
    tagG.lineStyle(1, col, 0.5);   tagG.strokeRoundedRect(-nw / 2, -92, nw, 20, 3);
    const nameTxt = this.add.text(0, -82, user.name, {
      fontFamily: '"Press Start 2P"', fontSize: 7, color: user.color, resolution: 2,
    }).setOrigin(0.5, 1);
    container.add([tagG, nameTxt]);

    // 타이머
    const timerTxt = this.add.text(0, -68, '00:00', {
      fontFamily: '"Press Start 2P"', fontSize: 6, color: C.tMut, resolution: 2,
    }).setOrigin(0.5, 1);
    container.add(timerTxt);

    // 말풍선 (그래픽스 기반)
    const msgG = this.add.graphics();
    const msgTxt = this.add.text(0, -102, '', {
      fontFamily: '"Press Start 2P"', fontSize: 7, color: '#111111', resolution: 2,
    }).setOrigin(0.5, 1).setVisible(false);
    container.add([msgG, msgTxt]);

    // 떠다니는 애니메이션
    const tween = this.tweens.add({
      targets: container, y: cy - 3, yoyo: true, repeat: -1,
      duration: 1400 + Math.random() * 700, ease: 'Sine.easeInOut',
    });

    this.chars[user.name] = { container, g, tagG, nameTxt, timerTxt, msgG, msgTxt, tween };
    this._applyAway(user.name, user.status === 'away');
    if (user.message) this._showMsg(user.name, user.message);
  }

  _drawChar(g, col, away) {
    g.clear();
    const hair = Math.max(0, col - 0x2a2a2a);

    // 의자
    g.fillStyle(C.chair, 1); g.fillRect(-20, -50, 40, 38);
    g.fillStyle(0x22244a, 1); g.fillRect(-18, -48, 36, 7);
    g.fillStyle(C.seat, 1);  g.fillRect(-17, -14, 34, 8);

    // 몸 (셔츠)
    g.fillStyle(col, 1);      g.fillRect(-13, -30, 26, 16);
    g.fillStyle(C.skin, 1);  g.fillRect(-4, -30, 8, 7); // 칼라

    // 머리
    g.fillStyle(C.skin, 1);  g.fillRect(-11, -56, 22, 26);

    // 헤어
    g.fillStyle(hair, 1);
    g.fillRect(-11, -56, 22, 10);
    g.fillRect(-14, -54,  5, 18);
    g.fillRect(  9, -54,  5, 14);

    if (away) {
      // 자리비움: 눈 감음
      g.fillStyle(C.eye, 1);
      g.fillRect(-7, -43, 5, 2);
      g.fillRect( 2, -43, 5, 2);
    } else {
      // 눈
      g.fillStyle(C.eye, 1);
      g.fillRect(-7, -46, 5, 5);
      g.fillRect( 2, -46, 5, 5);
      // 눈 하이라이트
      g.fillStyle(0xffffff, 1);
      g.fillRect(-6, -46, 2, 2);
      g.fillRect( 3, -46, 2, 2);
      // 볼터치
      g.fillStyle(C.blush, 0.75);
      g.fillRect(-10, -40, 5, 3);
      g.fillRect(  5, -40, 5, 3);
      // 입 (작은 미소)
      g.fillStyle(0xcc9977, 1);
      g.fillRect(-3, -34, 6, 2);
    }
  }

  _updateChar(user) {
    const c = this.chars[user.name];
    if (!c) return;
    this._drawChar(c.g, $hex(user.color), user.status === 'away');
    this._applyAway(user.name, user.status === 'away');
    user.message ? this._showMsg(user.name, user.message) : this._hideMsg(user.name);
  }

  _removeChar(name) {
    const c = this.chars[name];
    if (!c) return;
    c.tween?.remove();
    c.container?.destroy();
    delete this.chars[name];
  }

  _applyAway(name, away) {
    const c = this.chars[name];
    if (c) c.container.setAlpha(away ? 0.42 : 1);
  }

  _showMsg(name, msg) {
    const c = this.chars[name];
    if (!c) return;
    c.msgTxt.setText(msg).setVisible(true);
    const tw = Math.min(188, c.msgTxt.width + 16);
    c.msgG.clear();
    c.msgG.fillStyle(0xffffff, 0.94); c.msgG.fillRoundedRect(-tw / 2, -122, tw, 22, 3);
    c.msgG.fillTriangle(-6, -100, 6, -100, 0, -93);
  }

  _hideMsg(name) {
    const c = this.chars[name];
    if (!c) return;
    c.msgTxt.setVisible(false);
    c.msgG.clear();
  }

  // ── 상태 동기화 ─────────────────────────────────────────────────────────────

  _sync(users) {
    this.users = users;
    if (this.countTxt) this.countTxt.setText(`${users.length}명`);

    const live = new Set(users.map(u => u.name));
    Object.keys(this.chars).forEach(n => { if (!live.has(n)) this._removeChar(n); });
    users.forEach(u => this.chars[u.name] ? this._updateChar(u) : this._addChar(u));

    const me = this.myName && users.find(u => u.name === this.myName);
    if (me) {
      const away = me.status === 'away';
      if (this.isAway !== away) { this.isAway = away; this._refreshAwayBtn(); }
    }
  }

  _tick() {
    const now = Date.now();
    this.users.forEach(u => {
      const c = this.chars[u.name];
      if (!c) return;
      let s = u.totalToday ?? 0;
      if (u.status === 'working' && u.checkInTime) s += Math.floor((now - u.checkInTime) / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      const p = n => String(n).padStart(2, '0');
      c.timerTxt.setText(h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`);
    });
  }

  // ── UI 바 ──────────────────────────────────────────────────────────────────

  _buildUI() {
    const by = H - UI_H;

    const bar = this.add.graphics().setDepth(20);
    bar.fillStyle(C.barBg, 0.97); bar.fillRect(0, by, W, UI_H);
    bar.lineStyle(1, 0x22226a, 1); bar.beginPath(); bar.moveTo(0, by); bar.lineTo(W, by); bar.strokePath();
    bar.lineStyle(1, 0x4444bb, 0.3); bar.beginPath(); bar.moveTo(0, by + 1); bar.lineTo(W, by + 1); bar.strokePath();

    // 접속자 표시 (왼쪽)
    const dot = this.add.circle(20, by + 22, 5, 0x33cc88).setDepth(21);
    this.tweens.add({ targets: dot, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    this.countTxt = $t(this, 33, by + 22, '0명', 9, C.tGrn).setOrigin(0, 0.5).setDepth(21);
    $t(this, 33, by + 38, '접속 중', 6, C.tMut).setOrigin(0, 0.5).setDepth(21);

    $t(this, W - 10, by + 8, 'v1.0', 6, '#22225a').setOrigin(1, 0).setDepth(21);

    // 출근하기 버튼 (관찰자 모드)
    const [ciB, ciL] = this._makeBtn(W / 2, by + 32, 210, 42, C.btnIn, C.btnInH, '출근하기', 11);
    ciB.on('pointerdown', () => this._openModal());
    this._ciG = [ciB, ciL];

    // 자리비움 버튼 (근무 모드)
    const [awB, awL] = this._makeBtn(W / 2 - 108, by + 32, 182, 42, C.btnAway, C.btnAwayA, '자리비움', 10);
    awB.on('pointerdown', () => {
      this.isAway = !this.isAway;
      this.socket.emit(this.isAway ? 'set_away' : 'set_back');
      this._refreshAwayBtn();
    });
    this.awB = awB; this.awL = awL;

    // 퇴근하기 버튼
    const [outB, outL] = this._makeBtn(W - 112, by + 32, 186, 42, C.btnOut, C.btnOutH, '퇴근하기', 10);
    outB.on('pointerdown', () => this._checkout());
    this._wkG = [awB, awL, outB, outL];

    this._setMode('observer');
  }

  _makeBtn(x, y, w, h, fill, hover, label, fontSize) {
    const btn = this.add.rectangle(x, y, w, h, fill).setDepth(21).setInteractive({ useHandCursor: true });
    const bd  = this.add.graphics().setDepth(21);
    bd.lineStyle(1, 0xffffff, 0.1); bd.strokeRect(x - w / 2 + 1, y - h / 2 + 1, w - 2, h - 2);
    const lbl = $t(this, x, y, label, fontSize, C.tPri).setOrigin(0.5).setDepth(22);
    btn.on('pointerover',  () => btn.setFillStyle(hover));
    btn.on('pointerout',   () => btn.setFillStyle(fill));
    btn.on('pointerdown',  () => btn.setScale(0.96));
    btn.on('pointerup',    () => btn.setScale(1));
    return [btn, lbl];
  }

  _refreshAwayBtn() {
    this.awB?.setFillStyle(this.isAway ? C.btnAwayA : C.btnAway);
    this.awL?.setText(this.isAway ? '돌아오기' : '자리비움');
  }

  _setMode(m) {
    const w = m === 'worker';
    this._ciG?.forEach(o => o.setVisible(!w));
    this._wkG?.forEach(o => o.setVisible(w));
  }

  // ── 출근 모달 ──────────────────────────────────────────────────────────────

  _openModal() {
    if (this._modal) return;
    const objs = [];
    const keep = o => { objs.push(o); return o; };

    // 어두운 오버레이 (페이드 인)
    const ov = keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setAlpha(0).setDepth(50).setInteractive());
    this.tweens.add({ targets: ov, alpha: 0.76, duration: 200 });

    // 패널
    const pw = 440, ph = 280, px = W / 2, py = H / 2;
    const panel = keep(this.add.rectangle(px, py, pw, ph, 0x0e0c28).setAlpha(0).setScale(0.88).setDepth(51));
    this.tweens.add({ targets: panel, alpha: 1, scaleX: 1, scaleY: 1, duration: 240, ease: 'Back.easeOut' });

    // 패널 테두리
    const pbdr = keep(this.add.graphics().setDepth(51).setAlpha(0));
    pbdr.lineStyle(2, 0x4444cc, 1);    pbdr.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
    pbdr.lineStyle(1, 0x8888dd, 0.22); pbdr.strokeRect(px - pw / 2 + 3, py - ph / 2 + 3, pw - 6, ph - 6);
    this.tweens.add({ targets: pbdr, alpha: 1, duration: 240 });

    // 코너 별 장식
    [[px - pw / 2 + 12, py - ph / 2 + 12,'✦','#6666ee'],
     [px + pw / 2 - 12, py - ph / 2 + 12,'✦','#6666ee'],
     [px - pw / 2 + 12, py + ph / 2 - 12,'✧','#4444aa'],
     [px + pw / 2 - 12, py + ph / 2 - 12,'✧','#4444aa']].forEach(([cx, cy, s, col]) => {
      const st = keep($t(this, cx, cy, s, 10, col).setOrigin(0.5).setDepth(52).setAlpha(0));
      this.tweens.add({ targets: st, alpha: 1, duration: 300, delay: 80 });
    });

    // 타이틀
    const title = keep($t(this, px, py - 102, '오늘도 출근! ✨', 13, '#c8c8ff').setOrigin(0.5).setDepth(52).setAlpha(0));
    this.tweens.add({ targets: title, alpha: 1, duration: 240, delay: 60 });

    const sub = keep($t(this, px, py - 76, '닉네임을 입력하세요', 7, C.tMut).setOrigin(0.5).setDepth(52).setAlpha(0));
    this.tweens.add({ targets: sub, alpha: 1, duration: 240, delay: 100 });

    // 입력 필드 (DOM)
    const domEl = keep(this.add.dom(px, py - 24).createFromHTML(`
      <input id="ci" type="text" autocomplete="off" maxlength="8" placeholder="최대 8자"
        style="font-family:'Press Start 2P',monospace;font-size:16px;
               background:transparent;color:#d0d0ff;
               border:none;border-bottom:2px solid #5555cc;
               padding:8px 12px;width:280px;text-align:center;
               outline:none;letter-spacing:3px;display:block;
               transform:scale(0.78);transform-origin:center;">
    `).setDepth(52));
    domEl.addListener('keydown').on('keydown', e => {
      if (e.key === 'Enter')  this._submitCheckin();
      if (e.key === 'Escape') this._closeModal();
      if (this._modal?.errTxt) this._modal.errTxt.setText('');
    });

    const errTxt = keep($t(this, px, py + 24, '', 7, '#ff7777').setOrigin(0.5).setDepth(52));

    // 버튼들
    const btnY = py + 88;
    const [okB, okL, okBd] = this._modalBtn(px - 68, btnY, 124, 40, 0x3838cc, 0x5555ee, '출근!', 9);
    const [cnB, cnL, cnBd] = this._modalBtn(px + 68, btnY, 124, 40, 0x1a1830, 0x2a2448, '취소', 9);
    [okB, okL, okBd, cnB, cnL, cnBd].forEach(o => {
      keep(o); o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 200, delay: 140 });
    });
    okB.on('pointerdown', () => this._submitCheckin());
    cnB.on('pointerdown', () => this._closeModal());

    this._modal = { errTxt, _objs: objs };
    setTimeout(() => document.getElementById('ci')?.focus(), 80);
  }

  _modalBtn(x, y, w, h, fill, hover, label, fontSize) {
    const btn = this.add.rectangle(x, y, w, h, fill).setDepth(52).setInteractive({ useHandCursor: true });
    const bd  = this.add.graphics().setDepth(52);
    bd.lineStyle(1, 0x8888cc, 0.25); bd.strokeRect(x - w / 2, y - h / 2, w, h);
    const lbl = $t(this, x, y, label, fontSize, C.tPri).setOrigin(0.5).setDepth(53);
    btn.on('pointerover',  () => btn.setFillStyle(hover));
    btn.on('pointerout',   () => btn.setFillStyle(fill));
    btn.on('pointerdown',  () => btn.setScale(0.95));
    btn.on('pointerup',    () => btn.setScale(1));
    return [btn, lbl, bd];
  }

  _closeModal() {
    if (!this._modal) return;
    this._modal._objs.forEach(o => { this.tweens.killTweensOf(o); o?.destroy?.(); });
    this._modal = null;
  }

  _submitCheckin() {
    const el   = document.getElementById('ci');
    const name = (el?.value ?? '').trim();
    if (!name) {
      if (this._modal?.errTxt) this._modal.errTxt.setText('닉네임을 입력해주세요');
      return;
    }
    this.socket.emit('check_in', { name });

    const wait = users => {
      if (users.find(u => u.name === name)) {
        this.socket.off('state_sync', wait);
        this.myName = name; this.isAway = false;
        this._closeModal();
        this._setMode('worker');
        this._toast(`${name}님, 오늘도 화이팅! ✨`);
      }
    };
    this.socket.on('state_sync', wait);
  }

  _checkout() {
    this.socket.emit('check_out');
    this.myName = null; this.isAway = false;
    this._refreshAwayBtn();
    this._setMode('observer');
  }

  _labErr(msg) { if (this._modal?.errTxt) this._modal.errTxt.setText(msg); }

  _toast(msg) {
    const t = $t(this, W / 2, H / 2 - 32, msg, 9, '#ffffff')
      .setOrigin(0.5).setDepth(60)
      .setBackgroundColor('#33339966').setPadding(10, 6);
    this.tweens.add({
      targets: t, y: H / 2 - 74,
      alpha: { from: 1, to: 0 },
      duration: 2400, ease: 'Cubic.easeIn',
      onComplete: () => t.destroy(),
    });
  }
}

// ─── Game 설정 ────────────────────────────────────────────────────────────────

new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#0c0b1e',
  parent: 'game-container',
  dom: { createContainer: true },
  scene: [BootScene, LabScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W, height: H,
    min: { width: 320, height: 213 },
  },
  render: { pixelArt: true, antialias: false },
});

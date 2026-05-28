/* PixelLab — Phaser 3 client
 * Boot → Lab (항상 연구실 화면 표시)
 * 닉네임 없이도 관찰 가능, 출근하기 버튼으로 모달 → 캐릭터 등장
 */

const W = 960;
const H = 640;

const DESKS = [
  { x: 160, y: 280 }, { x: 480, y: 280 }, { x: 800, y: 280 },
  { x: 160, y: 490 }, { x: 480, y: 490 }, { x: 800, y: 490 },
];
const DW = 190;
const DH = 58;

// ─── BootScene ───────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    bg(this, 0x1a1a2e);
    txt(this, W / 2, H / 2, '연결 중...', 10, '#555577').setOrigin(0.5);

    const socket = io();
    socket.once('connect', () => this.scene.start('Lab', { socket }));
    socket.once('connect_error', () => {
      txt(this, W / 2, H / 2 + 36, '서버에 연결할 수 없습니다', 9, '#ff5555').setOrigin(0.5);
    });
  }
}

// ─── LabScene ─────────────────────────────────────────────────────────────────

class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  init({ socket }) {
    this.socket  = socket;
    this.myName  = null;   // null = 관찰자 모드
    this.isAway  = false;
    this.users   = [];
    this.chars   = {};
    this._modal  = null;
  }

  create() {
    this._drawRoom();
    this._drawDesks();
    this._buildUI();

    const onState = (u) => this._sync(u);
    const onErr   = (m) => this._labErr(m);
    this.socket.on('state_sync', onState);
    this.socket.on('lab_error',  onErr);
    this.events.once('shutdown', () => {
      this.socket.off('state_sync', onState);
      this.socket.off('lab_error',  onErr);
    });

    this.time.addEvent({ delay: 1000, loop: true, callback: this._tick, callbackScope: this });
  }

  // ── Room ─────────────────────────────────────────────────────────────────

  _drawRoom() {
    const g = this.add.graphics();

    g.fillStyle(0x1c2040); g.fillRect(0, 0, W, H);           // floor
    g.fillStyle(0x131628); g.fillRect(0, 0, W, 165);          // wall
    g.fillStyle(0x252b5a); g.fillRect(0, 158, W, 7);          // border

    g.lineStyle(1, 0x181d3a, 1);
    for (let x = 0; x <= W; x += 80) { g.beginPath(); g.moveTo(x, 165); g.lineTo(x, H); g.strokePath(); }
    for (let y = 165; y <= H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }

    this._window(g, 55, 18);
    this._window(g, 825, 18);

    g.fillStyle(0xf0f0ec); g.fillRect(330, 12, 300, 128);
    g.fillStyle(0xe5e5e0); g.fillRect(337, 19, 286, 114);
    g.fillStyle(0x252b5a); g.fillRect(330, 140, 300, 5);
    txt(this, 480, 76, 'PPAI Lab', 13, '#9999bb').setOrigin(0.5);

    this._plant(g, 18, 165);
    this._plant(g, W - 18, 165);
  }

  _window(g, x, y) {
    g.fillStyle(0x3a2810); g.fillRect(x, y, 108, 120);
    g.fillStyle(0x1a2e6a); g.fillRect(x + 6, y + 6, 96, 108);
    g.fillStyle(0xffffff);
    [[28,24],[65,15],[80,40],[40,55]].forEach(([dx,dy]) => g.fillRect(x+dx, y+dy, 3, 3));
    g.fillStyle(0x3a2810);
    g.fillRect(x + 52, y + 6, 4, 108);
    g.fillRect(x + 6, y + 60, 96, 4);
  }

  _plant(g, x, y) {
    g.fillStyle(0x7a3a10); g.fillRect(x - 13, y - 22, 26, 22);
    g.fillStyle(0x9a5020); g.fillRect(x - 15, y - 27, 30, 7);
    g.fillStyle(0x2a6a2a); g.fillCircle(x, y - 38, 15);
    g.fillStyle(0x3a8a3a); g.fillCircle(x - 11, y - 28, 11);
    g.fillStyle(0x3a8a3a); g.fillCircle(x + 11, y - 28, 11);
  }

  // ── Desks ────────────────────────────────────────────────────────────────

  _drawDesks() {
    const g = this.add.graphics();
    DESKS.forEach(p => this._desk(g, p.x, p.y));
  }

  _desk(g, cx, cy) {
    g.fillStyle(0x6b4c3a); g.fillRect(cx - DW/2, cy, DW, DH);
    g.fillStyle(0x8a6350); g.fillRect(cx - DW/2, cy, DW, 8);
    g.fillStyle(0x503828); g.fillRect(cx - DW/2, cy + DH - 4, DW, 4);
    g.fillStyle(0x3e2a1a);
    g.fillRect(cx - DW/2 + 8,  cy + DH, 10, 22);
    g.fillRect(cx + DW/2 - 18, cy + DH, 10, 22);
    g.fillStyle(0x0d0d1c); g.fillRect(cx - 23, cy - 40, 46, 34);
    g.fillStyle(0x0a1040); g.fillRect(cx - 20, cy - 37, 40, 28);
    g.fillStyle(0x0d0d1c); g.fillRect(cx - 5, cy - 8, 10, 8);
    g.fillStyle(0x0d0d1c); g.fillRect(cx - 14, cy - 2, 28, 4);
    g.fillStyle(0x191928); g.fillRect(cx - 38, cy + 9, 52, 14);
    g.fillStyle(0x22223a); g.fillRect(cx - 36, cy + 11, 48, 10);
    g.fillStyle(0x22223a); g.fillRect(cx + 28, cy + 9, 12, 18);
  }

  // ── Characters ──────────────────────────────────────────────────────────

  _addChar(user) {
    const pos = DESKS[user.desk];
    if (!pos) return;
    const { x: cx, y: cy } = pos;
    const col = hexInt(user.color);

    const g = this.add.graphics().setDepth(5);
    this._drawChar(g, cx, cy, col);

    const nameTag = txt(this, cx, cy - 76, user.name, 8, user.color)
      .setOrigin(0.5, 1).setDepth(10).setBackgroundColor('#00000099').setPadding(5, 3);
    const timerTxt = txt(this, cx, cy - 58, '00:00', 7, '#7777aa')
      .setOrigin(0.5, 1).setDepth(10);
    const msgBg  = this.add.rectangle(cx, cy - 98, 10, 22, 0xffffff, 0)
      .setOrigin(0.5, 1).setDepth(12);
    const msgTxt = txt(this, cx, cy - 89, '', 7, '#111111')
      .setOrigin(0.5, 1).setDepth(12).setVisible(false);
    const tail = this.add.triangle(cx, cy - 78, -6, 0, 6, 0, 0, 10, 0xffffff, 0)
      .setOrigin(0.5, 0).setDepth(11);

    this.chars[user.name] = { g, nameTag, timerTxt, msgBg, msgTxt, tail };
    this._applyAway(user.name, user.status === 'away');
    if (user.message) this._showMsg(user.name, user.message);
  }

  _drawChar(g, cx, cy, col) {
    g.clear();
    g.fillStyle(0x18183a); g.fillRect(cx - 20, cy - 46, 40, 34);
    g.fillStyle(0x111130); g.fillRect(cx - 16, cy - 14, 32, 8);
    g.fillStyle(col);      g.fillRect(cx - 14, cy - 28, 28, 14);
    g.fillStyle(0xffcc99); g.fillRect(cx - 10, cy - 52, 20, 22);
    g.fillStyle(Math.max(0, col - 0x383838)); g.fillRect(cx - 10, cy - 52, 20, 8);
    g.fillStyle(0x222222);
    g.fillRect(cx - 6, cy - 43, 4, 4);
    g.fillRect(cx + 2,  cy - 43, 4, 4);
  }

  _updateChar(user) {
    const c = this.chars[user.name];
    if (!c) return;
    const pos = DESKS[user.desk];
    if (pos) this._drawChar(c.g, pos.x, pos.y, hexInt(user.color));
    this._applyAway(user.name, user.status === 'away');
    user.message ? this._showMsg(user.name, user.message) : this._hideMsg(user.name);
  }

  _removeChar(name) {
    const c = this.chars[name];
    if (!c) return;
    [c.g, c.nameTag, c.timerTxt, c.msgBg, c.msgTxt, c.tail].forEach(o => o?.destroy());
    delete this.chars[name];
  }

  _applyAway(name, away) {
    const c = this.chars[name];
    if (!c) return;
    const a = away ? 0.35 : 1;
    [c.g, c.nameTag, c.timerTxt].forEach(o => o.setAlpha(a));
  }

  _showMsg(name, msg) {
    const c = this.chars[name];
    if (!c) return;
    c.msgTxt.setText(msg).setVisible(true);
    c.msgBg.setSize(Math.min(200, c.msgTxt.width + 16), 22).setFillStyle(0xffffff, 0.95);
    c.tail.setFillStyle(0xffffff, 0.95);
  }

  _hideMsg(name) {
    const c = this.chars[name];
    if (!c) return;
    c.msgTxt.setVisible(false);
    c.msgBg.setFillStyle(0xffffff, 0);
    c.tail.setFillStyle(0xffffff, 0);
  }

  // ── State sync ─────────────────────────────────────────────────────────────

  _sync(users) {
    this.users = users;
    this.countTxt?.setText(`${users.length}명 접속 중`);

    const live = new Set(users.map(u => u.name));
    Object.keys(this.chars).forEach(n => { if (!live.has(n)) this._removeChar(n); });
    users.forEach(u => this.chars[u.name] ? this._updateChar(u) : this._addChar(u));

    const me = this.myName && users.find(u => u.name === this.myName);
    if (me && this.awayBtn) {
      const away = me.status === 'away';
      if (this.isAway !== away) {
        this.isAway = away;
        this.awayBtn.setFillStyle(away ? 0x887700 : 0x443300);
        this.awayTxt.setText(away ? '돌아오기' : '자리비움');
      }
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

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

  // ── UI ────────────────────────────────────────────────────────────────────

  _buildUI() {
    this.add.rectangle(0, H - 58, W, 58, 0x090912, 0.96).setOrigin(0).setDepth(20);

    this.countTxt = txt(this, 18, H - 29, '0명 접속 중', 9, '#33bb77')
      .setOrigin(0, 0.5).setDepth(21);

    txt(this, W - 12, 8, 'v0.1', 6, '#333355').setOrigin(1, 0).setDepth(21);

    // 출근하기 버튼 (관찰자 모드)
    const ciBtn = this.add.rectangle(W / 2, H - 29, 210, 42, 0x225599)
      .setInteractive({ cursor: 'pointer' }).setDepth(21);
    const ciTxt = txt(this, W / 2, H - 29, '출근하기', 11, '#ffffff')
      .setOrigin(0.5).setDepth(22);
    ciBtn.on('pointerover',  () => ciBtn.setFillStyle(0x3366bb));
    ciBtn.on('pointerout',   () => ciBtn.setFillStyle(0x225599));
    ciBtn.on('pointerdown',  () => this._openModal());
    this._ciGroup = [ciBtn, ciTxt];

    // 자리비움 버튼 (근무 중 모드)
    this.awayBtn = this.add.rectangle(W / 2 - 106, H - 29, 180, 42, 0x443300)
      .setInteractive({ cursor: 'pointer' }).setDepth(21);
    this.awayTxt = txt(this, W / 2 - 106, H - 29, '자리비움', 10, '#ffdd44')
      .setOrigin(0.5).setDepth(22);
    this.awayBtn.on('pointerover', () => this.awayBtn.setFillStyle(0x665500));
    this.awayBtn.on('pointerout',  () => this.awayBtn.setFillStyle(this.isAway ? 0x887700 : 0x443300));
    this.awayBtn.on('pointerdown', () => {
      this.isAway = !this.isAway;
      this.socket.emit(this.isAway ? 'set_away' : 'set_back');
    });

    // 퇴근하기 버튼
    const outBtn = this.add.rectangle(W - 110, H - 29, 184, 42, 0x882222)
      .setInteractive({ cursor: 'pointer' }).setDepth(21);
    const outTxt = txt(this, W - 110, H - 29, '퇴근하기', 10, '#ffffff')
      .setOrigin(0.5).setDepth(22);
    outBtn.on('pointerover', () => outBtn.setFillStyle(0xaa3333));
    outBtn.on('pointerout',  () => outBtn.setFillStyle(0x882222));
    outBtn.on('pointerdown', () => this._doCheckout());
    this._wkGroup = [this.awayBtn, this.awayTxt, outBtn, outTxt];

    this._setMode('observer');
  }

  _setMode(mode) {
    const isWorker = mode === 'worker';
    this._ciGroup.forEach(o => o.setVisible(!isWorker));
    this._wkGroup.forEach(o => o.setVisible(isWorker));
  }

  // ── 출근 모달 ──────────────────────────────────────────────────────────────

  _openModal() {
    if (this._modal) return;

    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.72)
      .setDepth(50).setInteractive(); // 클릭 차단

    const panel = this.add.rectangle(W/2, H/2, 420, 240, 0x0e0e24).setDepth(51);
    const border = this.add.graphics().setDepth(51);
    border.lineStyle(3, 0x3344bb, 1);
    border.strokeRect(W/2 - 210, H/2 - 120, 420, 240);

    const title = txt(this, W/2, H/2 - 82, '오늘도 출근!', 13, '#d0d0ff').setOrigin(0.5).setDepth(52);

    const domEl = this.add.dom(W/2, H/2 - 20).createFromHTML(`
      <input id="ci-name" type="text" autocomplete="off" maxlength="8"
        placeholder="닉네임 입력 (최대 8자)"
        style="font-family:'Press Start 2P',monospace;font-size:11px;
               background:#111126;color:#d0d0ff;border:2px solid #333388;
               padding:12px 15px;width:280px;text-align:center;outline:none;
               letter-spacing:1px;">
    `).setDepth(52);
    domEl.addListener('keydown').on('keydown', (e) => {
      if (e.key === 'Enter')  this._submitCheckin();
      if (e.key === 'Escape') this._closeModal();
      if (this._modal?.errTxt) this._modal.errTxt.setText('');
    });

    const okBtn = this.add.rectangle(W/2 - 70, H/2 + 66, 126, 40, 0x225599)
      .setInteractive({ cursor: 'pointer' }).setDepth(52);
    const okTxt = txt(this, W/2 - 70, H/2 + 66, '확인', 10, '#ffffff').setOrigin(0.5).setDepth(53);
    okBtn.on('pointerover',  () => okBtn.setFillStyle(0x3366bb));
    okBtn.on('pointerout',   () => okBtn.setFillStyle(0x225599));
    okBtn.on('pointerdown',  () => this._submitCheckin());

    const cnBtn = this.add.rectangle(W/2 + 70, H/2 + 66, 126, 40, 0x2a1818)
      .setInteractive({ cursor: 'pointer' }).setDepth(52);
    const cnTxt = txt(this, W/2 + 70, H/2 + 66, '취소', 10, '#777777').setOrigin(0.5).setDepth(53);
    cnBtn.on('pointerover',  () => cnBtn.setFillStyle(0x442222));
    cnBtn.on('pointerout',   () => cnBtn.setFillStyle(0x2a1818));
    cnBtn.on('pointerdown',  () => this._closeModal());

    const errTxt = txt(this, W/2, H/2 + 32, '', 7, '#ff6666').setOrigin(0.5).setDepth(52);

    this._modal = { overlay, panel, border, title, domEl, okBtn, okTxt, cnBtn, cnTxt, errTxt };
    setTimeout(() => document.getElementById('ci-name')?.focus(), 60);
  }

  _closeModal() {
    if (!this._modal) return;
    Object.values(this._modal).forEach(o => o?.destroy?.());
    this._modal = null;
  }

  _submitCheckin() {
    const el  = document.getElementById('ci-name');
    const name = (el?.value ?? '').trim();
    if (!name) {
      if (this._modal?.errTxt) this._modal.errTxt.setText('닉네임을 입력해주세요');
      return;
    }
    this.socket.emit('check_in', { name });

    const waitMe = (users) => {
      if (users.find(u => u.name === name)) {
        this.socket.off('state_sync', waitMe);
        this.myName  = name;
        this.isAway  = false;
        this._closeModal();
        this._setMode('worker');
      }
    };
    this.socket.on('state_sync', waitMe);
  }

  _doCheckout() {
    this.socket.emit('check_out');
    this.myName = null;
    this.isAway = false;
    this.awayBtn?.setFillStyle(0x443300);
    this.awayTxt?.setText('자리비움');
    this._setMode('observer');
  }

  _labErr(msg) {
    if (this._modal?.errTxt) this._modal.errTxt.setText(msg);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bg(scene, color) {
  return scene.add.rectangle(0, 0, W, H, color).setOrigin(0);
}

function txt(scene, x, y, str, size, color) {
  return scene.add.text(x, y, str, {
    fontFamily: '"Press Start 2P"',
    fontSize: size,
    color,
    resolution: 2,
  });
}

function hexInt(hexStr) {
  return parseInt((hexStr ?? '#888888').replace('#', ''), 16);
}

// ─── Game ─────────────────────────────────────────────────────────────────────

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#1a1a2e',
  parent: 'game-container',
  dom: { createContainer: true },
  scene: [BootScene, LabScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true },
});

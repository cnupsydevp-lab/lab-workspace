/* PixelLab — Phaser 3 client
 * Scenes: Boot → Login → Lab
 * Socket events (server → client): state_sync, lab_error
 * Socket events (client → server): check_in, check_out, set_away, set_back, send_message
 */

const W = 960;
const H = 640;

// Desk center positions (cx, cy = top of desk surface)
const DESKS = [
  { x: 160, y: 280 }, { x: 480, y: 280 }, { x: 800, y: 280 },
  { x: 160, y: 490 }, { x: 480, y: 490 }, { x: 800, y: 490 },
];
const DW = 190; // desk width
const DH = 58;  // desk height

// ─── BootScene ───────────────────────────────────────────────────────────────

class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    bg(this, 0x1a1a2e);
    txt(this, W / 2, H / 2, '연결 중...', 10, '#555577').setOrigin(0.5);

    const socket = io();
    socket.once('connect', () => this.scene.start('Login', { socket }));
    socket.once('connect_error', () => {
      txt(this, W / 2, H / 2 + 36, '서버에 연결할 수 없습니다', 9, '#ff5555').setOrigin(0.5);
    });
  }
}

// ─── LoginScene ──────────────────────────────────────────────────────────────

class LoginScene extends Phaser.Scene {
  constructor() { super('Login'); }
  init({ socket }) { this.socket = socket; }

  create() {
    bg(this, 0x1a1a2e);

    // Pixel border
    const g = this.add.graphics();
    g.lineStyle(4, 0x333366, 1); g.strokeRect(28, 28, W - 56, H - 56);
    g.lineStyle(2, 0x222244, 1); g.strokeRect(36, 36, W - 72, H - 72);

    // Title
    txt(this, W / 2, 130, 'PPAI LAB', 34, '#d0d0ff').setOrigin(0.5);
    txt(this, W / 2, 185, 'pixel workspace', 12, '#4444aa').setOrigin(0.5);

    // Online badge
    this.badge = txt(this, W / 2, 226, '● 0명 접속 중', 9, '#33bb77').setOrigin(0.5);

    // Name input (DOM element)
    this.nameInput = this.add.dom(W / 2, 316).createFromHTML(`
      <input id="ni" type="text" autocomplete="off" maxlength="8" placeholder="닉네임 (최대 8자)"
        style="font-family:'Press Start 2P',monospace;font-size:13px;
               background:#0e0e20;color:#d0d0ff;border:3px solid #333366;
               padding:13px 18px;width:290px;text-align:center;
               outline:none;letter-spacing:1px;">
    `);
    this.nameInput.addListener('keydown').on('keydown', (e) => {
      if (e.key === 'Enter') this._checkin();
      if (this.errTxt) this.errTxt.setText('');
    });

    // Check-in button
    pixBtn(this, W / 2, 408, 220, 50, 0x2255aa, '출근하기', 14, '#ffffff',
      () => this._checkin());

    this.errTxt = txt(this, W / 2, 462, '', 8, '#ff6666').setOrigin(0.5);

    // Socket listeners (cleaned up on shutdown)
    const onState = (users) => this.badge.setText(`● ${users.length}명 접속 중`);
    const onErr = (msg) => this.errTxt.setText(msg);
    this.socket.on('state_sync', onState);
    this.socket.on('lab_error', onErr);
    this.events.once('shutdown', () => {
      this.socket.off('state_sync', onState);
      this.socket.off('lab_error', onErr);
    });
  }

  _checkin() {
    const el = document.getElementById('ni');
    const name = (el?.value ?? '').trim();
    if (!name) { this.errTxt.setText('닉네임을 입력해주세요'); return; }

    this.socket.emit('check_in', { name });

    const waitMe = (users) => {
      if (users.find(u => u.name === name)) {
        this.socket.off('state_sync', waitMe);
        if (this.nameInput?.active) this.nameInput.destroy();
        this.scene.start('Lab', { socket: this.socket, myName: name });
      }
    };
    this.socket.on('state_sync', waitMe);
  }
}

// ─── LabScene ─────────────────────────────────────────────────────────────────

class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  init({ socket, myName }) {
    this.socket = socket;
    this.myName = myName;
    this.users = [];
    this.chars = {}; // name → { g, nameTag, timerTxt, msgBg, msgTxt }
    this.isAway = false;
  }

  create() {
    this._drawRoom();
    this._drawDesks();
    this._buildUI();

    const onState = (users) => this._sync(users);
    this.socket.on('state_sync', onState);
    this.events.once('shutdown', () => this.socket.off('state_sync', onState));

    this.time.addEvent({ delay: 1000, loop: true, callback: this._tick, callbackScope: this });
  }

  // ── Room ──────────────────────────────────────────────────────────────────

  _drawRoom() {
    const g = this.add.graphics();

    // Floor
    g.fillStyle(0x1c2040); g.fillRect(0, 0, W, H);
    // Wall
    g.fillStyle(0x131628); g.fillRect(0, 0, W, 165);
    // Wall/floor border
    g.fillStyle(0x252b5a); g.fillRect(0, 158, W, 7);

    // Floor tiles
    g.lineStyle(1, 0x181d3a, 1);
    for (let x = 0; x <= W; x += 80) { g.beginPath(); g.moveTo(x, 165); g.lineTo(x, H); g.strokePath(); }
    for (let y = 165; y <= H; y += 80)  { g.beginPath(); g.moveTo(0, y);  g.lineTo(W, y); g.strokePath(); }

    // Windows
    this._window(g, 55, 18);
    this._window(g, 825, 18);

    // Whiteboard
    g.fillStyle(0xf0f0ec); g.fillRect(330, 12, 300, 128);
    g.fillStyle(0xe5e5e0); g.fillRect(337, 19, 286, 114);
    g.fillStyle(0x252b5a); g.fillRect(330, 140, 300, 5);
    txt(this, 480, 76, 'PPAI Lab', 13, '#9999bb').setOrigin(0.5);

    // Decorative plants
    this._plant(g, 18, 165);
    this._plant(g, W - 18, 165);
  }

  _window(g, x, y) {
    g.fillStyle(0x3a2810); g.fillRect(x, y, 108, 120);
    g.fillStyle(0x1a2e6a); g.fillRect(x + 6, y + 6, 96, 108);
    // Stars
    g.fillStyle(0xffffff);
    [[28, 24], [65, 15], [80, 40], [40, 55]].forEach(([dx, dy]) => {
      g.fillRect(x + dx, y + dy, 3, 3);
    });
    // Dividers
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

  // ── Desks ─────────────────────────────────────────────────────────────────

  _drawDesks() {
    const g = this.add.graphics();
    DESKS.forEach(pos => this._desk(g, pos.x, pos.y));
  }

  _desk(g, cx, cy) {
    // Surface
    g.fillStyle(0x6b4c3a); g.fillRect(cx - DW / 2, cy, DW, DH);
    g.fillStyle(0x8a6350); g.fillRect(cx - DW / 2, cy, DW, 8);
    g.fillStyle(0x503828); g.fillRect(cx - DW / 2, cy + DH - 4, DW, 4);
    // Legs
    g.fillStyle(0x3e2a1a);
    g.fillRect(cx - DW / 2 + 8,  cy + DH, 10, 22);
    g.fillRect(cx + DW / 2 - 18, cy + DH, 10, 22);
    // Monitor
    g.fillStyle(0x0d0d1c); g.fillRect(cx - 23, cy - 40, 46, 34);
    g.fillStyle(0x0a1040); g.fillRect(cx - 20, cy - 37, 40, 28);
    g.fillStyle(0x0d0d1c); g.fillRect(cx - 5, cy - 8, 10, 8);
    g.fillStyle(0x0d0d1c); g.fillRect(cx - 14, cy - 2, 28, 4);
    // Keyboard
    g.fillStyle(0x191928); g.fillRect(cx - 38, cy + 9, 52, 14);
    g.fillStyle(0x22223a); g.fillRect(cx - 36, cy + 11, 48, 10);
    // Mouse
    g.fillStyle(0x22223a); g.fillRect(cx + 28, cy + 9, 12, 18);
  }

  // ── Characters ───────────────────────────────────────────────────────────

  _addChar(user) {
    const pos = DESKS[user.desk];
    if (!pos) return;
    const { x: cx, y: cy } = pos;
    const col = hexInt(user.color);

    const g = this.add.graphics().setDepth(5);
    this._drawChar(g, cx, cy, col);

    const nameTag = txt(this, cx, cy - 76, user.name, 8, user.color)
      .setOrigin(0.5, 1).setDepth(10)
      .setBackgroundColor('#00000099').setPadding(5, 3);

    const timerTxt = txt(this, cx, cy - 58, '00:00', 7, '#7777aa')
      .setOrigin(0.5, 1).setDepth(10);

    const msgBg  = this.add.rectangle(cx, cy - 98, 10, 22, 0xffffff, 0)
      .setOrigin(0.5, 1).setDepth(12);
    const msgTxt = txt(this, cx, cy - 89, '', 7, '#111111')
      .setOrigin(0.5, 1).setDepth(12).setVisible(false);

    // Triangle tail for message bubble
    const tail = this.add.triangle(cx, cy - 78, -6, 0, 6, 0, 0, 10, 0xffffff, 0)
      .setOrigin(0.5, 0).setDepth(11);

    this.chars[user.name] = { g, nameTag, timerTxt, msgBg, msgTxt, tail };
    this._applyAway(user.name, user.status === 'away');
    if (user.message) this._showMsg(user.name, user.message);
  }

  _drawChar(g, cx, cy, col) {
    g.clear();
    // Chair
    g.fillStyle(0x18183a); g.fillRect(cx - 20, cy - 46, 40, 34);
    g.fillStyle(0x111130); g.fillRect(cx - 16, cy - 14, 32, 8);
    // Body
    g.fillStyle(col);    g.fillRect(cx - 14, cy - 28, 28, 14);
    // Head
    g.fillStyle(0xffcc99); g.fillRect(cx - 10, cy - 52, 20, 22);
    // Hair (darker shade of character color)
    const hair = Math.max(0, col - 0x383838);
    g.fillStyle(hair);   g.fillRect(cx - 10, cy - 52, 20, 8);
    // Eyes
    g.fillStyle(0x222222);
    g.fillRect(cx - 6, cy - 43, 4, 4);
    g.fillRect(cx + 2,  cy - 43, 4, 4);
  }

  _updateChar(user) {
    const c = this.chars[user.name];
    if (!c) return;
    const pos = DESKS[user.desk];
    if (!pos) return;
    this._drawChar(c.g, pos.x, pos.y, hexInt(user.color));
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
    const w = Math.min(200, c.msgTxt.width + 16);
    c.msgBg.setSize(w, 22).setFillStyle(0xffffff, 0.95);
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
    if (this.countTxt) this.countTxt.setText(`${users.length}명 접속 중`);

    const live = new Set(users.map(u => u.name));
    Object.keys(this.chars).forEach(n => { if (!live.has(n)) this._removeChar(n); });
    users.forEach(u => this.chars[u.name] ? this._updateChar(u) : this._addChar(u));

    // Sync our own away state indicator
    const me = users.find(u => u.name === this.myName);
    if (me && this.awayBtn) {
      const isAway = me.status === 'away';
      if (this.isAway !== isAway) {
        this.isAway = isAway;
        this.awayBtn.setFillStyle(isAway ? 0x887700 : 0x443300);
        this.awayTxt.setText(isAway ? '돌아오기' : '자리비움');
      }
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────────

  _tick() {
    const now = Date.now();
    this.users.forEach(u => {
      const c = this.chars[u.name];
      if (!c) return;
      let secs = u.totalToday ?? 0;
      if (u.status === 'working' && u.checkInTime) {
        secs += Math.floor((now - u.checkInTime) / 1000);
      }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      const p = n => String(n).padStart(2, '0');
      c.timerTxt.setText(h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`);
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  _buildUI() {
    // Bottom bar
    this.add.rectangle(0, H - 58, W, 58, 0x090912, 0.96).setOrigin(0).setDepth(20);

    // Online count
    this.countTxt = txt(this, 18, H - 29, '0명 접속 중', 9, '#33bb77')
      .setOrigin(0, 0.5).setDepth(21);

    // Away button
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

    // Checkout button
    const outBtn = this.add.rectangle(W - 110, H - 29, 184, 42, 0x882222)
      .setInteractive({ cursor: 'pointer' }).setDepth(21);
    txt(this, W - 110, H - 29, '퇴근하기', 10, '#ffffff').setOrigin(0.5).setDepth(22);
    outBtn.on('pointerover', () => outBtn.setFillStyle(0xaa3333));
    outBtn.on('pointerout',  () => outBtn.setFillStyle(0x882222));
    outBtn.on('pointerdown', () => {
      this.socket.emit('check_out');
      this.scene.start('Login', { socket: this.socket });
    });

    // Asset swap hint (top-right, small)
    txt(this, W - 12, 8, 'v0.1', 6, '#333355').setOrigin(1, 0).setDepth(21);
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

function pixBtn(scene, x, y, w, h, fill, label, fontSize, textColor, onClick) {
  const btn = scene.add.rectangle(x, y, w, h, fill).setInteractive({ cursor: 'pointer' });
  const t = txt(scene, x, y, label, fontSize, textColor).setOrigin(0.5);
  const lighter = Math.min(0xffffff, fill + 0x222222);
  btn.on('pointerover',  () => btn.setFillStyle(lighter));
  btn.on('pointerout',   () => btn.setFillStyle(fill));
  btn.on('pointerdown',  onClick);
  return { btn, t };
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
  scene: [BootScene, LoginScene, LabScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true },
});

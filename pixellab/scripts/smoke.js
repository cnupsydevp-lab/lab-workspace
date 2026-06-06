const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 18081;
const BASE_HTTP = `http://127.0.0.1:${PORT}`;
const BASE_IO = `${BASE_HTTP}/socket.io/?EIO=4&transport=polling`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pixellab-smoke-'));
const TODOS_FILE = path.join(DATA_DIR, 'todos.json');
const NOTICES_FILE = path.join(DATA_DIR, 'notices.json');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function removeIfExists(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePackets(raw) {
  const packets = [];
  let i = 0;
  while (i < raw.length) {
    const code = raw[i];
    if (code === '0') {
      packets.push({ type: 'open', data: JSON.parse(raw.slice(i + 1)) });
      break;
    }
    if (code === '2') {
      packets.push({ type: 'ping' });
      i += 1;
      continue;
    }
    if (code === '3') {
      packets.push({ type: 'pong' });
      i += 1;
      continue;
    }
    if (code === '4') {
      const next = raw.indexOf('\x1e', i + 1);
      const packet = next === -1 ? raw.slice(i) : raw.slice(i, next);
      if (packet === '40') packets.push({ type: 'connect' });
      if (packet.startsWith('42')) {
        const [event, payload] = JSON.parse(packet.slice(2));
        packets.push({ type: 'event', event, payload });
      }
      if (next === -1) break;
      i = next + 1;
      continue;
    }
    i += 1;
  }
  return packets;
}

class PollingClient {
  constructor(label) {
    this.label = label;
    this.sid = null;
    this.events = [];
  }

  async connect() {
    const openRaw = await (await fetch(`${BASE_IO}&t=${Date.now()}-${this.label}`)).text();
    const open = JSON.parse(openRaw.slice(1));
    this.sid = open.sid;
    await this.post('40');
    await this.poll();
  }

  async post(body) {
    const res = await fetch(`${BASE_IO}&sid=${encodeURIComponent(this.sid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    });
    const text = await res.text();
    assert(res.ok && text === 'ok', `${this.label} post failed: ${res.status} ${text}`);
  }

  async emit(event, payload = {}) {
    await this.post(`42${JSON.stringify([event, payload])}`);
  }

  async poll() {
    const res = await fetch(`${BASE_IO}&sid=${encodeURIComponent(this.sid)}&t=${Date.now()}-${Math.random()}`);
    const raw = await res.text();
    const packets = parsePackets(raw);
    packets.forEach(packet => {
      if (packet.type === 'event') this.events.push(packet);
    });
    return packets;
  }

  async waitFor(event, predicate = () => true, timeoutMs = 3000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const found = this.events.find(packet => packet.event === event && predicate(packet.payload));
      if (found) return found.payload;
      await this.poll();
      await wait(40);
    }
    throw new Error(`${this.label} timed out waiting for ${event}`);
  }
}

async function waitForHttp() {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    try {
      const res = await fetch(BASE_HTTP);
      if (res.ok) return;
    } catch {
      await wait(100);
    }
  }
  throw new Error('server did not become ready');
}

async function main() {
  removeIfExists(TODOS_FILE);
  removeIfExists(NOTICES_FILE);

  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), PIXELLAB_DATA_DIR: DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  server.stderr.on('data', chunk => { stderr += chunk.toString(); });

  try {
    await waitForHttp();

    const a = new PollingClient('A');
    const b = new PollingClient('B');
    await a.connect();
    await b.connect();

    await a.waitFor('todos_sync', todos => Array.isArray(todos) && todos.length >= 3);

    await a.emit('check_in', { name: 'SmokeA' });
    await b.emit('check_in', { name: 'SmokeB' });
    await a.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && typeof user.arrivedAt === 'number'));
    await b.waitFor('state_sync', users => users.some(user => user.name === 'SmokeB'));

    await a.emit('set_status', { status: 'meeting' });
    await a.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && user.status === 'meeting'));

    await a.emit('set_bubble', { message: 'smoke bubble' });
    await b.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && user.message === 'smoke bubble'));

    await a.emit('send_direct_message', { to: 'SmokeB', message: 'hello smoke' });
    await b.waitFor('direct_message', msg => msg.from === 'SmokeA' && msg.message === 'hello smoke');

    await a.emit('todo_add', { text: 'Smoke todo', owner: 'SmokeA', due: '2026-06-03' });
    const todos = await a.waitFor('todos_sync', items => items.some(item => item.text === 'Smoke todo'));
    const todo = todos.find(item => item.text === 'Smoke todo');
    await a.emit('todo_toggle', { id: todo.id, done: true });
    await a.waitFor('todos_sync', items => items.some(item => item.id === todo.id && item.done === true));
    await a.emit('todo_update', { id: todo.id, text: 'Smoke todo edited', owner: 'Smoke team', due: '오늘' });
    await a.waitFor('todos_sync', items => items.some(item =>
      item.id === todo.id &&
      item.text === 'Smoke todo edited' &&
      item.owner === 'Smoke team' &&
      item.due === '오늘'
    ));
    await a.emit('todo_delete', { id: todo.id });
    await a.waitFor('todos_sync', items => !items.some(item => item.id === todo.id));

    await a.emit('notice_add', { title: 'Smoke notice', body: 'notice body' });
    const notices = await a.waitFor('notices_sync', items => items.some(item => item.title === 'Smoke notice'));
    const notice = notices.find(item => item.title === 'Smoke notice');
    await a.emit('notice_delete', { id: notice.id });
    await a.waitFor('notices_sync', items => !items.some(item => item.id === notice.id));

    await a.emit('check_out');
    await b.emit('check_out');

    console.log('Smoke test passed');
  } finally {
    server.kill();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    if (stderr.trim()) console.error(stderr.trim());
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

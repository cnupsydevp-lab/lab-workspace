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
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const ACCESS_CODE = 'smoke-access';

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
      if (packet.startsWith('43')) {
        const match = packet.match(/^43(\d+)(.*)$/);
        if (match) {
          const payload = JSON.parse(match[2]);
          packets.push({ type: 'ack', id: Number(match[1]), payload: payload[0] });
        }
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
  constructor(label, accessCode = ACCESS_CODE) {
    this.label = label;
    this.accessCode = accessCode;
    this.sid = null;
    this.events = [];
    this.acks = new Map();
    this.nextAckId = 1;
  }

  async connect() {
    const openRaw = await (await fetch(`${BASE_IO}&t=${Date.now()}-${this.label}`)).text();
    const open = JSON.parse(openRaw.slice(1));
    this.sid = open.sid;
    const auth = this.accessCode ? JSON.stringify({ accessCode: this.accessCode }) : '';
    await this.post(`40${auth}`);
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

  async emitWithAck(event, payload, timeoutMs = 3000) {
    const id = this.nextAckId++;
    const args = payload === undefined ? [event] : [event, payload];
    await this.post(`42${id}${JSON.stringify(args)}`);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.acks.has(id)) {
        const result = this.acks.get(id);
        this.acks.delete(id);
        return result;
      }
      await this.poll();
      await wait(40);
    }
    throw new Error(`${this.label} timed out waiting for ack ${event}`);
  }

  async poll() {
    const res = await fetch(`${BASE_IO}&sid=${encodeURIComponent(this.sid)}&t=${Date.now()}-${Math.random()}`);
    const raw = await res.text();
    const packets = parsePackets(raw);
    packets.forEach(packet => {
      if (packet.type === 'event') this.events.push(packet);
      if (packet.type === 'ack') this.acks.set(packet.id, packet.payload);
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
  removeIfExists(MESSAGES_FILE);

  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), PIXELLAB_DATA_DIR: DATA_DIR, PIXELLAB_ACCESS_CODE: ACCESS_CODE },
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
    a.events = [];
    await a.emit('workspace_sync_request');
    await a.waitFor('todos_sync', todos => Array.isArray(todos) && todos.length >= 3);
    await a.waitFor('notices_sync', notices => Array.isArray(notices) && notices.length >= 2);

    await a.emit('check_in', { name: 'SmokeA' });
    await b.emit('check_in', { name: 'SmokeB' });
    await a.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && typeof user.arrivedAt === 'number'));
    await b.waitFor('state_sync', users => users.some(user => user.name === 'SmokeB'));

    await a.emit('set_status', { status: 'meeting' });
    await a.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && user.status === 'meeting'));

    const bubbleAck = await a.emitWithAck('set_bubble', { message: 'smoke bubble' });
    assert(bubbleAck?.ok === true, 'set_bubble ack failed');
    await b.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && user.message === 'smoke bubble'));
    b.events = [];
    const clearBubbleAck = await a.emitWithAck('clear_bubble');
    assert(clearBubbleAck?.ok === true, 'clear_bubble ack failed');
    await b.waitFor('state_sync', users => users.some(user => user.name === 'SmokeA' && !user.message));

    const missingTargetAck = await a.emitWithAck('send_direct_message', { to: 'Missing', message: 'should fail' });
    assert(missingTargetAck?.ok === false, 'missing direct-message target should fail');
    const directAck = await a.emitWithAck('send_direct_message', { to: 'SmokeB', message: 'hello smoke' });
    assert(directAck?.ok === true, 'send_direct_message ack failed');
    await b.waitFor('direct_message', msg => msg.from === 'SmokeA' && msg.message === 'hello smoke');

    await b.emit('check_out');
    await a.waitFor('state_sync', users => !users.some(user => user.name === 'SmokeB'));
    const b2 = new PollingClient('B2');
    await b2.connect();
    await b2.emit('check_in', { name: 'SmokeB' });
    await b2.waitFor('direct_messages_sync', messages =>
      Array.isArray(messages) &&
      messages.some(msg => msg.from === 'SmokeA' && msg.to === 'SmokeB' && msg.message === 'hello smoke')
    );

    const todoAddAck = await a.emitWithAck('todo_add', { text: 'Smoke todo', owner: 'SmokeA', due: '2026-06-03' });
    assert(todoAddAck?.ok === true, 'todo_add ack failed');
    const todos = await a.waitFor('todos_sync', items => items.some(item => item.text === 'Smoke todo'));
    const todo = todos.find(item => item.text === 'Smoke todo');
    const todoToggleAck = await a.emitWithAck('todo_toggle', { id: todo.id, done: true });
    assert(todoToggleAck?.ok === true, 'todo_toggle ack failed');
    await a.waitFor('todos_sync', items => items.some(item => item.id === todo.id && item.done === true));
    const todoUpdateAck = await a.emitWithAck('todo_update', { id: todo.id, text: 'Smoke todo edited', owner: 'Smoke team', due: '오늘' });
    assert(todoUpdateAck?.ok === true, 'todo_update ack failed');
    await a.waitFor('todos_sync', items => items.some(item =>
      item.id === todo.id &&
      item.text === 'Smoke todo edited' &&
      item.owner === 'Smoke team' &&
      item.due === '오늘'
    ));
    const todoDeleteAck = await a.emitWithAck('todo_delete', { id: todo.id });
    assert(todoDeleteAck?.ok === true, 'todo_delete ack failed');
    await a.waitFor('todos_sync', items => !items.some(item => item.id === todo.id));

    const noticeAddAck = await a.emitWithAck('notice_add', { title: 'Smoke notice', body: 'notice body' });
    assert(noticeAddAck?.ok === true, 'notice_add ack failed');
    const notices = await a.waitFor('notices_sync', items => items.some(item => item.title === 'Smoke notice'));
    const notice = notices.find(item => item.title === 'Smoke notice');
    const noticeDeleteAck = await a.emitWithAck('notice_delete', { id: notice.id });
    assert(noticeDeleteAck?.ok === true, 'notice_delete ack failed');
    await a.waitFor('notices_sync', items => !items.some(item => item.id === notice.id));

    await a.emit('check_out');
    await b2.emit('check_out');

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

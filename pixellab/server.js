/**
 * PixelLab server.
 *
 * Express serves the Phaser client from public/, and Socket.io keeps the
 * lab presence state in sync. Operational data can be stored in local JSON
 * files for development or Firestore for Cloud Run operation.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { createStorage } = require('./storage');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.PIXELLAB_DATA_DIR || path.join(__dirname, 'data');

app.use(express.static(path.join(__dirname, 'public')));

const COLORS = [
  '#E05252',
  '#5271E0',
  '#52C87A',
  '#A052E0',
  '#E09052',
  '#E052B8',
  '#52D4E0',
  '#C8D452',
];

const MAX_DESKS = 6;
const ACTIVE_STATUSES = new Set(['working', 'away', 'meeting', 'experiment']);
const DEFAULT_TODOS = [
  { text: '실험실 공지 확인하기', owner: '랩 공통' },
  { text: '오늘 진행할 분석 작업 정리하기', owner: '랩 공통' },
  { text: '회의 전 공유 자료 업데이트하기', owner: '랩 공통' },
];
const DEFAULT_NOTICES = [
  { title: '오늘 공지', body: '실험실 공용 PC 사용 후 로그아웃을 확인해 주세요.' },
  { title: '세미나 준비', body: '세미나 자료는 시작 30분 전까지 공유 폴더에 올려주세요.' },
];

const users = {};
const desks = new Array(MAX_DESKS).fill(null);
let storage = null;
let profiles = {};
let todos = [];
let notices = [];
let directMessages = [];

function cleanName(name) {
  return String(name ?? '').trim().slice(0, 8);
}

function cleanText(text, limit = 80) {
  return String(text ?? '').trim().slice(0, limit);
}

function activeProfileNames() {
  return new Set(Object.values(users).map(u => u.name));
}

function assignColor(existingProfile) {
  if (existingProfile?.color && COLORS.includes(existingProfile.color)) return existingProfile.color;

  const used = new Set([
    ...Object.values(users).map(u => u.color),
    ...Object.values(profiles).map(p => p.color).filter(Boolean),
  ]);
  return COLORS.find(c => !used.has(c)) ?? COLORS[Math.floor(Math.random() * COLORS.length)];
}

function freeDesk(preferredDesk) {
  if (
    Number.isInteger(preferredDesk) &&
    preferredDesk >= 0 &&
    preferredDesk < MAX_DESKS &&
    desks[preferredDesk] === null
  ) {
    return preferredDesk;
  }
  return desks.indexOf(null);
}

function normalizeStatus(status) {
  return ACTIVE_STATUSES.has(status) ? status : 'working';
}

function publicProfile(profile) {
  if (!profile) return null;
  return {
    name: profile.name,
    color: profile.color,
    preferredDesk: profile.preferredDesk,
    lastStatus: profile.lastStatus,
    lastSeen: profile.lastSeen,
  };
}

function snapshot() {
  return Object.values(users).map(u => ({
    name: u.name,
    color: u.color,
    desk: u.desk,
    status: u.status,
    arrivedAt: u.arrivedAt,
    checkInTime: u.checkInTime,
    totalToday: u.totalToday,
    message: u.message,
    x: u.x,
    y: u.y,
  }));
}

async function updateProfile(name, patch) {
  const now = new Date().toISOString();
  const existing = profiles[name] ?? { name, createdAt: now };
  profiles[name] = {
    ...existing,
    ...patch,
    name,
    updatedAt: now,
  };
  await storage.saveProfiles(profiles);
  return profiles[name];
}

function accumulateWorkingTime(user) {
  if (user.status === 'working' && user.checkInTime) {
    user.totalToday += Math.floor((Date.now() - user.checkInTime) / 1000);
  }
}

async function checkout(socketId, lastStatus = 'done') {
  const user = users[socketId];
  if (!user) return false;

  accumulateWorkingTime(user);
  if (user.msgTimer) clearTimeout(user.msgTimer);

  desks[user.desk] = null;
  await updateProfile(user.name, {
    color: user.color,
    preferredDesk: user.preferredDesk,
    lastStatus,
    lastSeen: new Date().toISOString(),
  });
  delete users[socketId];
  return true;
}

async function setUserStatus(socketId, status) {
  const user = users[socketId];
  if (!user) return false;

  const nextStatus = normalizeStatus(status);
  if (user.status === nextStatus) return false;

  if (user.status === 'working') accumulateWorkingTime(user);
  user.status = nextStatus;
  user.checkInTime = nextStatus === 'working' ? Date.now() : null;

  await updateProfile(user.name, {
    color: user.color,
    preferredDesk: user.preferredDesk,
    lastStatus: nextStatus,
    lastSeen: new Date().toISOString(),
  });

  return true;
}

function findUserByName(name) {
  return Object.entries(users).find(([, user]) => user.name === name) ?? null;
}

function publishTodos() {
  io.emit('todos_sync', todos);
}

function publishNotices() {
  io.emit('notices_sync', notices);
}

function sendWorkspaceSync(socket) {
  socket.emit('state_sync', snapshot());
  socket.emit('todos_sync', todos);
  socket.emit('notices_sync', notices);

  const user = users[socket.id];
  if (user) socket.emit('direct_messages_sync', recentMessagesFor(user.name));
}

function recentMessagesFor(name) {
  return directMessages.filter(message => message.from === name || message.to === name).slice(-50);
}

async function saveDirectMessage(message) {
  directMessages.push(message);
  directMessages = directMessages.slice(-200);
  await storage.appendMessage(directMessages, message);
}

function handleSocketError(socket, err) {
  console.error(err);
  socket.emit('lab_error', 'Storage operation failed. Please try again.');
}

io.on('connection', (socket) => {
  sendWorkspaceSync(socket);

  socket.on('workspace_sync_request', () => {
    sendWorkspaceSync(socket);
  });

  socket.on('check_in', async ({ name }) => {
    try {
    if (users[socket.id]) return;

    const clean = cleanName(name);
    if (!clean) {
      socket.emit('lab_error', '닉네임을 입력해주세요');
      return;
    }

    if (activeProfileNames().has(clean)) {
      socket.emit('lab_error', '이미 사용 중인 닉네임이에요');
      return;
    }

    const existingProfile = profiles[clean];
    const desk = freeDesk(existingProfile?.preferredDesk);
    if (desk === -1) {
      socket.emit('lab_error', '자리가 꽉 찼어요! (최대 6명)');
      return;
    }

    const color = assignColor(existingProfile);
    const preferredDesk = Number.isInteger(existingProfile?.preferredDesk) ? existingProfile.preferredDesk : desk;
    const checkedInAt = Date.now();
    users[socket.id] = {
      name: clean,
      color,
      desk,
      preferredDesk,
      status: 'working',
      arrivedAt: checkedInAt,
      checkInTime: checkedInAt,
      totalToday: 0,
      message: null,
      msgTimer: null,
      x: null,
      y: null,
    };
    desks[desk] = socket.id;

    const profile = await updateProfile(clean, {
      color,
      preferredDesk,
      lastStatus: 'working',
      lastSeen: new Date().toISOString(),
    });

    socket.emit('check_in_ok', { name: clean, profile: publicProfile(profile) });
    socket.emit('direct_messages_sync', recentMessagesFor(clean));
    io.emit('state_sync', snapshot());
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('check_out', async () => {
    try {
      if (await checkout(socket.id, 'done')) io.emit('state_sync', snapshot());
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('set_status', async ({ status }) => {
    try {
      if (await setUserStatus(socket.id, status)) io.emit('state_sync', snapshot());
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('set_away', async () => {
    try {
      if (await setUserStatus(socket.id, 'away')) io.emit('state_sync', snapshot());
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('set_back', async () => {
    try {
      if (await setUserStatus(socket.id, 'working')) io.emit('state_sync', snapshot());
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('set_bubble', ({ message }) => {
    const user = users[socket.id];
    if (!user || !message) return;

    if (user.msgTimer) clearTimeout(user.msgTimer);

    user.message = cleanText(message, 32);
    io.emit('state_sync', snapshot());
  });

  socket.on('clear_bubble', () => {
    const user = users[socket.id];
    if (!user) return;
    if (user.msgTimer) clearTimeout(user.msgTimer);
    user.message = null;
    io.emit('state_sync', snapshot());
  });

  socket.on('send_message', ({ message }) => {
    const user = users[socket.id];
    if (!user || !message) return;

    if (user.msgTimer) clearTimeout(user.msgTimer);

    user.message = cleanText(message, 32);
    io.emit('state_sync', snapshot());

    user.msgTimer = setTimeout(() => {
      if (users[socket.id]) {
        users[socket.id].message = null;
        io.emit('state_sync', snapshot());
      }
    }, 5000);
  });

  socket.on('move', ({ x, y }) => {
    const user = users[socket.id];
    if (!user || typeof x !== 'number' || typeof y !== 'number') return;
    user.x = x;
    user.y = y;
    socket.broadcast.emit('player_move', { name: user.name, x, y });
  });

  socket.on('send_direct_message', async ({ to, message }) => {
    try {
    const fromUser = users[socket.id];
    const text = cleanText(message, 160);
    const targetName = cleanName(to);
    if (!fromUser || !targetName || !text) return;

    const target = findUserByName(targetName);
    if (!target) {
      socket.emit('lab_error', '메시지를 보낼 상대가 출근 중이 아니에요');
      return;
    }

    const [targetSocketId, targetUser] = target;
    const payload = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      from: fromUser.name,
      to: targetUser.name,
      message: text,
      at: new Date().toISOString(),
    };
    await saveDirectMessage(payload);
    socket.emit('direct_message', { ...payload, direction: 'sent' });
    io.to(targetSocketId).emit('direct_message', { ...payload, direction: 'received' });
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('todo_add', async ({ text, owner, due }) => {
    try {
    const user = users[socket.id];
    const clean = cleanText(text, 100);
    if (!clean) return;

    todos.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      text: clean,
      owner: cleanText(owner, 24) || user?.name || '랩 공통',
      due: cleanText(due, 20),
      done: false,
      createdAt: new Date().toISOString(),
    });
    await storage.saveTodos(todos);
    publishTodos();
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('notice_add', async ({ title, body }) => {
    try {
    const user = users[socket.id];
    const cleanTitle = cleanText(title, 60);
    const cleanBody = cleanText(body, 240);
    if (!cleanTitle && !cleanBody) return;

    notices.unshift({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title: cleanTitle || '공지',
      body: cleanBody,
      author: user?.name ?? '랩 공통',
      createdAt: new Date().toISOString(),
    });
    await storage.saveNotices(notices);
    publishNotices();
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('notice_delete', async ({ id }) => {
    try {
    const before = notices.length;
    notices = notices.filter(item => item.id !== id);
    if (notices.length === before) return;
    await storage.saveNotices(notices);
    publishNotices();
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('todo_toggle', async ({ id, done }) => {
    try {
    const todo = todos.find(item => item.id === id);
    if (!todo) return;
    todo.done = Boolean(done);
    todo.updatedAt = new Date().toISOString();
    await storage.saveTodos(todos);
    publishTodos();
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('todo_update', async ({ id, text, owner, due }) => {
    try {
    const todo = todos.find(item => item.id === id);
    const clean = cleanText(text, 100);
    if (!todo || !clean) return;

    todo.text = clean;
    todo.owner = cleanText(owner, 24) || '랩 공통';
    todo.due = cleanText(due, 24);
    todo.updatedAt = new Date().toISOString();
    await storage.saveTodos(todos);
    publishTodos();
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('todo_delete', async ({ id }) => {
    try {
    const before = todos.length;
    todos = todos.filter(item => item.id !== id);
    if (todos.length === before) return;
    await storage.saveTodos(todos);
    publishTodos();
    } catch (err) {
      handleSocketError(socket, err);
    }
  });

  socket.on('disconnect', async () => {
    try {
      if (await checkout(socket.id, 'disconnected')) io.emit('state_sync', snapshot());
    } catch (err) {
      console.error(err);
    }
  });
});

async function start() {
  storage = createStorage({ dataDir: DATA_DIR });
  profiles = await storage.loadProfiles();
  todos = await storage.loadTodos(DEFAULT_TODOS);
  notices = await storage.loadNotices(DEFAULT_NOTICES);
  directMessages = (await storage.loadMessages()).slice(-200);
  httpServer.listen(PORT, () => console.log(`PixelLab server running on port ${PORT}`));
}

start().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

/**
 * PixelLab server.
 *
 * Express serves the Phaser client from public/, and Socket.io keeps the
 * lab presence state in sync. Lightweight user profiles are persisted to
 * pixellab/data/profiles.json so returning members keep their color and
 * preferred desk after a server restart.
 */

const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

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

const users = {};
const desks = new Array(MAX_DESKS).fill(null);
let profiles = loadProfiles();

function loadProfiles() {
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Could not load profiles: ${err.message}`);
    return {};
  }
}

function saveProfiles() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PROFILES_FILE, `${JSON.stringify(profiles, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.warn(`Could not save profiles: ${err.message}`);
  }
}

function cleanName(name) {
  return String(name ?? '').trim().slice(0, 8);
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
    checkInTime: u.checkInTime,
    totalToday: u.totalToday,
    message: u.message,
  }));
}

function updateProfile(name, patch) {
  const now = new Date().toISOString();
  const existing = profiles[name] ?? { name, createdAt: now };
  profiles[name] = {
    ...existing,
    ...patch,
    name,
    updatedAt: now,
  };
  saveProfiles();
  return profiles[name];
}

function accumulateWorkingTime(user) {
  if (user.status === 'working' && user.checkInTime) {
    user.totalToday += Math.floor((Date.now() - user.checkInTime) / 1000);
  }
}

function checkout(socketId, lastStatus = 'done') {
  const user = users[socketId];
  if (!user) return false;

  accumulateWorkingTime(user);
  if (user.msgTimer) clearTimeout(user.msgTimer);

  desks[user.desk] = null;
  updateProfile(user.name, {
    color: user.color,
    preferredDesk: user.preferredDesk,
    lastStatus,
    lastSeen: new Date().toISOString(),
  });
  delete users[socketId];
  return true;
}

function setUserStatus(socketId, status) {
  const user = users[socketId];
  if (!user) return false;

  const nextStatus = normalizeStatus(status);
  if (user.status === nextStatus) return false;

  if (user.status === 'working') accumulateWorkingTime(user);
  user.status = nextStatus;
  user.checkInTime = nextStatus === 'working' ? Date.now() : null;

  updateProfile(user.name, {
    color: user.color,
    preferredDesk: user.preferredDesk,
    lastStatus: nextStatus,
    lastSeen: new Date().toISOString(),
  });

  return true;
}

io.on('connection', (socket) => {
  socket.emit('state_sync', snapshot());

  socket.on('check_in', ({ name }) => {
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
    users[socket.id] = {
      name: clean,
      color,
      desk,
      preferredDesk,
      status: 'working',
      checkInTime: Date.now(),
      totalToday: 0,
      message: null,
      msgTimer: null,
    };
    desks[desk] = socket.id;

    const profile = updateProfile(clean, {
      color,
      preferredDesk,
      lastStatus: 'working',
      lastSeen: new Date().toISOString(),
    });

    socket.emit('check_in_ok', { name: clean, profile: publicProfile(profile) });
    io.emit('state_sync', snapshot());
  });

  socket.on('check_out', () => {
    if (checkout(socket.id, 'done')) io.emit('state_sync', snapshot());
  });

  socket.on('set_status', ({ status }) => {
    if (setUserStatus(socket.id, status)) io.emit('state_sync', snapshot());
  });

  socket.on('set_away', () => {
    if (setUserStatus(socket.id, 'away')) io.emit('state_sync', snapshot());
  });

  socket.on('set_back', () => {
    if (setUserStatus(socket.id, 'working')) io.emit('state_sync', snapshot());
  });

  socket.on('send_message', ({ message }) => {
    const user = users[socket.id];
    if (!user || !message) return;

    if (user.msgTimer) clearTimeout(user.msgTimer);

    user.message = String(message).trim().slice(0, 20);
    io.emit('state_sync', snapshot());

    user.msgTimer = setTimeout(() => {
      if (users[socket.id]) {
        users[socket.id].message = null;
        io.emit('state_sync', snapshot());
      }
    }, 5000);
  });

  socket.on('disconnect', () => {
    if (checkout(socket.id, 'disconnected')) io.emit('state_sync', snapshot());
  });
});

httpServer.listen(PORT, () => console.log(`PixelLab server running on port ${PORT}`));

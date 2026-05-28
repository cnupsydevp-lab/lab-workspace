const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));

const COLORS = [
  '#E05252', '#5271E0', '#52C87A', '#A052E0',
  '#E09052', '#E052B8', '#52D4E0', '#C8D452',
];
const MAX_DESKS = 6;

const users = {};
const desks = new Array(MAX_DESKS).fill(null);

function assignColor() {
  const used = new Set(Object.values(users).map(u => u.color));
  return COLORS.find(c => !used.has(c)) ?? COLORS[Math.floor(Math.random() * COLORS.length)];
}

function freeDesk() {
  return desks.indexOf(null);
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

io.on('connection', (socket) => {
  socket.emit('state_sync', snapshot());

  socket.on('check_in', ({ name }) => {
    if (users[socket.id]) return;
    const desk = freeDesk();
    if (desk === -1) { socket.emit('lab_error', '자리가 꽉 찼어요! (최대 6명)'); return; }

    users[socket.id] = {
      name: String(name).slice(0, 8),
      color: assignColor(),
      desk,
      status: 'working',
      checkInTime: Date.now(),
      totalToday: 0,
      message: null,
      msgTimer: null,
    };
    desks[desk] = socket.id;
    io.emit('state_sync', snapshot());
  });

  socket.on('check_out', () => {
    const u = users[socket.id];
    if (!u) return;
    if (u.status === 'working' && u.checkInTime) {
      u.totalToday += Math.floor((Date.now() - u.checkInTime) / 1000);
    }
    if (u.msgTimer) clearTimeout(u.msgTimer);
    desks[u.desk] = null;
    delete users[socket.id];
    io.emit('state_sync', snapshot());
  });

  socket.on('set_away', () => {
    const u = users[socket.id];
    if (!u || u.status === 'away') return;
    if (u.checkInTime) u.totalToday += Math.floor((Date.now() - u.checkInTime) / 1000);
    u.checkInTime = null;
    u.status = 'away';
    io.emit('state_sync', snapshot());
  });

  socket.on('set_back', () => {
    const u = users[socket.id];
    if (!u || u.status !== 'away') return;
    u.status = 'working';
    u.checkInTime = Date.now();
    io.emit('state_sync', snapshot());
  });

  socket.on('send_message', ({ message }) => {
    const u = users[socket.id];
    if (!u || !message) return;
    if (u.msgTimer) clearTimeout(u.msgTimer);
    u.message = String(message).slice(0, 20);
    io.emit('state_sync', snapshot());
    u.msgTimer = setTimeout(() => {
      if (users[socket.id]) {
        users[socket.id].message = null;
        io.emit('state_sync', snapshot());
      }
    }, 5000);
  });

  socket.on('disconnect', () => {
    const u = users[socket.id];
    if (!u) return;
    if (u.msgTimer) clearTimeout(u.msgTimer);
    desks[u.desk] = null;
    delete users[socket.id];
    io.emit('state_sync', snapshot());
  });
});

httpServer.listen(PORT, () => console.log(`PixelLab on :${PORT}`));

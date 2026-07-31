const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const express = require('express');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);

  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Track room participants state in memory
  const roomParticipants = new Map(); // roomId -> Map(socketId, participantInfo)

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join meeting room
    socket.on('join-room', ({ roomId, userId, name, peerId }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.peerId = peerId;
      socket.userName = name;
      socket.userId = userId;

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Map());
      }

      const room = roomParticipants.get(roomId);
      const participantInfo = {
        socketId: socket.id,
        peerId,
        userId,
        name,
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        joinedAt: new Date().toISOString()
      };
      
      room.set(socket.id, participantInfo);

      // Notify others in the room about new peer
      socket.to(roomId).emit('user-joined', participantInfo);

      // Send existing participants list to the newly connected user
      const activeList = Array.from(room.values());
      socket.emit('room-participants', activeList);

      console.log(`[Room ${roomId}] User "${name}" joined with peerId: ${peerId}`);
    });

    // Toggle Mic state
    socket.on('toggle-audio', ({ isMuted }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      if (room.has(socket.id)) {
        room.get(socket.id).isMuted = isMuted;
        io.to(roomId).emit('participant-updated', room.get(socket.id));
      }
    });

    // Toggle Video state
    socket.on('toggle-video', ({ isVideoOff }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      if (room.has(socket.id)) {
        room.get(socket.id).isVideoOff = isVideoOff;
        io.to(roomId).emit('participant-updated', room.get(socket.id));
      }
    });

    // Screen sharing state
    socket.on('toggle-screen-share', ({ isScreenSharing }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      if (room.has(socket.id)) {
        room.get(socket.id).isScreenSharing = isScreenSharing;
        io.to(roomId).emit('screen-share-changed', {
          socketId: socket.id,
          peerId: socket.peerId,
          name: socket.userName,
          isScreenSharing
        });
      }
    });

    // Send Chat Message
    socket.on('send-message', ({ roomId, message }) => {
      const msgPayload = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        senderName: socket.userName || message.senderName || 'Anonymous',
        text: message.text,
        createdAt: new Date().toISOString()
      };
      io.to(roomId).emit('new-message', msgPayload);
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId && roomParticipants.has(roomId)) {
        const room = roomParticipants.get(roomId);
        room.delete(socket.id);
        if (room.size === 0) {
          roomParticipants.delete(roomId);
        } else {
          io.to(roomId).emit('user-left', { socketId: socket.id, peerId: socket.peerId, name: socket.userName });
        }
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Next.js page handler
  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> EventConnect Server ready on http://${hostname}:${port}`);
  });
});

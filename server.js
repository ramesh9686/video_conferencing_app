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

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  // Memory state stores per room
  const roomParticipants = new Map(); // roomId -> Map(socketId, participantInfo)
  const roomPolls = new Map();        // roomId -> Array(pollObject)
  const roomQuestions = new Map();    // roomId -> Array(questionObject)

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userId, name, peerId, role }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.peerId = peerId;
      socket.userName = name;
      socket.userId = userId;
      socket.userRole = role || 'ATTENDEE';

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Map());
      }
      if (!roomPolls.has(roomId)) {
        roomPolls.set(roomId, []);
      }
      if (!roomQuestions.has(roomId)) {
        roomQuestions.set(roomId, []);
      }

      const room = roomParticipants.get(roomId);
      const participantInfo = {
        socketId: socket.id,
        peerId,
        userId,
        name,
        role: socket.userRole,
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString()
      };
      
      room.set(socket.id, participantInfo);

      // Broadcast to room
      socket.to(roomId).emit('user-joined', participantInfo);

      // Send current state to newly joined user
      socket.emit('room-participants', Array.from(room.values()));
      socket.emit('room-polls', roomPolls.get(roomId));
      socket.emit('room-questions', roomQuestions.get(roomId));
    });

    // Toggle Audio
    socket.on('toggle-audio', ({ isMuted }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      if (room.has(socket.id)) {
        room.get(socket.id).isMuted = isMuted;
        io.to(roomId).emit('participant-updated', room.get(socket.id));
      }
    });

    // Toggle Video
    socket.on('toggle-video', ({ isVideoOff }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      if (room.has(socket.id)) {
        room.get(socket.id).isVideoOff = isVideoOff;
        io.to(roomId).emit('participant-updated', room.get(socket.id));
      }
    });

    // Toggle Raise Hand
    socket.on('toggle-hand', ({ isHandRaised }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      if (room.has(socket.id)) {
        room.get(socket.id).isHandRaised = isHandRaised;
        io.to(roomId).emit('participant-updated', room.get(socket.id));
      }
    });

    // Broadcast Floating Emoji Reaction
    socket.on('send-reaction', ({ emoji }) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      io.to(roomId).emit('new-reaction', {
        id: 'react-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        emoji,
        senderName: socket.userName || 'Someone'
      });
    });

    // Host Mute All Participants
    socket.on('host-mute-all', () => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants.has(roomId)) return;
      const room = roomParticipants.get(roomId);
      
      room.forEach((p) => {
        if (p.role !== 'HOST') {
          p.isMuted = true;
        }
      });
      io.to(roomId).emit('room-participants', Array.from(room.values()));
      socket.to(roomId).emit('force-mute');
    });

    // Live Polls
    socket.on('create-poll', ({ question, options }) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      const polls = roomPolls.get(roomId) || [];
      const newPoll = {
        id: 'poll-' + Date.now(),
        question,
        options: options.map((opt, i) => ({ id: i, text: opt, votes: 0, voters: [] })),
        createdByName: socket.userName || 'Host',
        createdAt: new Date().toISOString()
      };
      polls.unshift(newPoll);
      roomPolls.set(roomId, polls);
      io.to(roomId).emit('room-polls', polls);
    });

    socket.on('vote-poll', ({ pollId, optionId }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomPolls.has(roomId)) return;
      const polls = roomPolls.get(roomId);
      const poll = polls.find((p) => p.id === pollId);
      if (poll) {
        // Remove previous vote if any
        poll.options.forEach((opt) => {
          opt.voters = opt.voters.filter((vId) => vId !== socket.id);
          opt.votes = opt.voters.length;
        });
        const option = poll.options.find((o) => o.id === optionId);
        if (option) {
          option.voters.push(socket.id);
          option.votes = option.voters.length;
        }
        io.to(roomId).emit('room-polls', polls);
      }
    });

    // Q&A
    socket.on('submit-question', ({ text }) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      const questions = roomQuestions.get(roomId) || [];
      const newQ = {
        id: 'q-' + Date.now(),
        text,
        senderName: socket.userName || 'Anonymous',
        upvotes: 0,
        upvoters: [],
        isAnswered: false,
        createdAt: new Date().toISOString()
      };
      questions.unshift(newQ);
      roomQuestions.set(roomId, questions);
      io.to(roomId).emit('room-questions', questions);
    });

    socket.on('upvote-question', ({ questionId }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomQuestions.has(roomId)) return;
      const questions = roomQuestions.get(roomId);
      const q = questions.find((item) => item.id === questionId);
      if (q) {
        const hasVoted = q.upvoters.includes(socket.id);
        if (hasVoted) {
          q.upvoters = q.upvoters.filter((id) => id !== socket.id);
        } else {
          q.upvoters.push(socket.id);
        }
        q.upvotes = q.upvoters.length;
        io.to(roomId).emit('room-questions', questions);
      }
    });

    socket.on('answer-question', ({ questionId }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomQuestions.has(roomId)) return;
      const questions = roomQuestions.get(roomId);
      const q = questions.find((item) => item.id === questionId);
      if (q) {
        q.isAnswered = !q.isAnswered;
        io.to(roomId).emit('room-questions', questions);
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
          roomPolls.delete(roomId);
          roomQuestions.delete(roomId);
        } else {
          io.to(roomId).emit('user-left', { socketId: socket.id, peerId: socket.peerId, name: socket.userName });
        }
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> EventConnect Server ready on http://${hostname}:${port}`);
  });
});

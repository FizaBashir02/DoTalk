import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { db } from './utils/db.js';

import authRouter from './routes/auth.routes.js';
import profileRouter from './routes/profile.routes.js';
import userRouter from './routes/user.routes.js';
import chatRouter from './routes/chat.routes.js';
import statusRouter from './routes/status.routes.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // ---------------- CORS + BODY ----------------
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // ---------------- SOCKET IO ----------------
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // ⚠️ safer structure (prevents memory leak issues later)
  const activeSockets = new Map<string, string>();

  io.on('connection', (socket) => {
    console.log(`[Sockets] Connected: ${socket.id}`);

    socket.on('register_user', (userId: string) => {
      activeSockets.set(socket.id, userId);

      db.updateUser(userId, { onlineStatus: 'online' });

      io.emit('user_status_changed', {
        userId,
        status: 'online'
      });
    });

    socket.on('join_chat', (chatId: string) => socket.join(chatId));
    socket.on('leave_chat', (chatId: string) => socket.leave(chatId));

    socket.on('typing', (data) => {
      socket.to(data.chatId).emit('user_typing', data);
    });

    socket.on('send_message', (data) => {
      const chat = db.getChatById(data.chatId);
      if (!chat) return;

      let replyText = '';

      if (data.replyToMessageId) {
        const parentMsg = db
          .getMessagesForChat(data.chatId)
          .find(m => m._id === data.replyToMessageId);

        replyText = parentMsg?.text || 'Media attachment';
      }

      const newMessage = db.createMessage({
        chatId: data.chatId,
        senderId: data.senderId,
        senderName: db.findUserById(data.senderId)?.fullName || data.senderName,
        text: data.text || '',
        reactions: [],
        replyToMessageId: data.replyToMessageId,
        replyToMessageText: replyText,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        mediaName: data.mediaName,
        mediaSize: data.mediaSize,
        isDeletedForEveryone: false,
        isEdited: false,
        deliveredTo: [data.senderId],
        seenBy: [data.senderId]
      });

      io.to(data.chatId).emit('new_message', newMessage);

      io.emit('chat_list_update', {
        chatId: data.chatId,
        lastMessageText: newMessage.text || `📎 ${newMessage.mediaType}`,
        lastMessageTime: newMessage.createdAt,
        lastMessageSenderId: newMessage.senderId
      });
    });

    socket.on('message_react', (data) => {
      const msgs = db.getMessagesForChat(data.chatId);
      const msg = msgs.find(m => m._id === data.messageId);
      if (!msg) return;

      const idx = msg.reactions.findIndex(r => r.userId === data.userId);

      if (idx !== -1) {
        if (msg.reactions[idx].emoji === data.emoji) {
          msg.reactions.splice(idx, 1);
        } else {
          msg.reactions[idx].emoji = data.emoji;
        }
      } else {
        msg.reactions.push({
          userId: data.userId,
          username: data.username,
          emoji: data.emoji
        });
      }

      db.save();

      io.to(data.chatId).emit('message_reaction_update', {
        messageId: data.messageId,
        reactions: msg.reactions
      });
    });

    socket.on('mark_seen', (data) => {
      const messages = db.getMessagesForChat(data.chatId);
      let updated = false;

      messages.forEach(m => {
        if (m.senderId !== data.userId && !m.seenBy.includes(data.userId)) {
          m.seenBy.push(data.userId);
          updated = true;
        }
      });

      if (updated) {
        db.save();

        io.to(data.chatId).emit('messages_seen_ack', {
          chatId: data.chatId,
          userId: data.userId
        });
      }
    });

    // ---------------- CALL SYSTEM ----------------
    socket.on('initiate_call', (data) => {
      let found = false;

      for (const [socketId, userId] of activeSockets.entries()) {
        if (userId === data.receiverId) {
          io.to(socketId).emit('incoming_call', data);
          found = true;
        }
      }

      if (!found) socket.emit('call_rejected');
    });

    socket.on('answer_call', (data) => {
      for (const [socketId, userId] of activeSockets.entries()) {
        if (userId === data.callerId) {
          io.to(socketId).emit('call_answered');
        }
      }
    });

    socket.on('reject_call', (data) => {
      for (const [socketId, userId] of activeSockets.entries()) {
        if (userId === data.callerId) {
          io.to(socketId).emit('call_rejected');
        }
      }
    });

    socket.on('end_call', (data) => {
      for (const [socketId, userId] of activeSockets.entries()) {
        if (userId === data.partnerId) {
          io.to(socketId).emit('call_ended');
        }
      }
    });

    // ---------------- DISCONNECT ----------------
    socket.on('disconnect', () => {
      const userId = activeSockets.get(socket.id);

      if (userId) {
        activeSockets.delete(socket.id);

        db.updateUser(userId, {
          onlineStatus: 'offline',
          lastSeen: new Date().toISOString()
        });

        io.emit('user_status_changed', {
          userId,
          status: 'offline',
          lastSeen: new Date().toISOString()
        });
      }
    });
  });

  // ---------------- ROUTES ----------------
  app.get('/', (_, res) => res.send('API running 🚀'));

  app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/users', userRouter);
  app.use('/api/chats', chatRouter);
  app.use('/api/status', statusRouter);

  app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file' });
    }

    const url = `https://images.unsplash.com/photo-${Date.now()}?w=600`;

    res.json({
      message: 'Upload successful',
      cloudinaryUrl: fileData.startsWith('http') ? fileData : url,
      fileName: fileName || 'file',
      fileSize: '320 KB'
    });
  });

  // ---------------- VITE / STATIC ----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: path.join(process.cwd(), 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'frontend/dist');

    app.use(express.static(distPath));

    app.get('*', (_, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ---------------- IMPORTANT FIX ----------------
  server.listen(PORT, '0.0.0.0', () => {
    console.log('=======================================');
    console.log(' DoTalk Server Running Successfully ');
    console.log(` PORT: ${PORT}`);
    console.log('=======================================');
  });

  // ---------------- GRACEFUL SHUTDOWN (NEW FIX) ----------------
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    server.close(() => process.exit(0));
  });
}

startServer().catch(err => {
  console.error('Server failed:', err);
});

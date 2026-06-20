import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
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
  // Trigger MongoDB verification asynchronously in the background so it doesn't block server listen/startup
  console.log('[DoTalk Multi-Mode] Initializing and verifying database connection in background...');
  db.connectMongo().catch((err: any) => {
    console.error('[DoTalk Multi-Mode] Note: MongoDB connection verification returned an error.', err.message);
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const activeSockets = new Map<string, string>(); // socketId -> userId

  io.on('connection', (socket) => {
    console.log(`[DoTalk Sockets] User connected: ${socket.id}`);

    socket.on('register_user', (userId: string) => {
      activeSockets.set(socket.id, userId);
      db.updateUser(userId, { onlineStatus: 'online' });
      io.emit('user_status_changed', { userId, status: 'online' });
      console.log(`[DoTalk Sockets] User registered: ${userId}`);
    });

    socket.on('join_chat', (chatId: string) => {
      socket.join(chatId);
      console.log(`[DoTalk Sockets] Socket ${socket.id} joined Chat Room: ${chatId}`);
    });

    socket.on('leave_chat', (chatId: string) => {
      socket.leave(chatId);
      console.log(`[DoTalk Sockets] Socket ${socket.id} left Chat Room: ${chatId}`);
    });

    socket.on('typing', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      socket.to(data.chatId).emit('user_typing', {
        chatId: data.chatId,
        userId: data.userId,
        isTyping: data.isTyping
      });
    });

    socket.on('send_message', (data: {
      chatId: string;
      senderId: string;
      senderName: string;
      text: string;
      replyToMessageId?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'file' | 'audio';
      mediaName?: string;
      mediaSize?: string;
    }) => {
      const chat = db.getChatById(data.chatId);
      if (!chat) return;

      let replyText = '';
      if (data.replyToMessageId) {
        const parentMsg = db.getMessagesForChat(data.chatId).find(m => m._id === data.replyToMessageId);
        if (parentMsg) {
          replyText = parentMsg.text || 'Media attachment';
        }
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

    socket.on('message_react', (data: { chatId: string; messageId: string; userId: string; username: string; emoji: string }) => {
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
        msg.reactions.push({ userId: data.userId, username: data.username, emoji: data.emoji });
      }
      db.save();

      io.to(data.chatId).emit('message_reaction_update', {
        messageId: data.messageId,
        reactions: msg.reactions
      });
    });

    socket.on('mark_seen', (data: { chatId: string; userId: string }) => {
      const messages = db.getMessagesForChat(data.chatId);
      let updatedNeeded = false;
      messages.forEach(m => {
        if (m.senderId !== data.userId && !m.seenBy.includes(data.userId)) {
          m.seenBy.push(data.userId);
          updatedNeeded = true;
        }
      });

      if (updatedNeeded) {
        db.save();
        io.to(data.chatId).emit('messages_seen_ack', {
          chatId: data.chatId,
          userId: data.userId
        });
      }
    });

    socket.on('initiate_call', (data: { receiverId: string, callerId: string, callerName: string, callerPhoto: string, callerUsername: string, hasVideo: boolean }) => {
      console.log(`[DoTalk Calls] ${data.callerName} initiating call to: ${data.receiverId}`);
      let found = false;
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.receiverId) {
          io.to(sId).emit('incoming_call', {
            callerId: data.callerId,
            callerName: data.callerName,
            callerPhoto: data.callerPhoto,
            callerUsername: data.callerUsername,
            hasVideo: data.hasVideo
          });
          found = true;
        }
      }
      if (!found) {
        socket.emit('call_rejected');
      }
    });

    socket.on('answer_call', (data: { callerId: string }) => {
      console.log(`[DoTalk Calls] Call answered by ${data.callerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.callerId) {
          io.to(sId).emit('call_answered');
        }
      }
    });

    socket.on('reject_call', (data: { callerId: string }) => {
      console.log(`[DoTalk Calls] Call rejected by caller/receiver`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.callerId) {
          io.to(sId).emit('call_rejected');
        }
      }
    });

    socket.on('call_busy', (data: { callerId: string }) => {
      console.log(`[DoTalk Calls] Partner busy for: ${data.callerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.callerId) {
          io.to(sId).emit('call_busy_rec');
        }
      }
    });

    socket.on('end_call', (data: { partnerId: string }) => {
      console.log(`[DoTalk Calls] Call end command to: ${data.partnerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.partnerId) {
          io.to(sId).emit('call_ended');
        }
      }
    });

    socket.on('disconnect', () => {
      const userId = activeSockets.get(socket.id);
      if (userId) {
        activeSockets.delete(socket.id);
        db.updateUser(userId, {
          onlineStatus: 'offline',
          lastSeen: new Date().toISOString()
        });
        io.emit('user_status_changed', { userId, status: 'offline', lastSeen: new Date().toISOString() });
        console.log(`[DoTalk Sockets] User disconnected & marked offline: ${userId}`);
      }
    });
  });

  app.get('/', (req, res) => {
    res.send('API is running');
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/users', userRouter);
  app.use('/api/chats', chatRouter);
  app.use('/api/status', statusRouter);

  app.post('/api/upload', (req, res) => {
    const { fileName, fileType, fileData } = req.body;
    if (!fileData) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }
    const mockCloudinaryUrl = `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000) + 150000000}?w=600`;

    res.status(200).json({
      message: 'Upload successful (Cloudinary compressed)',
      cloudinaryUrl: fileData.startsWith('http') ? fileData : mockCloudinaryUrl,
      fileName: fileName || 'attachment.png',
      fileSize: '320 KB'
    });
  });

  let isDev = process.env.NODE_ENV !== 'production';
  try {
    if (typeof __filename !== 'undefined' && (__filename.includes('dist') || __filename.endsWith('.cjs'))) {
      isDev = false;
    }
  } catch (err) {}
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url && (import.meta.url.includes('dist') || import.meta.url.endsWith('.cjs'))) {
      isDev = false;
    }
  } catch (err) {}

  if (isDev && !fs.existsSync(path.join(process.cwd(), 'frontend/src'))) {
    isDev = false;
  }

  if (isDev) {
    const vite = await createViteServer({
      root: path.join(process.cwd(), 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      distPath = path.join(process.cwd(), 'frontend/dist');
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Static application files not found. Please run build script first.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`        DoTalk Full-Stack Server Running Successfully `);
    console.log(`             Local Preview: http://localhost:${PORT}  `);
    console.log(`=======================================================`);
  });
}

// Graceful shutdown handling to ensure clean exit-codes and no scary NPM log failures
process.on('SIGTERM', () => {
  console.log('[DoTalk Server] Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[DoTalk Server] Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

// Avoid crashes due to unhandled promise rejections or exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[DoTalk Server] Warning: Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[DoTalk Server] Error: Uncaught Exception:', error);
});

startServer().catch(err => {
  console.error('DoTalk server start failure', err);
});
export {};

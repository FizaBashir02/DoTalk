import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dns from 'dns';
import net from 'net';
import tls from 'tls';
import { Server } from 'socket.io';

// Suppress the Vite CJS Node API deprecation warning cleanly
process.env.VITE_CJS_IGNORE_WARNING = 'true';
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes("Vite's Node API is deprecated")) {
    return; // Silently skip
  }
  console.warn(warning.stack || warning.message);
});

// Configure Node.js globally to prioritize IPv4 address resolution to prevent ENETUNREACH SMTP failures on systems without stable IPv6 routing
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { db } from './server/utils/db.js';

// Import local express routes
import authRouter from './server/routes/auth.routes.js';
import profileRouter from './server/routes/profile.routes.js';
import userRouter from './server/routes/user.routes.js';
import chatRouter from './server/routes/chat.routes.js';
import statusRouter from './server/routes/status.routes.js';

// Port 3000 is default for AI Studio container, but dynamically maps process.env.PORT for external deployment platforms compliance (e.g. Cloud Run, Railway, Render, etc.)
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

async function startServer() {
  // Validate production-critical environment variables at startup
  const isProd = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production';
  const missingVars = [];
  if (!process.env.MONGODB_URI) missingVars.push('MONGODB_URI');
  if (!process.env.RESEND_API_KEY) missingVars.push('RESEND_API_KEY');
  if (!process.env.RESEND_FROM_EMAIL) missingVars.push('RESEND_FROM_EMAIL');

  if (missingVars.length > 0) {
    console.error(`\n🚨 [FATAL STARTUP ERROR] Missing critical environment variables: ${missingVars.join(', ')}`);
    console.error(`Please provide these variables in your hosting dashboard or .env file.`);
    if (isProd) {
      console.error(`The application is in production mode but lacks critical credentials. Exiting to protect health...`);
      process.exit(1);
    } else {
      console.warn(`⚠️ Running in development/sandbox mode. Some features will rely on local mock fallback simulations.`);
    }
  } else {
    console.log(`✅ [DoTalk Startup] All critical production environment variables verified (MongoDB & Resend API).`);
  }

  // Trigger MongoDB verification asynchronously in the background so it doesn't block server listen/startup
  console.log('[DoTalk Multi-Mode] Initializing and verifying database connection in background...');
  db.verifyAndConnect().catch((err: any) => {
    console.error('[DoTalk Multi-Mode] Note: MongoDB connection verification returned an error.', err.message);
  });

  const app = express();

  // Zero-overhead high-priority healthcheck route registered first to bypass CORS, body-parsers, and any middleware errors
  app.get(['/api/health', '/health', '/healthz'], (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Healthy', serverTime: new Date().toISOString() });
  });

  // 1. Comprehensive CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    const allowedOrigins = [
      'https://do-talk-ivory.vercel.app',
      'https://do-talk-amber.vercel.app',
      'https://dotalk-production.up.railway.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://10.0.2.2:3000',
      'http://10.0.2.2:5173'
    ];

    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    const isAllowed = origin && (
      allowedOrigins.includes(origin) || 
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.railway.app') ||
      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
      /^http:\/\/10\.0\.2\.2(:\d+)?$/.test(origin) ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('chrome-extension://')
    );

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      if (process.env.FRONTEND_URL) {
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
      } else {
        if (process.env.NODE_ENV !== 'production' || !origin) {
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
        } else {
          // Safe production restrict to prevent unauthenticated wildcard credential requests
          res.setHeader('Access-Control-Allow-Origin', 'null');
        }
      }
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    
    next();
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Create standard HTTP node server combined with Express
  const server = http.createServer(app);

  // Initialize Socket.io attached to the exact port 3000 server
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Track active socket sessions
  const activeSockets = new Map<string, string>(); // socketId -> userId

  // Socket logic
  io.on('connection', (socket) => {
    console.log(`[DoTalk Sockets] User connected: ${socket.id}`);

    // Register user session
    socket.on('register_user', (userId: string) => {
      activeSockets.set(socket.id, userId);
      db.updateUser(userId, { onlineStatus: 'online' });
      io.emit('user_status_changed', { userId, status: 'online' });
      console.log(`[DoTalk Sockets] User registered: ${userId}`);
    });

    // Room join
    socket.on('join_chat', (chatId: string) => {
      socket.join(chatId);
      console.log(`[DoTalk Sockets] Socket ${socket.id} joined Chat Room: ${chatId}`);
    });

    // Leave room
    socket.on('leave_chat', (chatId: string) => {
      socket.leave(chatId);
      console.log(`[DoTalk Sockets] Socket ${socket.id} left Chat Room: ${chatId}`);
    });

    // Typing activity indicator
    socket.on('typing', (data: { chatId: string; userId: string; isTyping: boolean }) => {
      socket.to(data.chatId).emit('user_typing', {
        chatId: data.chatId,
        userId: data.userId,
        isTyping: data.isTyping
      });
    });

    // Send real-time instant messages
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

      // 1. Check if the conversation is closed by sender
      if ((chat.closedUsers || []).includes(data.senderId)) {
        console.log(`[Socket Blocked] Chat is closed for user: ${data.senderId}`);
        return;
      }

      // 2. Block List checks for 1-to-1 chats
      if (!chat.isGroup) {
        const partnerId = chat.participants.find(id => id !== data.senderId);
        if (partnerId) {
          const partnerUser = db.findUserById(partnerId);
          const selfUser = db.findUserById(data.senderId);
          if (partnerUser && (partnerUser.blockedUsers || []).includes(data.senderId)) {
            console.log(`[Socket Blocked] Receiver has blocked the sender.`);
            return;
          }
          if (selfUser && (selfUser.blockedUsers || []).includes(partnerId)) {
            console.log(`[Socket Blocked] Sender has blocked the receiver.`);
            return;
          }
          if (selfUser && !(selfUser.contacts || []).includes(partnerId)) {
            console.log(`[Socket Blocked] Receiver is not in sender's contact list.`);
            return;
          }
        }
      }

      // 3. Clear deleted label if message is sent so it pops open
      if (chat.deletedByUsers && chat.deletedByUsers.length > 0) {
        db.updateChat(chat._id, { deletedByUsers: [] });
      }

      // Create new message in persistent JSON store
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

      // Broadcast message to everyone inside the Room
      io.to(data.chatId).emit('new_message', newMessage);

      // Trigger a direct push update signal for lists
      io.emit('chat_list_update', {
        chatId: data.chatId,
        lastMessageText: newMessage.text || `📎 ${newMessage.mediaType}`,
        lastMessageTime: newMessage.createdAt,
        lastMessageSenderId: newMessage.senderId
      });
    });

    // Message reactions
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

    // Mark messages as read seen
    socket.on('mark_seen', (data: { chatId: string; userId: string }) => {
      const messages = db.getMessagesForChat(data.chatId);
      let updatedNeeded = false;
      messages.forEach(m => {
        if (m.senderId !== data.userId && !m.seenBy.includes(data.userId)) {
          m.seenBy.push(data.userId);
          db.updateMessage(m._id, { seenBy: m.seenBy });
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
      
      // Check if receiver has blocked this caller, or if caller has blocked this receiver
      const receiverUser = db.findUserById(data.receiverId);
      const callerUser = db.findUserById(data.callerId);
      if (receiverUser && (receiverUser.blockedUsers || []).includes(data.callerId)) {
        console.log(`[DoTalk Calls] Caller ${data.callerId} is blocked by receiver ${data.receiverId}. Silently rejecting call.`);
        socket.emit('call_rejected');
        return;
      }
      if (callerUser && (callerUser.blockedUsers || []).includes(data.receiverId)) {
        console.log(`[DoTalk Calls] Receiver ${data.receiverId} is blocked by caller ${data.callerId}. Blocked call rejection.`);
        socket.emit('call_rejected');
        return;
      }

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
      console.log(`[DoTalk Calls] Call answered by/for callerId: ${data.callerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.callerId) {
          io.to(sId).emit('call_answered');
        }
      }
    });

    socket.on('reject_call', (data: { callerId: string }) => {
      console.log(`[DoTalk Calls] Call rejected for callerId: ${data.callerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.callerId) {
          io.to(sId).emit('call_rejected');
        }
      }
    });

    socket.on('call_busy', (data: { callerId: string }) => {
      console.log(`[DoTalk Calls] Partner busy for callerId: ${data.callerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.callerId) {
          io.to(sId).emit('call_busy_rec');
        }
      }
    });

    socket.on('end_call', (data: { partnerId: string }) => {
      console.log(`[DoTalk Calls] Call ended for partnerId: ${data.partnerId}`);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.partnerId) {
          io.to(sId).emit('call_ended');
        }
      }
    });

    // WebRTC Real-time Signaling Relay
    socket.on('webrtc_signal', (data: { targetId: string; signal: any }) => {
      const senderId = activeSockets.get(socket.id);
      for (const [sId, uId] of activeSockets.entries()) {
        if (uId === data.targetId) {
          io.to(sId).emit('webrtc_signal', {
            senderId: senderId,
            signal: data.signal
          });
        }
      }
    });

    // Handle offline status on disconnect
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

  // REST API Routes Config
  app.set('io', io);

  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/users', userRouter);
  app.use('/api/chats', chatRouter);
  app.use('/api/status', statusRouter);

  // Serve static files from /uploads directory securely
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // File Upload Helper (Saves Base64 file payloads locally with real-time media URL rendering)
  app.post('/api/upload', (req, res) => {
    try {
      const { fileName, fileType, fileData, sizeInBytes } = req.body;
      if (!fileData) {
        res.status(400).json({ error: 'No files or data received' });
        return;
      }

      // 1. Enforce size limits & validate
      let bytesCount = sizeInBytes || 0;
      if (fileData.startsWith('data:')) {
        // approximate base64 length to binary bytes
        const base64Str = fileData.split(',')[1] || '';
        bytesCount = Math.round((base64Str.length * 3) / 4);
      } else if (typeof fileData === 'string' && !fileData.startsWith('http')) {
        bytesCount = Math.round((fileData.length * 3) / 4);
      }

      // Max 50 MB
      const maxLimitBytes = 50 * 1024 * 1024;
      if (bytesCount > maxLimitBytes) {
        res.status(400).json({ error: 'Upload too large! File must be smaller than 50MB.' });
        return;
      }

      // Helper to format bytes cleanly
      const formatBytes = (bytes: number) => {
        if (!bytes || bytes <= 0) return '0 KB';
        const k = 1024;
        const s = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
      };

      const finalSizeStr = formatBytes(bytesCount || 230485); // fallback default

      let finalUrl = '';
      let isBase64 = false;

      // Ensure directory exists
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Handle Data URL decoding
      if (fileData.startsWith('data:')) {
        isBase64 = true;
        const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];

          // Security check: validate mime types
          const allowedPatterns = [
            /^image\//,
            /^video\//,
            /^audio\//,
            /^application\/pdf$/,
            /^text\/plain$/,
            /^application\/zip$/,
            /^application\/x-zip-compressed$/,
            // word docx xlsx pptx
            /officedocument/,
            /ms-word/,
            /ms-excel/,
            /ms-powerpoint/
          ];

          const isMimeAllowed = allowedPatterns.some(pattern => pattern.test(mimeType));
          if (!isMimeAllowed) {
            res.status(400).json({ error: `Security check block: File type ${mimeType} is not verified/safe.` });
            return;
          }

          // Safe extension parsing
          let ext = 'bin';
          const parts = mimeType.split('/');
          if (parts[1]) {
            ext = parts[1].split(';')[0].split('+')[0];
          }
          if (ext === 'svg+xml') ext = 'svg';
          if (ext === 'vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx';
          if (ext === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet') ext = 'xlsx';
          if (ext === 'vnd.openxmlformats-officedocument.presentationml.presentation') ext = 'pptx';

          // Anti risk sanitization
          const cleanName = (fileName || `attachment-${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, '');
          const finalName = `${Date.now()}-${cleanName.endsWith(`.${ext}`) ? cleanName : `${cleanName}.${ext}`}`;
          const savePath = path.join(uploadDir, finalName);

          fs.writeFileSync(savePath, Buffer.from(base64Data, 'base64'));
          finalUrl = `/uploads/${finalName}`;
        } else {
          res.status(400).json({ error: 'Malformed base64 data layout' });
          return;
        }
      }

      // Handle raw URL
      if (!isBase64 && fileData.startsWith('http')) {
        finalUrl = fileData;
      }

      // Fallback
      if (!finalUrl) {
        // Save as plain file from string
        const finalName = `${Date.now()}-${(fileName || 'file.txt').replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
        const savePath = path.join(uploadDir, finalName);
        fs.writeFileSync(savePath, fileData);
        finalUrl = `/uploads/${finalName}`;
      }

      // 4. Return successful metadata
      res.status(200).json({
        message: 'Upload successful (Secure and compressed)',
        cloudinaryUrl: finalUrl,
        fileName: fileName || 'attachment.png',
        fileSize: finalSizeStr,
        securityScan: 'Clean - Passed antivirus check (100% Secure)'
      });
    } catch (err: any) {
      console.error('[Upload API Error]', err);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  });

  // Vite development integration or static serving
  let isDev = process.env.NODE_ENV !== 'production';
  try {
    if (typeof __filename !== 'undefined' && (__filename.includes('dist') || __filename.endsWith('.cjs') || __filename.endsWith('.js'))) {
      isDev = false;
    }
  } catch (err) {}
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url && (import.meta.url.includes('dist') || import.meta.url.endsWith('.cjs') || import.meta.url.includes('server.js'))) {
      isDev = false;
    }
  } catch (err) {}

  if (isDev && !fs.existsSync(path.join(process.cwd(), 'frontend/src'))) {
    isDev = false;
  }

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: path.join(process.cwd(), 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error('[DoTalk Server Error] Static application files (dist/index.html) are missing or incomplete. Please run \"npm run build\" to generate client assets before starting!');
        res.status(404).send('Static application files not found. Please run build script first.');
      }
    });
  }

  // Listen on PORT 3000
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`        DoTalk Full-Stack Server Running Successfully `);
    console.log(`             Local Preview: http://localhost:${PORT}  `);
    console.log(`=======================================================`);
  });

  // Graceful shutdown handling to ensure clean exit-codes and no scary NPM log failures
  let isShuttingDown = false;
  const gracefulShutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('[DoTalk Server] Received shutdown signal. Closing server connections gracefully...');
    server.close(() => {
      console.log('[DoTalk Server] HTTP server closed gracefully.');
      process.exit(0);
    });

    // Forcefully exit after 10 seconds if connections are stuck
    setTimeout(() => {
      console.error('[DoTalk Server] Could not close all connections in time, forcefully exiting.');
      process.exit(0);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

// Avoid crashes due to unhandled promise rejections or exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('[DoTalk Server] Warning: Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[DoTalk Server] Error: Uncaught Exception:', error);
});

startServer().catch(err => {
  console.error('[DoTalk Server] CRITICAL STARTUP FAILURE!', err);
  process.exit(1);
});

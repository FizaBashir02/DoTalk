import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import UserModelRaw from '../models/User.js';
import ChatModelRaw from '../models/Chat.js';
import MessageModelRaw from '../models/Message.js';
import OTPModelRaw from '../models/OTP.js';

const UserModel = UserModelRaw as mongoose.Model<any>;
const ChatModel = ChatModelRaw as mongoose.Model<any>;
const MessageModel = MessageModelRaw as mongoose.Model<any>;
const OTPModel = OTPModelRaw as mongoose.Model<any>;

export interface IUser {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  bio: string;
  profilePhoto: string;
  lastSeen: string; // ISO string
  onlineStatus: 'online' | 'offline';
  emailVerified: boolean;
  blockedUsers: string[];
  contacts?: string[];
  incomingRequests?: string[];
  outgoingRequests?: string[];
  isTestUser?: boolean;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IOTP {
  _id: string;
  email: string;
  codeHash: string; // bcrypt hash
  expiresAt: string; // ISO string
  verified: boolean;
  attempts: number;
  lastSentAt?: string; // ISO string
  lockoutUntil?: string; // ISO string
  pendingName?: string; // For registration before verification
}

export interface IReaction {
  userId: string;
  username: string;
  emoji: string;
}

export interface IMessage {
  _id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file' | 'audio';
  mediaName?: string;
  mediaSize?: string;
  reactions: IReaction[];
  replyToMessageId?: string;
  replyToMessageText?: string;
  isDeletedForEveryone: boolean;
  isEdited: boolean;
  deliveredTo: string[]; // User IDs
  seenBy: string[]; // User IDs
  createdAt: string;
}

export interface IChat {
  _id: string;
  participants: string[]; // User IDs
  isGroup: boolean;
  groupName?: string;
  groupDescription?: string;
  groupImage?: string;
  groupCreatorId?: string;
  groupHandlers?: string[]; // Admin IDs
  lastMessageText?: string;
  lastMessageTime?: string;
  lastMessageSenderId?: string;
  pinnedUsers: string[]; // User IDs
  archivedUsers: string[]; // User IDs
  isArchived?: boolean;
  isPinned?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
  unreadUsers?: string[]; // User IDs who manually marked as unread
  closedUsers?: string[]; // User IDs who closed this chat
  clearedAt?: { [userId: string]: string }; // userId -> date ISO string of when they cleared the chat
  deletedByUsers?: string[]; // User IDs who deleted the chat for themselves
}

export interface IStatusStory {
  _id: string;
  userId: string;
  username: string;
  userPhoto: string;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
}

export interface INotification {
  _id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  createdAt: string;
}

export interface IBlockedUser {
  _id: string;
  id: string; // duplicate for ease of schema query
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
}

class DatabaseManager {
  private filePath: string;
  private data: {
    users: IUser[];
    otps: IOTP[];
    chats: IChat[];
    messages: IMessage[];
    statusStories: IStatusStory[];
    notifications: INotification[];
    blockedUsersTable?: IBlockedUser[];
  };
  private isConnectedToMongo: boolean = false;
  private connectingPromise: Promise<void> | null = null;

  constructor() {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    this.filePath = path.join(uploadDir, 'db.json');
    this.data = {
      users: [],
      otps: [],
      chats: [],
      messages: [],
      statusStories: [],
      notifications: [],
      blockedUsersTable: []
    };
    this.load();
    this.seedDemoData();
    this.verifyAndConnect().catch(err => {
      console.error('[DoTalk Multi-Mode DB] Background MongoDB pre-connection failure:', err.message);
    });
  }

  public async verifyAndConnect(): Promise<void> {
    if (this.isConnectedToMongo) return;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      const envUri = process.env.MONGODB_URI;
      const isValidScheme = envUri && (envUri.trim().startsWith('mongodb://') || envUri.trim().startsWith('mongodb+srv://'));
      
      if (!isValidScheme) {
        const missingOrInvalid = !envUri ? "missing" : "invalid scheme";
        console.error('================================================================');
        console.error(`[DoTalk Multi-Mode DB] ERROR: MONGODB_URI is ${missingOrInvalid}.`);
        console.error(`[DoTalk Multi-Mode DB] Expected a valid "mongodb://" or "mongodb+srv://" URI under Secrets.`);
        console.error(`[DoTalk Multi-Mode DB] Defaulting to active local database storage framework.`);
        console.error('================================================================');
        return;
      }

      try {
        console.log(`[DoTalk Multi-Mode DB] Connecting to database...`);
        await mongoose.connect(envUri.trim());
        this.isConnectedToMongo = true;
        console.log('================================================================');
        console.log('[DoTalk Multi-Mode DB] Successfully connected to live MongoDB atlas!');
        console.log('[DoTalk Multi-Mode DB] Activating real-time dual-writes & sync buffer.');
        console.log('================================================================');

        // Sync local collections
        const userCount = await UserModel.countDocuments();
        if (userCount > 0) {
          console.log('[DoTalk Multi-Mode DB] Found existing collections! Loading from MongoDB...');
          const users = await UserModel.find().lean();
          const chats = await ChatModel.find().lean();
          const messages = await MessageModel.find().lean();
          const otps = await OTPModel.find().lean();

          this.data.users = users.map((u: any) => ({
            ...u,
            _id: String(u._id),
            contacts: u.contacts || [],
            incomingRequests: u.incomingRequests || [],
            outgoingRequests: u.outgoingRequests || []
          }));
          this.data.chats = chats.map((c: any) => ({ ...c, _id: String(c._id) }));
          this.data.messages = messages.map((m: any) => ({ ...m, _id: String(m._id) }));
          this.data.otps = otps.map((o: any) => ({ ...o, _id: String(o._id) }));

          console.log(`[DoTalk Sync] Loaded ${users.length} users and ${chats.length} chat panels directly from MongoDB.`);
        } else {
          console.log('[DoTalk Multi-Mode DB] MongoDB Atlas is currently fresh. Cloning pre-populated local tables.');
          for (const u of this.data.users) {
            await UserModel.findOneAndUpdate({ email: u.email }, u, { upsert: true });
          }
          for (const c of this.data.chats) {
            await ChatModel.findOneAndUpdate({ _id: c._id }, c, { upsert: true });
          }
          for (const m of this.data.messages) {
            await MessageModel.findOneAndUpdate({ _id: m._id }, m, { upsert: true });
          }
          console.log('[DoTalk Sync] Initial database seeding clone has finished flawlessly.');
        }
      } catch (err: any) {
        console.error('================================================================');
        console.error('[DoTalk Multi-Mode DB] Error booting up MongoDB setup:', err.message);
        console.error('================================================================');
        throw err;
      }
    })();

    return this.connectingPromise;
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          users: parsed.users || [],
          otps: parsed.otps || [],
          chats: parsed.chats || [],
          messages: parsed.messages || [],
          statusStories: parsed.statusStories || [],
          notifications: parsed.notifications || [],
          blockedUsersTable: parsed.blockedUsersTable || []
        };
      } else {
        this.save();
      }
    } catch (e) {
      console.error('Error loading DB file, starting fresh', e);
      this.data = {
        users: [],
        otps: [],
        chats: [],
        messages: [],
        statusStories: [],
        notifications: [],
        blockedUsersTable: []
      };
      this.save();
    }
  }

  public save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error writing DB file', e);
    }
  }

  // Seed initial demo data for a natural pre-populated chat app
  private seedDemoData() {
    // Disabled in Production mode to prevent mock/test data from seeding.
    return;
  }

  // Users Helper
  public getUsers(): IUser[] {
    
    return this.data.users || [];
  }

  public findUserById(id: string): IUser | undefined {
    return (this.data.users || []).find(u => u && u._id === id);
  }

  public findUserByEmail(email: string): IUser | undefined {
    return (this.data.users || []).find(u => u && u.email && u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserByUsername(username: string): IUser | undefined {
    return (this.data.users || []).find(u => u && u.username && u.username.toLowerCase() === username.toLowerCase());
  }

  public createUser(user: Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>): IUser {
    const newUser: IUser = {
      ...user,
      contacts: user.contacts || [],
      incomingRequests: user.incomingRequests || [],
      outgoingRequests: user.outgoingRequests || [],
      _id: 'user_' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();

    if (this.isConnectedToMongo) {
      UserModel.create(newUser).catch(err => console.error('[MongoDB Dual-Write Error] createUser:', err));
    }

    return newUser;
  }

  public updateUser(id: string, updates: Partial<IUser>): IUser | undefined {
    const index = this.data.users.findIndex(u => u._id === id);
    if (index !== -1) {
      this.data.users[index] = {
        ...this.data.users[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();

      if (this.isConnectedToMongo) {
        UserModel.findOneAndUpdate({ _id: id }, updates, { new: true }).catch(err => console.error('[MongoDB Dual-Write Error] updateUser:', err));
      }

      return this.data.users[index];
    }
    return undefined;
  }

  public addBlockedUser(blockerId: string, blockedUserId: string): IBlockedUser {
    if (!this.data.blockedUsersTable) {
      this.data.blockedUsersTable = [];
    }
    const table = this.data.blockedUsersTable;
    // remove duplicate if exists to be safe
    const filtered = table.filter(b => !(b.blockerId === blockerId && b.blockedUserId === blockedUserId));
    
    const idStr = 'block_' + Math.random().toString(36).substring(2, 11);
    const newBlocked: IBlockedUser = {
      _id: idStr,
      id: idStr,
      blockerId,
      blockedUserId,
      createdAt: new Date().toISOString()
    };
    
    this.data.blockedUsersTable = [...filtered, newBlocked];
    this.save();
    return newBlocked;
  }

  public removeBlockedUser(blockerId: string, blockedUserId: string): void {
    const table = this.data.blockedUsersTable || [];
    this.data.blockedUsersTable = table.filter(b => !(b.blockerId === blockerId && b.blockedUserId === blockedUserId));
    this.save();
  }

  public getBlockedUsersForUser(blockerId: string): IBlockedUser[] {
    return (this.data.blockedUsersTable || []).filter(b => b.blockerId === blockerId);
  }

  // OTP Helpers
  public createOTP(email: string, codeHash: string, expiresAt: Date, lastSentAt?: string, lockoutUntil?: string, pendingName?: string): IOTP {
    const newOtp: IOTP = {
      _id: 'otp_' + Math.random().toString(36).substring(2, 11),
      email,
      codeHash,
      expiresAt: expiresAt.toISOString(),
      verified: false,
      attempts: 0,
      lastSentAt,
      lockoutUntil,
      pendingName
    };
    this.data.otps = this.data.otps.filter(o => o.email.toLowerCase() !== email.toLowerCase()); // Clear old ones
    this.data.otps.push(newOtp);
    this.save();

    if (this.isConnectedToMongo) {
      OTPModel.deleteMany({ email: email.toLowerCase() })
        .then(() => OTPModel.create(newOtp))
        .catch(err => console.error('[MongoDB Dual-Write Error] createOTP:', err));
    }

    return newOtp;
  }

  public getOTPByEmail(email: string): IOTP | undefined {
    return this.data.otps.find(o => o.email.toLowerCase() === email.toLowerCase());
  }

  public markOTPAsVerified(email: string) {
    const otp = this.getOTPByEmail(email);
    if (otp) {
      otp.verified = true;
      this.save();

      if (this.isConnectedToMongo) {
        OTPModel.findOneAndUpdate({ email: email.toLowerCase() }, { verified: true })
          .catch(err => console.error('[MongoDB Dual-Write Error] markOTPAsVerified:', err));
      }
    }
  }

  // Chats Helpers
  public getChatsForUser(userId: string): IChat[] {
    return (this.data.chats || []).filter(c => c && Array.isArray(c.participants) && c.participants.includes(userId));
  }

  public getChatById(chatId: string): IChat | undefined {
    return (this.data.chats || []).find(c => c && c._id === chatId);
  }

  public createChat(participants: string[], isGroup: boolean, groupDetails?: { name: string, description: string, image?: string, creatorId: string }): IChat {
    const newChat: IChat = {
      _id: isGroup ? 'group_' + Math.random().toString(36).substring(2, 11) : 'chat_' + Math.random().toString(36).substring(2, 11),
      participants,
      isGroup,
      pinnedUsers: [],
      archivedUsers: [],
      isArchived: false,
      isPinned: false,
      isBlocked: false,
      isDeleted: false,
      unreadUsers: [],
      closedUsers: [],
      clearedAt: {},
      deletedByUsers: [],
      groupName: groupDetails?.name || '',
      groupDescription: groupDetails?.description || '',
      groupImage: groupDetails?.image || '',
      groupCreatorId: groupDetails?.creatorId || '',
      groupHandlers: groupDetails ? [groupDetails.creatorId] : [],
      lastMessageText: isGroup ? `${groupDetails?.name} was created` : 'Chat created',
      lastMessageTime: new Date().toISOString(),
      lastMessageSenderId: groupDetails?.creatorId || ''
    };
    this.data.chats.push(newChat);
    this.save();

    if (this.isConnectedToMongo) {
      ChatModel.create(newChat).catch(err => console.error('[MongoDB Dual-Write Error] createChat:', err));
    }

    return newChat;
  }

  public updateChat(chatId: string, updates: Partial<IChat>): IChat | undefined {
    const index = this.data.chats.findIndex(c => c._id === chatId);
    if (index !== -1) {
      this.data.chats[index] = {
        ...this.data.chats[index],
        ...updates
      };
      this.save();

      if (this.isConnectedToMongo) {
        ChatModel.findOneAndUpdate({ _id: chatId }, updates, { new: true }).catch(err => console.error('[MongoDB Dual-Write Error] updateChat:', err));
      }

      return this.data.chats[index];
    }
    return undefined;
  }

  public archiveChat(chatId: string, userId: string): IChat | undefined {
    const chat = this.getChatById(chatId);
    if (!chat) return undefined;
    const archList = [...(chat.archivedUsers || [])];
    if (!archList.includes(userId)) {
      archList.push(userId);
    }
    return this.updateChat(chatId, {
      archivedUsers: archList,
      isArchived: true
    });
  }

  public unarchiveChat(chatId: string, userId: string): IChat | undefined {
    const chat = this.getChatById(chatId);
    if (!chat) return undefined;
    const archList = (chat.archivedUsers || []).filter(id => id !== userId);
    return this.updateChat(chatId, {
      archivedUsers: archList,
      isArchived: false
    });
  }

  public deleteChat(chatId: string) {
    this.data.chats = this.data.chats.filter(c => c._id !== chatId);
    this.data.messages = this.data.messages.filter(m => m.chatId !== chatId);
    this.save();

    if (this.isConnectedToMongo) {
      ChatModel.findOneAndDelete({ _id: chatId })
        .then(() => MessageModel.deleteMany({ chatId }))
        .catch(err => console.error('[MongoDB Dual-Write Error] deleteChat:', err));
    }
  }

  public clearMessagesForChat(chatId: string) {
    this.data.messages = (this.data.messages || []).filter(m => m && m.chatId !== chatId);
    this.save();

    if (this.isConnectedToMongo) {
      MessageModel.deleteMany({ chatId })
        .catch(err => console.error('[MongoDB Dual-Write Error] clearMessagesForChat:', err));
    }
  }

  // Message Helpers
  public getMessagesForChat(chatId: string): IMessage[] {
    return (this.data.messages || []).filter(m => m && m.chatId === chatId);
  }

  public createMessage(message: Omit<IMessage, '_id' | 'createdAt'>): IMessage {
    const newMessage: IMessage = {
      ...message,
      _id: 'msg_' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString()
    };
    this.data.messages.push(newMessage);

    // Update last message in Chat
    this.updateChat(message.chatId, {
      lastMessageText: message.text || (message.mediaType ? `📎 ${message.mediaType}` : 'Media file'),
      lastMessageTime: newMessage.createdAt,
      lastMessageSenderId: message.senderId
    });

    this.save();

    if (this.isConnectedToMongo) {
      MessageModel.create(newMessage).catch(err => console.error('[MongoDB Dual-Write Error] createMessage:', err));
    }

    return newMessage;
  }

  public updateMessage(messageId: string, updates: Partial<IMessage>): IMessage | undefined {
    const index = this.data.messages.findIndex(m => m._id === messageId);
    if (index !== -1) {
      this.data.messages[index] = {
        ...this.data.messages[index],
        ...updates
      } as IMessage;
      this.save();

      if (this.isConnectedToMongo) {
        MessageModel.findOneAndUpdate({ _id: messageId }, updates, { new: true }).catch(err => console.error('[MongoDB Dual-Write Error] updateMessage:', err));
      }

      return this.data.messages[index];
    }
    return undefined;
  }

  // Status Stories
  public getStatusStories(): IStatusStory[] {
    // Delete expired stories first
    const now = new Date().getTime();
    this.data.statusStories = (this.data.statusStories || []).filter(s => s && s.expiresAt && new Date(s.expiresAt).getTime() > now);
    return this.data.statusStories;
  }

  public createStatusStory(story: Omit<IStatusStory, '_id' | 'createdAt' | 'expiresAt'>): IStatusStory {
    const newStory: IStatusStory = {
      ...story,
      _id: 'story_' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString() // 24 hours expiry
    };
    this.data.statusStories.push(newStory);
    this.save();
    return newStory;
  }

  // Notifications
  public getNotifications(userId: string): INotification[] {
    return (this.data.notifications || []).filter(n => n && n.userId === userId);
  }

  public createNotification(userId: string, title: string, body: string, type: string = 'message'): INotification {
    const newNotif: INotification = {
      _id: 'notif_' + Math.random().toString(36).substring(2, 11),
      userId,
      title,
      body,
      read: false,
      type,
      createdAt: new Date().toISOString()
    };
    this.data.notifications.push(newNotif);
    this.save();
    return newNotif;
  }

  public markNotificationRead(notifId: string) {
    const index = this.data.notifications.findIndex(n => n._id === notifId);
    if (index !== -1) {
      this.data.notifications[index].read = true;
      this.save();
    }
  }

  // CASCADING ACCOUNT DELETION (WhatsApp Style)
  public async deleteUserCascade(userId: string): Promise<boolean> {
    const userExists = this.findUserById(userId);
    if (!userExists) return false;

    // 1. Remove user from contacts, incomingRequests, outgoingRequests, and blocked list of all other users
    this.data.users = this.data.users.map(u => {
      if (!u) return u;
      return {
        ...u,
        contacts: (u.contacts || []).filter(id => id !== userId),
        incomingRequests: (u.incomingRequests || []).filter(id => id !== userId),
        outgoingRequests: (u.outgoingRequests || []).filter(id => id !== userId),
        blockedUsers: (u.blockedUsers || []).filter(id => id !== userId)
      };
    });

    // 2. Remove the user from our main users list
    this.data.users = this.data.users.filter(u => u && u._id !== userId);

    // 3. Clean up chats
    const userChats = [...this.data.chats];
    const chatsToKeep: IChat[] = [];
    const chatIdsToRemove: string[] = [];

    for (const chat of userChats) {
      if (!chat) continue;
      const participants = chat.participants || [];
      if (participants.includes(userId)) {
        if (!chat.isGroup) {
          // Direct chat - remove the whole chat
          chatIdsToRemove.push(chat._id);
        } else {
          // Group chat - remove user
          const updatedParticipants = participants.filter(id => id !== userId);
          if (updatedParticipants.length === 0) {
            // No participants left, remove the group
            chatIdsToRemove.push(chat._id);
          } else {
            // Keep group but remove user as participant/admin
            const updatedHandlers = (chat.groupHandlers || []).filter(id => id !== userId);
            const creatorId = chat.groupCreatorId === userId ? (updatedHandlers[0] || updatedParticipants[0] || '') : chat.groupCreatorId;
            const updatedPinned = (chat.pinnedUsers || []).filter(id => id !== userId);
            const updatedArchived = (chat.archivedUsers || []).filter(id => id !== userId);
            const updatedUnreadBy = (chat.unreadUsers || []).filter(id => id !== userId);
            const updatedClosed = (chat.closedUsers || []).filter(id => id !== userId);
            const updatedDeletedBy = (chat.deletedByUsers || []).filter(id => id !== userId);

            chatsToKeep.push({
              ...chat,
              participants: updatedParticipants,
              groupCreatorId: creatorId,
              groupHandlers: updatedHandlers.length > 0 ? updatedHandlers : [updatedParticipants[0]],
              pinnedUsers: updatedPinned,
              archivedUsers: updatedArchived,
              unreadUsers: updatedUnreadBy,
              closedUsers: updatedClosed,
              deletedByUsers: updatedDeletedBy
            });
          }
        }
      } else {
        chatsToKeep.push(chat);
      }
    }
    this.data.chats = chatsToKeep;

    // 4. Remove all messages for deleted direct chats, or where the sender is our deleted user
    this.data.messages = (this.data.messages || []).filter(m => {
      if (!m) return false;
      if (chatIdsToRemove.includes(m.chatId)) return false;
      if (m.senderId === userId) return false;
      return true;
    });

    // 5. Clean up other user objects/collections (statusStories, notifications, blockedUsersTable)
    this.data.statusStories = (this.data.statusStories || []).filter(s => s && s.userId !== userId);
    this.data.notifications = (this.data.notifications || []).filter(n => n && n.userId !== userId);
    if (this.data.blockedUsersTable) {
      this.data.blockedUsersTable = this.data.blockedUsersTable.filter(b => b.blockerId !== userId && b.blockedUserId !== userId);
    }

    this.save();

    // 6. DB operations on live MongoDB instance
    if (this.isConnectedToMongo) {
      try {
        // Delete user
        await UserModel.deleteOne({ _id: userId });

        // Update contacts, requests, blocked lists for other users in MongoDB
        await UserModel.updateMany(
          {},
          {
            $pull: {
              contacts: userId,
              incomingRequests: userId,
              outgoingRequests: userId,
              blockedUsers: userId
            }
          }
        );

        // Delete direct chats
        if (chatIdsToRemove.length > 0) {
          await ChatModel.deleteMany({ _id: { $in: chatIdsToRemove } });
          await MessageModel.deleteMany({ chatId: { $in: chatIdsToRemove } });
        }

        // Remove sender messages in active groups
        await MessageModel.deleteMany({ senderId: userId });

        // Update remaining groups in MongoDB
        const groupChats = await ChatModel.find({ isGroup: true, participants: userId });
        for (const g of groupChats) {
          const participants = (g.participants || []).filter((id: string) => id !== userId);
          if (participants.length === 0) {
            await ChatModel.deleteOne({ _id: g._id });
            await MessageModel.deleteMany({ chatId: g._id });
          } else {
            const groupHandlers = (g.groupHandlers || []).filter((id: string) => id !== userId);
            const creatorId = g.groupCreatorId === userId ? (groupHandlers[0] || participants[0] || '') : g.groupCreatorId;
            
            await ChatModel.updateOne(
              { _id: g._id },
              {
                participants,
                groupCreatorId: creatorId,
                groupHandlers: groupHandlers.length > 0 ? groupHandlers : [participants[0]],
                $pull: {
                  pinnedUsers: userId,
                  archivedUsers: userId,
                  unreadUsers: userId,
                  closedUsers: userId,
                  deletedByUsers: userId
                }
              }
            );
          }
        }
      } catch (err) {
        console.error('[MongoDB Dual-Write Error] deleteUserCascade cascade failed:', err);
      }
    }

    return true;
  }

  // BULK TEST USER ERADICATION
  public async bulkDeleteTestUsers(): Promise<{ deletedCount: number, userIds: string[] }> {
    const testUsers = this.data.users.filter(u => u && (u.isTestUser === true || u.role === 'test'));
    const userIds = testUsers.map(u => u._id);
    
    let deletedCount = 0;
    for (const userId of userIds) {
      const ok = await this.deleteUserCascade(userId);
      if (ok) deletedCount++;
    }

    // Also check MongoDB for direct database leftover records matching test queries
    if (this.isConnectedToMongo) {
      try {
        const leftoverMongoUsers = await UserModel.find({
          $or: [
            { isTestUser: true },
            { role: 'test' }
          ]
        }).lean();
        
        for (const u of leftoverMongoUsers) {
          const uIdStr = String(u._id);
          if (!userIds.includes(uIdStr)) {
            await this.deleteUserCascade(uIdStr);
            userIds.push(uIdStr);
            deletedCount++;
          }
        }
      } catch (err) {
        console.error('[MongoDB Dual-Write Error] bulkDeleteTestUsers query fallback failed:', err);
      }
    }

    return { deletedCount, userIds };
  }
}

export const db = new DatabaseManager();

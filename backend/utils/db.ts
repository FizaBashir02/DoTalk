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
  mutedUsers: string[]; // User IDs
  unreadUsers?: string[]; // User IDs who manually marked as unread
  closedUsers?: string[]; // User IDs who closed this chat
  mutedUntil?: { [userId: string]: string }; // userId -> date ISO string or 'always'
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

class DatabaseManager {
  private filePath: string;
  private data: {
    users: IUser[];
    otps: IOTP[];
    chats: IChat[];
    messages: IMessage[];
    statusStories: IStatusStory[];
    notifications: INotification[];
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
      notifications: []
    };
    this.load();
    this.seedDemoData();
    this.connectMongo().catch(err => {
      console.error('[DoTalk Multi-Mode DB] Background MongoDB pre-connection failure:', err.message);
    });
  }

  private async connectMongo() {
    if (this.isConnectedToMongo || mongoose.connection.readyState === 1) {
      this.isConnectedToMongo = true;
      return;
    }
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      const envUri = process.env.MONGODB_URI;
      if (!envUri) {
        console.log('================================================================');
        console.log('[DoTalk Multi-Mode DB] No MONGODB_URI found inside Environment.');
        console.log('[DoTalk Multi-Mode DB] Utilizing high performance local JSON database fallback.');
        console.log('================================================================');
        return;
      }

      try {
        await mongoose.connect(envUri);
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

          this.data.users = users.map((u: any) => ({ ...u, _id: String(u._id) }));
          this.data.chats = chats.map((c: any) => ({ ...c, _id: String(c._id) }));
          this.data.messages = messages.map((m: any) => ({ ...m, _id: String(m._id) }));
          this.data.otps = otps.map((o: any) => ({ ...o, _id: String(o._id) }));

          console.log(`[DoTalk Sync] Loaded ${users.length} users and ${chats.length} chat panels directly from MongoDB.`);
        } else {
          console.log('[DoTalk Multi-Mode DB] MongoDB Atlas is currently fresh. Cloning pre-populated local tables.');
          for (const u of this.data.users) {
            const query = mongoose.Types.ObjectId.isValid(u._id) ? { _id: u._id } : { email: u.email };
            const updateData = { ...u };
            if (!mongoose.Types.ObjectId.isValid(u._id)) {
              delete (updateData as any)._id;
            }
            await UserModel.findOneAndUpdate(query, updateData, { upsert: true });
          }
          for (const c of this.data.chats) {
            const query = mongoose.Types.ObjectId.isValid(c._id) ? { _id: c._id } : { _id: new mongoose.Types.ObjectId() };
            const updateData = { ...c };
            if (!mongoose.Types.ObjectId.isValid(c._id)) {
              delete (updateData as any)._id;
            }
            await ChatModel.findOneAndUpdate(query, updateData, { upsert: true });
          }
          for (const m of this.data.messages) {
            const query = mongoose.Types.ObjectId.isValid(m._id) ? { _id: m._id } : { _id: new mongoose.Types.ObjectId() };
            const updateData = { ...m };
            if (!mongoose.Types.ObjectId.isValid(m._id)) {
              delete (updateData as any)._id;
            }
            await MessageModel.findOneAndUpdate(query, updateData, { upsert: true });
          }
          console.log('[DoTalk Sync] Initial database seeding clone has finished flawlessly.');
        }
      } catch (err: any) {
        console.error('[DoTalk Multi-Mode DB] Error booting up MongoDB setup:', err.message || err);
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
          notifications: parsed.notifications || []
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
        notifications: []
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

  private seedDemoData() {
    // Disabled in Production mode to prevent mock/test data from seeding.
    return;
    if (this.data.users.length === 0) {
      const demoUsers: IUser[] = [
        {
          _id: 'user_larry',
          fullName: 'Larry Machigo',
          username: 'larry_machigo',
          email: 'larry@dotalk.app',
          passwordHash: '$2a$10$UnC9r6p4qP1s8DkY/I22Le4NfH78o3kYvV9876543210ABCDEF',
          bio: 'In love with modern UI design & coffee!',
          profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          lastSeen: new Date().toISOString(),
          onlineStatus: 'online',
          emailVerified: true,
          blockedUsers: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          _id: 'user_natalie',
          fullName: 'Natalie Nora',
          username: 'natalie_nora',
          email: 'natalie@dotalk.app',
          passwordHash: '$2a$10$UnC9r6p4qP1s8DkY/I22Le4NfH78o3kYvV9876543210ABCDEF',
          bio: 'Exploring active life and photography 📸',
          profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          lastSeen: new Date().toISOString(),
          onlineStatus: 'online',
          emailVerified: true,
          blockedUsers: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          _id: 'user_jennifer',
          fullName: 'Jennifer Jones',
          username: 'jennifer_j',
          email: 'jennifer@dotalk.app',
          passwordHash: '$2a$10$UnC9r6p4qP1s8DkY/I22Le4NfH78o3kYvV9876543210ABCDEF',
          bio: 'Music is life itself 🎧🎸',
          profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
          lastSeen: new Date(Date.now() - 3600000 * 2).toISOString(),
          onlineStatus: 'offline',
          emailVerified: true,
          blockedUsers: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          _id: 'user_sofia',
          fullName: 'Sofia Smith',
          username: 'sofia_s',
          email: 'sofia@dotalk.app',
          passwordHash: '$2a$10$UnC9r6p4qP1s8DkY/I22Le4NfH78o3kYvV9876543210ABCDEF',
          bio: 'Design enthusiast | Minimalist thinker',
          profilePhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
          lastSeen: new Date(Date.now() - 3600000 * 24).toISOString(),
          onlineStatus: 'offline',
          emailVerified: true,
          blockedUsers: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];

      this.data.users.push(...demoUsers);

      const chatLarry: IChat = {
        _id: 'chat_larry',
        participants: ['user_larry', 'user_johnny_test_id'],
        isGroup: false,
        pinnedUsers: ['user_johnny_test_id'],
        archivedUsers: [],
        mutedUsers: [],
        lastMessageText: 'Are you available for a New UI Project?',
        lastMessageTime: new Date(Date.now() - 600000).toISOString(),
        lastMessageSenderId: 'user_larry',
      };

      const chatNatalie: IChat = {
        _id: 'chat_natalie',
        participants: ['user_natalie', 'user_johnny_test_id'],
        isGroup: false,
        pinnedUsers: [],
        archivedUsers: [],
        mutedUsers: [],
        lastMessageText: 'natalie is typing...',
        lastMessageTime: new Date(Date.now() - 300000).toISOString(),
        lastMessageSenderId: 'user_natalie'
      };

      const chatJennifer: IChat = {
        _id: 'chat_jennifer',
        participants: ['user_jennifer', 'user_johnny_test_id'],
        isGroup: false,
        pinnedUsers: [],
        archivedUsers: [],
        mutedUsers: [],
        lastMessageText: '🎤 Voice message',
        lastMessageTime: new Date(Date.now() - 3600000 * 5).toISOString(),
        lastMessageSenderId: 'user_jennifer'
      };

      const chatGroupUX: IChat = {
        _id: 'chat_group_ux',
        participants: ['user_larry', 'user_natalie', 'user_jennifer', 'user_johnny_test_id'],
        isGroup: true,
        groupName: 'Design Systems & UX',
        groupDescription: 'Collaborating on gorgeous mobile application styles.',
        groupImage: 'https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=150',
        groupCreatorId: 'user_larry',
        groupHandlers: ['user_larry'],
        pinnedUsers: [],
        archivedUsers: [],
        mutedUsers: [],
        lastMessageText: 'Larry added you to the group',
        lastMessageTime: new Date(Date.now() - 3600000 * 12).toISOString(),
        lastMessageSenderId: 'user_larry'
      };

      this.data.chats.push(chatLarry, chatNatalie, chatJennifer, chatGroupUX);

      const demoMessages: IMessage[] = [
        {
          _id: 'msg_l1',
          chatId: 'chat_larry',
          senderId: 'user_larry',
          senderName: 'Larry Machigo',
          text: 'Hey 👋',
          reactions: [],
          isDeletedForEveryone: false,
          isEdited: false,
          deliveredTo: ['user_johnny_test_id'],
          seenBy: ['user_johnny_test_id'],
          createdAt: new Date(Date.now() - 1200000).toISOString()
        },
        {
          _id: 'msg_l2',
          chatId: 'chat_larry',
          senderId: 'user_larry',
          senderName: 'Larry Machigo',
          text: 'Are you available for a New UI Project?',
          reactions: [],
          isDeletedForEveryone: false,
          isEdited: false,
          deliveredTo: ['user_johnny_test_id'],
          seenBy: ['user_johnny_test_id'],
          createdAt: new Date(Date.now() - 600000).toISOString()
        },
        {
          _id: 'msg_n1',
          chatId: 'chat_natalie',
          senderId: 'user_natalie',
          senderName: 'Natalie Nora',
          text: 'Can we schedule the demo later today? I’ll send over the mockups.',
          reactions: [{ userId: 'user_johnny_test_id', username: 'Me', emoji: '👍' }],
          isDeletedForEveryone: false,
          isEdited: false,
          deliveredTo: ['user_johnny_test_id'],
          seenBy: [],
          createdAt: new Date(Date.now() - 300000).toISOString()
        },
        {
          _id: 'msg_j1',
          chatId: 'chat_jennifer',
          senderId: 'user_jennifer',
          senderName: 'Jennifer Jones',
          text: 'Listen to this track proposal!',
          reactions: [],
          isDeletedForEveryone: false,
          isEdited: false,
          deliveredTo: ['user_johnny_test_id'],
          seenBy: ['user_johnny_test_id'],
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
        },
        {
          _id: 'msg_j2',
          chatId: 'chat_jennifer',
          senderId: 'user_jennifer',
          senderName: 'Jennifer Jones',
          text: '',
          mediaUrl: 'https://codesandbox.io/mock-audio.mp3',
          mediaType: 'audio',
          mediaName: 'voice_memo.mp3',
          mediaSize: '1.2 MB',
          reactions: [],
          isDeletedForEveryone: false,
          isEdited: false,
          deliveredTo: ['user_johnny_test_id'],
          seenBy: ['user_johnny_test_id'],
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
        }
      ];

      this.data.messages.push(...demoMessages);

      const demoStories: IStatusStory[] = [
        {
          _id: 'story_1',
          userId: 'user_larry',
          username: 'Larry Machigo',
          userPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
          caption: 'Crafting new design systems 💻📱',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000 * 24).toISOString(),
        },
        {
          _id: 'story_2',
          userId: 'user_natalie',
          username: 'Natalie Nora',
          userPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400',
          caption: 'Morning beach run! 🌊🏃‍♀️',
          createdAt: new Date(Date.now() - 10000000).toISOString(),
          expiresAt: new Date(Date.now() + 3600000 * 21).toISOString(),
        }
      ];
      this.data.statusStories.push(...demoStories);

      this.save();
    }
  }

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

  public createOTP(email: string, codeHash: string, expiresAt: Date): IOTP {
    const newOtp: IOTP = {
      _id: 'otp_' + Math.random().toString(36).substring(2, 11),
      email,
      codeHash,
      expiresAt: expiresAt.toISOString(),
      verified: false,
      attempts: 0
    };
    this.data.otps = this.data.otps.filter(o => o.email.toLowerCase() !== email.toLowerCase());
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
      mutedUsers: [],
      unreadUsers: [],
      closedUsers: [],
      mutedUntil: {},
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

  public getStatusStories(): IStatusStory[] {
    const now = new Date().getTime();
    this.data.statusStories = (this.data.statusStories || []).filter(s => s && s.expiresAt && new Date(s.expiresAt).getTime() > now);
    return this.data.statusStories;
  }

  public createStatusStory(story: Omit<IStatusStory, '_id' | 'createdAt' | 'expiresAt'>): IStatusStory {
    const newStory: IStatusStory = {
      ...story,
      _id: 'story_' + Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000 * 24).toISOString()
    };
    this.data.statusStories.push(newStory);
    this.save();
    return newStory;
  }

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
}

export const db = new DatabaseManager();

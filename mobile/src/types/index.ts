export interface UserProfile {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  bio: string;
  profilePhoto: string;
  onlineStatus: 'online' | 'offline';
  lastSeen: string;
  emailVerified: boolean;
}

export interface ChatMessage {
  _id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file' | 'audio';
  mediaName?: string;
  mediaSize?: string;
  replyToMessageId?: string;
  replyToMessageText?: string;
  reactions: Array<{ userId: string; username: string; emoji: string }>;
  isDeletedForEveryone: boolean;
  isEdited: boolean;
  seenBy: string[];
  createdAt: string;
}

export interface ChatSession {
  _id: string;
  isGroup: boolean;
  title: string;
  image: string;
  partner?: UserProfile;
  participants: string[];
  lastMessageText: string;
  lastMessageTime: string;
  lastMessageSenderId: string;
  unreadCount: number;
}

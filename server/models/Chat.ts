import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  participants: string[]; // User IDs
  isGroup: boolean;
  groupName?: string;
  groupDescription?: string;
  groupImage?: string;
  groupCreatorId?: string;
  groupHandlers?: string[]; // Admin user IDs
  lastMessageText?: string;
  lastMessageTime?: Date;
  lastMessageSenderId?: string;
  pinnedUsers: string[]; // List of user IDs who pinned this chat
  archivedUsers: string[]; // List of user IDs who archived this chat
  isArchived?: boolean;
  isPinned?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
  unreadUsers: string[]; // List of user IDs who marked the chat as unread
  closedUsers: string[]; // List of user IDs who closed this chat
  clearedAt?: { [userId: string]: string }; // Map of userId -> ISO Date string
  deletedByUsers?: string[]; // List of user IDs who deleted this chat
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    participants: [{ type: String, required: true, index: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: '' },
    groupDescription: { type: String, default: '' },
    groupImage: { type: String, default: '' },
    groupCreatorId: { type: String, default: '' },
    groupHandlers: [{ type: String }], // Admins
    lastMessageText: { type: String, default: '' },
    lastMessageTime: { type: Date, default: Date.now },
    lastMessageSenderId: { type: String, default: '' },
    pinnedUsers: [{ type: String }],
    archivedUsers: [{ type: String }],
    isArchived: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    unreadUsers: [{ type: String }],
    closedUsers: [{ type: String }],
    clearedAt: { type: Map, of: String },
    deletedByUsers: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);

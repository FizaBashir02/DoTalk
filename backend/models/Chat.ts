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
  pinnedUsers: string[];
  archivedUsers: string[];
  mutedUsers: string[];
  unreadUsers: string[];
  closedUsers: string[];
  mutedUntil?: { [userId: string]: string };
  clearedAt?: { [userId: string]: string };
  deletedByUsers?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    _id: { type: String, required: true } as any,
    participants: [{ type: String, required: true, index: true }],
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: '' },
    groupDescription: { type: String, default: '' },
    groupImage: { type: String, default: '' },
    groupCreatorId: { type: String, default: '' },
    groupHandlers: [{ type: String }],
    lastMessageText: { type: String, default: '' },
    lastMessageTime: { type: Date, default: Date.now },
    lastMessageSenderId: { type: String, default: '' },
    pinnedUsers: [{ type: String }],
    archivedUsers: [{ type: String }],
    mutedUsers: [{ type: String }],
    unreadUsers: [{ type: String }],
    closedUsers: [{ type: String }],
    mutedUntil: { type: Map, of: String },
    clearedAt: { type: Map, of: String },
    deletedByUsers: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);

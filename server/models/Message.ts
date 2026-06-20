import mongoose, { Schema, Document } from 'mongoose';

export interface IReaction {
  userId: string;
  emoji: string;
}

export interface IMessage extends Document {
  chatId: string;
  senderId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file' | 'audio';
  mediaName?: string;
  mediaSize?: string;
  reactions: IReaction[];
  replyToMessageId?: string;
  isDeletedForEveryone: boolean;
  isEdited: boolean;
  deliveredTo: string[];
  seenBy: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ReactionSchema = new Schema<IReaction>({
  userId: { type: String, required: true },
  emoji: { type: String, required: true }
}, { _id: false });

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: String, required: true, index: true },
    senderId: { type: String, required: true, index: true },
    text: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video', 'file', 'audio', null], default: null },
    mediaName: { type: String, default: '' },
    mediaSize: { type: String, default: '' },
    reactions: [ReactionSchema],
    replyToMessageId: { type: String, default: '' },
    isDeletedForEveryone: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    deliveredTo: [{ type: String }],
    seenBy: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema);

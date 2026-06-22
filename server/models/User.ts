import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  fullName: string;
  username: string;
  email: string;
  passwordHash: string;
  bio: string;
  profilePhoto: string;
  lastSeen: Date;
  onlineStatus: 'online' | 'offline';
  emailVerified: boolean;
  blockedUsers: string[];
  contacts: string[];
  incomingRequests: string[];
  outgoingRequests: string[];
  isTestUser?: boolean;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true } as any,
    fullName: { type: String, required: true, trim: true, maxlength: 50 },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 20 },
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    passwordHash: { type: String, required: true },
    bio: { type: String, default: 'Hey there! I am using DoTalk.', maxlength: 150 },
    profilePhoto: { type: String, default: '' },
    lastSeen: { type: Date, default: Date.now },
    onlineStatus: { type: String, enum: ['online', 'offline'], default: 'offline' },
    emailVerified: { type: Boolean, default: false },
    blockedUsers: [{ type: String }],
    contacts: [{ type: String, default: [] }],
    incomingRequests: [{ type: String, default: [] }],
    outgoingRequests: [{ type: String, default: [] }],
    isTestUser: { type: Boolean, default: false },
    role: { type: String, default: '' },
  },
  { timestamps: true }
);

// Prevent mongoose model compilation errors in serverless environments
export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

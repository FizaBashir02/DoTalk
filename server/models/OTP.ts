import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  codeHash: string; // Hashed with bcrypt
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
}

const OTPSchema = new Schema<IOTP>(
  {
    _id: { type: String, required: true } as any,
    email: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 }, // max attempts limit
    createdAt: { type: Date, default: Date.now },
  }
);

export default mongoose.models.OTP || mongoose.model<IOTP>('OTP', OTPSchema);

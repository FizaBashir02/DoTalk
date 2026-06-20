import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../utils/db.js';
import { sendOTPEmail } from '../utils/email.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dotalk_secret_access_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dotalk_secret_refresh_key';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, username, email, password, confirmPassword } = req.body;

    if (!fullName || !username || !email || !password || !confirmPassword) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existingEmail = db.findUserByEmail(email);
    if (existingEmail) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const existingUsername = db.findUserByUsername(username);
    if (existingUsername) {
      res.status(400).json({ error: 'Username is already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = db.createUser({
      fullName,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      bio: 'Hey there! I am using DoTalk.',
      profilePhoto: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`,
      lastSeen: new Date().toISOString(),
      onlineStatus: 'offline',
      emailVerified: false,
      blockedUsers: [],
    });

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
    db.createOTP(email, hashedOtp, expiresAt);

    let sent = false;
    try {
      sent = await sendOTPEmail(email.toLowerCase().trim(), otpCode);
    } catch (mailError) {
      console.error('[DoTalk Mailer Error]', mailError);
    }

    res.status(201).json({
      message: 'Registration successful! Verification code sent to email.',
      email
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      res.status(400).json({ error: 'Email and OTP code are required' });
      return;
    }

    const savedOtp = db.getOTPByEmail(email);
    if (!savedOtp) {
      res.status(400).json({ error: 'No OTP found or code expired' });
      return;
    }

    if (new Date(savedOtp.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: 'OTP has expired, please request a new one' });
      return;
    }

    if (savedOtp.attempts >= 4) {
      res.status(400).json({ error: 'Too many incorrect attempts. Please resend a new OTP.' });
      return;
    }

    const isMatch = await bcrypt.compare(otpCode, savedOtp.codeHash);
    if (!isMatch) {
      savedOtp.attempts += 1;
      db.save();
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    const user = db.findUserByEmail(email);
    if (user) {
      db.updateUser(user._id, { emailVerified: true });
    }

    db.markOTPAsVerified(email);

    const payload = { userId: user?._id || '', username: user?.username || '' };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    res.status(200).json({
      message: 'Email verified successfully!',
      accessToken,
      refreshToken,
      user: {
        _id: user?._id,
        fullName: user?.fullName,
        username: user?.username,
        email: user?.email,
        bio: user?.bio,
        profilePhoto: user?.profilePhoto,
        onlineStatus: 'online',
        emailVerified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/resend-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      res.status(400).json({ error: 'No user registered with this email' });
      return;
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
    db.createOTP(email, hashedOtp, expiresAt);

    let sent = false;
    try {
      sent = await sendOTPEmail(email.toLowerCase().trim(), otpCode);
    } catch (mailError) {
      console.error('[DoTalk Mailer Error]', mailError);
    }

    res.status(200).json({
      message: 'New verification code sent!'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      res.status(400).json({ error: 'User email/username and password are required' });
      return;
    }

    const user = emailOrUsername.includes('@')
      ? db.findUserByEmail(emailOrUsername)
      : db.findUserByUsername(emailOrUsername);

    if (!user) {
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    if (!user.emailVerified) {
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration
      const otpSalt = await bcrypt.genSalt(10);
      const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
      db.createOTP(user.email, hashedOtp, expiresAt);

      let sent = false;
      try {
        sent = await sendOTPEmail(user.email.toLowerCase().trim(), otpCode);
      } catch (mailError) {
        console.error('[DoTalk Mailer Error]', mailError);
      }

      res.status(403).json({
        error: 'Please verify your email first',
        emailVerified: false,
        email: user.email
      });
      return;
    }

    db.updateUser(user._id, { onlineStatus: 'online' });

    const larryChat = db.getChatById('chat_larry');
    if (larryChat && !larryChat.participants.includes(user._id)) {
      larryChat.participants.push(user._id);
      larryChat.participants = larryChat.participants.filter(p => p !== 'user_johnny_test_id');
      db.save();
    }
    const natalieChat = db.getChatById('chat_natalie');
    if (natalieChat && !natalieChat.participants.includes(user._id)) {
      natalieChat.participants.push(user._id);
      natalieChat.participants = natalieChat.participants.filter(p => p !== 'user_johnny_test_id');
      db.save();
    }
    const jenniferChat = db.getChatById('chat_jennifer');
    if (jenniferChat && !jenniferChat.participants.includes(user._id)) {
      jenniferChat.participants.push(user._id);
      jenniferChat.participants = jenniferChat.participants.filter(p => p !== 'user_johnny_test_id');
      db.save();
    }
    const groupUX = db.getChatById('chat_group_ux');
    if (groupUX && !groupUX.participants.includes(user._id)) {
      groupUX.participants.push(user._id);
      groupUX.participants = groupUX.participants.filter(p => p !== 'user_johnny_test_id');
      db.save();
    }

    const payload = { userId: user._id, username: user.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePhoto: user.profilePhoto,
        onlineStatus: 'online',
        emailVerified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      res.status(400).json({ error: 'Unknown email address' });
      return;
    }

    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
    db.createOTP(email, hashedOtp, expiresAt);

    let sent = false;
    try {
      sent = await sendOTPEmail(email.toLowerCase().trim(), otpCode);
    } catch (mailError) {
      console.error('[DoTalk Mailer Error]', mailError);
    }

    res.status(200).json({
      message: 'OTP Code sent for password recovery',
      email
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otpCode, newPassword } = req.body;

    if (!email || !otpCode || !newPassword) {
      res.status(400).json({ error: 'Email, OTP, and new password are required' });
      return;
    }

    const savedOtp = db.getOTPByEmail(email);
    if (!savedOtp || new Date(savedOtp.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: 'Expired or invalid verification token' });
      return;
    }

    const isMatch = await bcrypt.compare(otpCode, savedOtp.codeHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Invalid verification token' });
      return;
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      res.status(400).json({ error: 'User not found' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    db.updateUser(user._id, { passwordHash });
    db.markOTPAsVerified(email);

    res.status(200).json({ message: 'Password has been reset successfully. Please log in.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/refresh', (req: Request, res: Response): void => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(403).json({ error: 'Refreshed access token denied' });
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string, username: string };
    const accessToken = jwt.sign(
      { userId: payload.userId, username: payload.username },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

export default router;

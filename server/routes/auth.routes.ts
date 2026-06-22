import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../utils/db.js';
import { sendOTPEmail } from '../utils/email.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dotalk_secret_access_key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dotalk_secret_refresh_key';

// Helper to generate cryptographically secure 6-digit OTP
function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

// REGISTER ENDPOINT (Supports both passwordless web and password-based mobile)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, username, email, password, confirmPassword } = req.body;

    if (!fullName || !email) {
      res.status(400).json({ error: 'Full name and email are required' });
      return;
    }

    const emailTrimmed = email.toLowerCase().trim();

    // Check unique email
    const existingUser = db.findUserByEmail(emailTrimmed);
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    const existingOtp = db.getOTPByEmail(emailTrimmed);
    if (existingOtp) {
      // Lockout check
      if (existingOtp.lockoutUntil && new Date(existingOtp.lockoutUntil).getTime() > Date.now()) {
        const resetMinutes = Math.ceil((new Date(existingOtp.lockoutUntil).getTime() - Date.now()) / 1000 / 60);
        res.status(429).json({ error: `Too many failed attempts. Suspended. Try again in ${resetMinutes} minute(s).` });
        return;
      }
      // Rate limiting resend requests (60 seconds)
      if (existingOtp.lastSentAt && (Date.now() - new Date(existingOtp.lastSentAt).getTime() < 60000)) {
        const waitSeconds = Math.ceil((60000 - (Date.now() - new Date(existingOtp.lastSentAt).getTime())) / 1000);
        res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new code.` });
        return;
      }
    }

    // Determine registration mode: if username or password is provided, we use the Mobile/Password mode.
    const isPasswordMode = !!(username || password || confirmPassword);

    if (isPasswordMode) {
      if (!username || !password || !confirmPassword) {
        res.status(400).json({ error: 'All fields (full name, username, email, password, confirm password) are required for password registration' });
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

      const existingUsername = db.findUserByUsername(username.toLowerCase().trim());
      if (existingUsername) {
        res.status(400).json({ error: 'Username is already taken' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create the user immediately (with emailVerified: false)
      db.createUser({
        fullName: fullName.trim(),
        username: username.toLowerCase().trim(),
        email: emailTrimmed,
        passwordHash,
        bio: 'Hey there! I am using DoTalk.',
        profilePhoto: `https://api.dicebear.com/7.x/adventurer/svg?seed=${username.toLowerCase().trim()}`,
        lastSeen: new Date().toISOString(),
        onlineStatus: 'offline',
        emailVerified: false,
        blockedUsers: [],
      });
    }

    // Generate custom 6 digit OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    // Save hashed OTP in temporary DB
    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
    
    // For passwordless mode, we save pendingName. For password mode, we don't need it.
    db.createOTP(
      emailTrimmed,
      hashedOtp,
      expiresAt,
      new Date().toISOString(),
      undefined,
      isPasswordMode ? undefined : fullName.trim()
    );

    // Print generated OTP code to server log as a diagnostic developer fallback
    console.log(`\n================================================================`);
    console.log(`[DoTalk Diagnostic] OTP generated for email: ${emailTrimmed}`);
    console.log(`[DoTalk Diagnostic] CODE: ${otpCode}`);
    console.log(`================================================================\n`);

    // Real Email Delivery in background (non-blocking) so registration never hangs and returns immediately
    sendOTPEmail(emailTrimmed, otpCode).catch((mailError: any) => {
      console.error('[DoTalk Mailer Error] SMTP background delivery failed.', mailError);
    });

    res.status(200).json({
      message: 'Verification code has been sent to your email.',
      email: emailTrimmed
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// LOGIN ENDPOINT (Supports both passwordless web and password-based mobile)
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, emailOrUsername, password } = req.body;

    // Determine login mode: if password is provided, we use the Mobile/Password mode.
    const isPasswordMode = !!password;

    if (isPasswordMode) {
      const loginIdentity = emailOrUsername || email;
      if (!loginIdentity) {
        res.status(400).json({ error: 'Email/Username and password are required' });
        return;
      }

      const loginTrimmed = loginIdentity.toLowerCase().trim();
      const user = loginTrimmed.includes('@')
        ? db.findUserByEmail(loginTrimmed)
        : db.findUserByUsername(loginTrimmed);

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

        // Real Email Delivery in background (non-blocking) so login never hangs
        sendOTPEmail(user.email.toLowerCase().trim(), otpCode).catch((mailError: any) => {
          console.error('[DoTalk Mailer Error] SMTP login background delivery failed.', mailError);
        });

        res.status(403).json({
          error: 'Please verify your email first',
          emailVerified: false,
          email: user.email
        });
        return;
      }

      db.updateUser(user._id, { onlineStatus: 'online' });

      // Join standard starter chats
      const starterChats = ['chat_larry', 'chat_natalie', 'chat_jennifer', 'chat_group_ux'];
      starterChats.forEach(chatId => {
        const chat = db.getChatById(chatId);
        if (chat && !chat.participants.includes(user._id)) {
          chat.participants.push(user._id);
          chat.participants = chat.participants.filter(p => p !== 'user_johnny_test_id');
          db.save();
        }
      });

      const payload = { userId: user._id, username: user.username };
      const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
      const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });

      res.status(200).json({
        message: 'Login successful!',
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
          emailVerified: user.emailVerified
        }
      });
      return;
    } else {
      // Passwordless mode
      const loginEmail = email || emailOrUsername;
      if (!loginEmail) {
        res.status(400).json({ error: 'Email address is required' });
        return;
      }

      const emailTrimmed = loginEmail.toLowerCase().trim();

      // Check if user exists
      const user = db.findUserByEmail(emailTrimmed);
      if (!user) {
        res.status(404).json({ error: 'No account found with this email. Please sign up.' });
        return;
      }

      // Check resend and lockout limits
      const existingOtp = db.getOTPByEmail(emailTrimmed);
      if (existingOtp) {
        // Lockout check
        if (existingOtp.lockoutUntil && new Date(existingOtp.lockoutUntil).getTime() > Date.now()) {
          const resetMinutes = Math.ceil((new Date(existingOtp.lockoutUntil).getTime() - Date.now()) / 1000 / 60);
          res.status(429).json({ error: `Too many failed attempts. Suspended. Try again in ${resetMinutes} minute(s).` });
          return;
        }
        // Rate limiting resend requests (60 seconds)
        if (existingOtp.lastSentAt && (Date.now() - new Date(existingOtp.lastSentAt).getTime() < 60000)) {
          const waitSeconds = Math.ceil((60000 - (Date.now() - new Date(existingOtp.lastSentAt).getTime())) / 1000);
          res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new code.` });
          return;
        }
      }

      // Generate custom 6 digit OTP
      const otpCode = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      // Save hashed OTP in temporary DB
      const otpSalt = await bcrypt.genSalt(10);
      const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
      db.createOTP(emailTrimmed, hashedOtp, expiresAt, new Date().toISOString());

      // Real Email Delivery in background (non-blocking) so OTP resend never hangs
      sendOTPEmail(emailTrimmed, otpCode).catch((mailError: any) => {
        console.error('[DoTalk Mailer Error] SMTP resend background delivery failed.', mailError);
      });

      res.status(200).json({
        message: 'Verification code has been sent to your email.',
        email: emailTrimmed
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// VERIFY OTP (Checks OTP and logs in / creates account)
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      res.status(400).json({ error: 'Email and OTP code are required' });
      return;
    }

    const emailTrimmed = email.toLowerCase().trim();

    const savedOtp = db.getOTPByEmail(emailTrimmed);
    if (!savedOtp) {
      res.status(400).json({ error: 'No OTP found or code expired. Please request a new one.' });
      return;
    }

    // Lockout check
    if (savedOtp.lockoutUntil && new Date(savedOtp.lockoutUntil).getTime() > Date.now()) {
      const resetMinutes = Math.ceil((new Date(savedOtp.lockoutUntil).getTime() - Date.now()) / 1000 / 60);
      res.status(403).json({ error: `Too many failed attempts. Temporarily suspended. Try again in ${resetMinutes} minute(s).` });
      return;
    }

    // Expiry check
    if (new Date(savedOtp.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: 'OTP has expired. Please resend.' });
      return;
    }

    // Verify OTP code
    const isMatch = await bcrypt.compare(otpCode, savedOtp.codeHash);
    if (!isMatch) {
      savedOtp.attempts += 1;
      
      // Lockout user after 5 failed attempts
      if (savedOtp.attempts >= 5) {
        const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
        savedOtp.lockoutUntil = lockoutTime.toISOString();
        db.save();
        res.status(403).json({ error: 'Too many incorrect attempts. You are temporarily locked out for 15 minutes.' });
        return;
      }
      
      db.save();
      const remainingAttempts = 5 - savedOtp.attempts;
      res.status(400).json({ error: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.` });
      return;
    }

    // Mark OTP as verified
    db.markOTPAsVerified(emailTrimmed);

    let user = db.findUserByEmail(emailTrimmed);

    if (!user) {
      // Registration flow (create account post successful verification - Web / Passwordless style)
      if (!savedOtp.pendingName) {
        res.status(400).json({ error: 'Registration state is missing. Please sign up again.' });
        return;
      }

      // Generate unique username
      const cleanEmailPrefix = emailTrimmed.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      let baseUsername = cleanEmailPrefix.substring(0, 15).toLowerCase();
      if (baseUsername.length < 3) baseUsername = 'user';
      
      let finalUsername = baseUsername;
      let suffix = 1;
      while (db.findUserByUsername(finalUsername)) {
        finalUsername = `${baseUsername}${suffix}`;
        suffix++;
      }

      // Generate random password hash to satisfy schema constraint
      const randomPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const salt = await bcrypt.genSalt(10);
      const randomPasswordHash = await bcrypt.hash(randomPassword, salt);

      user = db.createUser({
        fullName: savedOtp.pendingName,
        username: finalUsername,
        email: emailTrimmed,
        passwordHash: randomPasswordHash,
        bio: 'Hey there! I am using DoTalk.',
        profilePhoto: `https://api.dicebear.com/7.x/adventurer/svg?seed=${finalUsername}`,
        lastSeen: new Date().toISOString(),
        onlineStatus: 'online',
        emailVerified: true,
        blockedUsers: [],
      });
    } else {
      // Login flow or Mobile/Password registration verification
      db.updateUser(user._id, { onlineStatus: 'online', emailVerified: true });
    }

    // Reset OTP record state on success
    savedOtp.pendingName = undefined;
    savedOtp.attempts = 0;
    savedOtp.lockoutUntil = undefined;
    db.save();

    // Auto join starter chats
    const starterChats = ['chat_larry', 'chat_natalie', 'chat_jennifer', 'chat_group_ux'];
    starterChats.forEach(chatId => {
      const chat = db.getChatById(chatId);
      if (chat && !chat.participants.includes(user!._id)) {
        chat.participants.push(user!._id);
        chat.participants = chat.participants.filter(p => p !== 'user_johnny_test_id');
        db.save();
      }
    });

    // Generate JWT tokens
    const payload = { userId: user._id, username: user.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    res.status(200).json({
      message: 'OTP verified successfully!',
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

// RESEND OTP
router.post('/resend-otp', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const emailTrimmed = email.toLowerCase().trim();

    const existingOtp = db.getOTPByEmail(emailTrimmed);
    if (existingOtp) {
      // Lockout check
      if (existingOtp.lockoutUntil && new Date(existingOtp.lockoutUntil).getTime() > Date.now()) {
        const resetMinutes = Math.ceil((new Date(existingOtp.lockoutUntil).getTime() - Date.now()) / 1000 / 60);
        res.status(429).json({ error: `Too many failed attempts. Suspended. Try again in ${resetMinutes} minute(s).` });
        return;
      }
      // Rate limit check
      if (existingOtp.lastSentAt && (Date.now() - new Date(existingOtp.lastSentAt).getTime() < 60000)) {
        const waitSeconds = Math.ceil((60000 - (Date.now() - new Date(existingOtp.lastSentAt).getTime())) / 1000);
        res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new code.` });
        return;
      }
    }

    // Generate custom 6 digit OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    const otpSalt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otpCode, otpSalt);
    
    // Save new OTP keeping pending name intact if exists
    db.createOTP(emailTrimmed, hashedOtp, expiresAt, new Date().toISOString(), undefined, existingOtp?.pendingName);

    // Real Email Delivery in background (non-blocking) so forgot password never hangs
    sendOTPEmail(emailTrimmed, otpCode).catch((mailError: any) => {
      console.error('[DoTalk Mailer Error] SMTP forgot password background delivery failed.', mailError);
    });

    res.status(200).json({
      message: 'Verification code has been sent to your email.'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// REFRESH TOKEN
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

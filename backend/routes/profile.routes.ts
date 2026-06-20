import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../utils/db.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = db.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      bio: user.bio,
      profilePhoto: user.profilePhoto,
      onlineStatus: user.onlineStatus,
      lastSeen: user.lastSeen,
      emailVerified: user.emailVerified,
      blockedUsers: user.blockedUsers
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/update', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { fullName, bio, profilePhoto } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updates: any = {};
    if (fullName !== undefined) {
      if (fullName.length > 50) {
        res.status(400).json({ error: 'Full name can exceed max 50 characters' });
        return;
      }
      updates.fullName = fullName;
    }
    if (bio !== undefined) {
      if (bio.length > 150) {
        res.status(400).json({ error: 'Bio can exceed max 150 characters' });
        return;
      }
      updates.bio = bio;
    }
    if (profilePhoto !== undefined) {
      updates.profilePhoto = profilePhoto;
    }

    const updated = db.updateUser(userId, updates);
    res.status(200).json({
      message: 'Profile updated success',
      user: updated
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/username', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { username } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const cleanUsername = username.toLowerCase().trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      return;
    }

    const regex = /^[a-zA-Z0-9_]+$/;
    if (!regex.test(cleanUsername)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
      return;
    }

    const existing = db.findUserByUsername(cleanUsername);
    if (existing && existing._id !== userId) {
      res.status(400).json({ error: 'Username is already taken' });
      return;
    }

    const updated = db.updateUser(userId, { username: cleanUsername });

    res.status(200).json({
      message: 'Username updated',
      user: updated
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/password', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New password confirmation does not match' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const user = db.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Incorrect current password' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    db.updateUser(userId, { passwordHash });

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;

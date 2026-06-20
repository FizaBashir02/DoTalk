import express, { Response } from 'express';
import { db } from '../utils/db.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/search', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const query = (req.query.query as string || '').toLowerCase().trim();
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const users = db.getUsers().filter(u => {
      if (u._id === currentUserId) return false;
      if (!u.emailVerified) return false;

      const matches = u.fullName.toLowerCase().includes(query) ||
                      u.username.toLowerCase().includes(query) ||
                      u.email.toLowerCase().includes(query);

      return matches;
    });

    res.status(200).json(users.map(u => ({
      _id: u._id,
      fullName: u.fullName,
      username: u.username,
      bio: u.bio,
      profilePhoto: u.profilePhoto,
      onlineStatus: u.onlineStatus,
      lastSeen: u.lastSeen
    })));
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = db.findUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      bio: user.bio,
      profilePhoto: user.profilePhoto,
      onlineStatus: user.onlineStatus,
      lastSeen: user.lastSeen,
      isBlocked: user.blockedUsers.includes(req.user?.userId || '')
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/block', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    const { userIdToBlock } = req.body;

    if (!currentUserId || !userIdToBlock) {
      res.status(400).json({ error: 'User ID to block is required' });
      return;
    }

    const user = db.findUserById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'Self account error' });
      return;
    }

    const blockedList = [...(user.blockedUsers || [])];
    if (!blockedList.includes(userIdToBlock)) {
      blockedList.push(userIdToBlock);
      db.updateUser(currentUserId, { blockedUsers: blockedList });
    }

    res.status(200).json({ message: 'User blocked successfully', blockedUsers: blockedList });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/unblock', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    const { userIdToUnblock } = req.body;

    if (!currentUserId || !userIdToUnblock) {
      res.status(400).json({ error: 'User ID to unblock is required' });
      return;
    }

    const user = db.findUserById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'Self account error' });
      return;
    }

    let blockedList = [...(user.blockedUsers || [])];
    if (blockedList.includes(userIdToUnblock)) {
      blockedList = blockedList.filter(id => id !== userIdToUnblock);
      db.updateUser(currentUserId, { blockedUsers: blockedList });
    }

    res.status(200).json({ message: 'User unblocked successfully', blockedUsers: blockedList });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;

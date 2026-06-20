import express, { Response } from 'express';
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

    const stories = db.getStatusStories();
    res.status(200).json(stories);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { mediaUrl, caption } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!mediaUrl) {
      res.status(400).json({ error: 'Status image or video is required' });
      return;
    }

    const user = db.findUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newStory = db.createStatusStory({
      userId,
      username: user.fullName,
      userPhoto: user.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`,
      mediaUrl,
      caption: caption || ''
    });

    res.status(201).json(newStory);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;

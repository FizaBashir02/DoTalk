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

    const chats = db.getChatsForUser(userId);

    const formattedChats = chats.map(c => {
      let partner: any = null;
      let title = '';
      let image = '';

      if (c.isGroup) {
        title = c.groupName || 'Design Studio';
        image = c.groupImage || '';
      } else {
        const partnerId = c.participants.find(id => id !== userId);
        if (partnerId) {
          const uObj = db.findUserById(partnerId);
          if (uObj) {
            partner = {
              _id: uObj._id,
              fullName: uObj.fullName,
              username: uObj.username,
              bio: uObj.bio,
              profilePhoto: uObj.profilePhoto,
              onlineStatus: uObj.onlineStatus,
              lastSeen: uObj.lastSeen
            };
            title = uObj.fullName;
            image = uObj.profilePhoto;
          }
        }
      }

      const chatMessages = db.getMessagesForChat(c._id);
      const unreadCount = chatMessages.filter(m => m.senderId !== userId && !m.seenBy.includes(userId)).length;

      return {
        _id: c._id,
        isGroup: c.isGroup,
        title,
        image,
        partner,
        groupDescription: c.groupDescription,
        groupCreatorId: c.groupCreatorId,
        groupHandlers: c.groupHandlers || [],
        participants: c.participants,
        lastMessageText: c.lastMessageText || 'No messages yet',
        lastMessageTime: c.lastMessageTime || new Date().toISOString(),
        lastMessageSenderId: c.lastMessageSenderId,
        unreadCount,
        isPinned: c.pinnedUsers.includes(userId),
        isArchived: c.archivedUsers.includes(userId),
        isMuted: c.mutedUsers.includes(userId)
      };
    }).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    res.status(200).json(formattedChats);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const creatorId = req.user?.userId;
    const { partnerId, isGroup, groupName, groupDescription, groupImage, participants } = req.body;

    if (!creatorId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (isGroup) {
      if (!groupName) {
        res.status(400).json({ error: 'Group name is required' });
        return;
      }
      const members = Array.from(new Set([creatorId, ...(participants || [])]));
      const newGroup = db.createChat(members, true, {
        name: groupName,
        description: groupDescription || 'No description provided.',
        image: groupImage || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
        creatorId
      });
      res.status(201).json(newGroup);
    } else {
      if (!partnerId) {
        res.status(400).json({ error: 'Partner user ID is required' });
        return;
      }

      const existing = db.getChatsForUser(creatorId).find(c =>
        !c.isGroup && c.participants.includes(partnerId) && c.participants.includes(creatorId)
      );

      if (existing) {
        res.status(200).json(existing);
        return;
      }

      const newChat = db.createChat([creatorId, partnerId], false);
      res.status(201).json(newChat);
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.get('/:chatId/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const messages = db.getMessagesForChat(chatId);

    let updatedNeeded = false;
    messages.forEach(m => {
      if (m.senderId !== userId && !m.seenBy.includes(userId)) {
        m.seenBy.push(userId);
        updatedNeeded = true;
      }
    });

    if (updatedNeeded) {
      db.save();
    }

    res.status(200).json(messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/:chatId/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const senderId = req.user?.userId;
    const senderName = req.user?.username || 'User';
    const { chatId } = req.params;
    const { text, mediaUrl, mediaType, mediaName, mediaSize, replyToMessageId } = req.body;

    if (!senderId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chat = db.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Conversation chat not found' });
      return;
    }

    let replyText = '';
    if (replyToMessageId) {
      const parentMsg = db.getMessagesForChat(chatId).find(m => m._id === replyToMessageId);
      if (parentMsg) {
        replyText = parentMsg.text || 'Media attachment';
      }
    }

    const newMessage = db.createMessage({
      chatId,
      senderId,
      senderName: db.findUserById(senderId)?.fullName || senderName,
      text: text || '',
      reactions: [],
      replyToMessageId,
      replyToMessageText: replyText,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize,
      isDeletedForEveryone: false,
      isEdited: false,
      deliveredTo: [senderId],
      seenBy: [senderId]
    });

    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/:chatId/pin', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chat = db.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const pinnedList = [...(chat.pinnedUsers || [])];
    if (pinnedList.includes(userId)) {
      chat.pinnedUsers = pinnedList.filter(id => id !== userId);
    } else {
      chat.pinnedUsers = [...pinnedList, userId];
    }
    db.save();

    res.status(200).json({ message: 'Pin updated success', chat });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/:chatId/archive', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chat = db.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const archList = [...(chat.archivedUsers || [])];
    if (archList.includes(userId)) {
      chat.archivedUsers = archList.filter(id => id !== userId);
    } else {
      chat.archivedUsers = [...archList, userId];
    }
    db.save();

    res.status(200).json({ message: 'Archive updated success', chat });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/:chatId/mute', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chat = db.getChatById(chatId);
    if (!chat) {
      res.status(404).json({ error: 'Chat not found' });
      return;
    }

    const muteList = [...(chat.mutedUsers || [])];
    if (muteList.includes(userId)) {
      chat.mutedUsers = muteList.filter(id => id !== userId);
    } else {
      chat.mutedUsers = [...muteList, userId];
    }
    db.save();

    res.status(200).json({ message: 'Mute toggled successfully', chat });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/:chatId/messages/:messageId/react', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const username = req.user?.username || 'User';
    const { chatId, messageId } = req.params;
    const { emoji } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const msgs = db.getMessagesForChat(chatId);
    const msg = msgs.find(m => m._id === messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const existingIndex = msg.reactions.findIndex(r => r.userId === userId);
    if (existingIndex !== -1) {
      if (msg.reactions[existingIndex].emoji === emoji) {
        msg.reactions.splice(existingIndex, 1);
      } else {
        msg.reactions[existingIndex].emoji = emoji;
      }
    } else {
      msg.reactions.push({ userId, username, emoji });
    }

    db.save();
    res.status(200).json(msg);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.post('/:chatId/messages/:messageId/delete', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId, messageId } = req.params;
    const { everyone } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const msgs = db.getMessagesForChat(chatId);
    const msg = msgs.find(m => m._id === messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (everyone) {
      if (msg.senderId !== userId) {
        res.status(403).json({ error: 'You can only delete your own messages for everyone' });
        return;
      }
      msg.text = '🚫 This message was deleted';
      msg.mediaUrl = '';
      msg.mediaType = undefined;
      msg.isDeletedForEveryone = true;
    } else {
      msg.text = '🚫 This message was deleted';
    }

    db.save();
    res.status(200).json(msg);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

router.put('/:chatId/messages/:messageId', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId, messageId } = req.params;
    const { newText } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const msgs = db.getMessagesForChat(chatId);
    const msg = msgs.find(m => m._id === messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (msg.senderId !== userId) {
      res.status(403).json({ error: 'Cannot edit some other users message' });
      return;
    }

    msg.text = newText;
    msg.isEdited = true;
    db.save();

    res.status(200).json(msg);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;

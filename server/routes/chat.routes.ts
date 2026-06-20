import express, { Response } from 'express';
import { db } from '../utils/db.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const router = express.Router();

// FETCH RECENT CHATS (WITH PARTICIPANTS DETAILED)
router.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Filter out chats that are deleted by this user
    const chats = db.getChatsForUser(userId).filter(c => !(c.deletedByUsers || []).includes(userId));

    // Format chat elements with partner metadata or group detail
    const formattedChats = chats.map(c => {
      let partner: any = null;
      let title = '';
      let image = '';

      if (c.isGroup) {
        title = c.groupName || 'Design Studio';
        image = c.groupImage || '';
      } else {
        // Find other participant
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

      // Filter messages if clearedAt is set
      const clearTime = c.clearedAt && c.clearedAt[userId] ? new Date(c.clearedAt[userId]).getTime() : null;
      const chatMessages = db.getMessagesForChat(c._id).filter(m => {
        if (clearTime) {
          return new Date(m.createdAt).getTime() > clearTime;
        }
        return true;
      });

      let unreadCount = chatMessages.filter(m => m.senderId !== userId && !(m.seenBy || []).includes(userId)).length;
      
      const isMarkedUnread = (c.unreadUsers || []).includes(userId);
      if (isMarkedUnread && unreadCount === 0) {
        unreadCount = 1; // Show at least 1 or dot
      }

      // Mute computed logic removed
      let isMuted = false;

      const lastMsg = chatMessages[chatMessages.length - 1];
      const lastMsgText = lastMsg ? (lastMsg.text || (lastMsg.mediaType ? `📎 ${lastMsg.mediaType}` : 'Media file')) : 'No messages yet';
      const lastMsgTime = lastMsg ? lastMsg.createdAt : (c.lastMessageTime || new Date().toISOString());
      const lastMsgSenderId = lastMsg ? lastMsg.senderId : c.lastMessageSenderId;

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
        lastMessageText: lastMsgText,
        lastMessageTime: lastMsgTime,
        lastMessageSenderId: lastMsgSenderId,
        unreadCount,
        isPinned: (c.pinnedUsers || []).includes(userId),
        isArchived: (c.archivedUsers || []).includes(userId),
        isMuted,
        isMarkedUnread,
        isClosed: (c.closedUsers || []).includes(userId)
      };
    }).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    res.status(200).json(formattedChats);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// CREATE ONE-TO-ONE OR GROUP CHAT
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
      // Combine initiator + other participants
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

      // Enforce: Must be a verified contact to start direct chat
      const selfObj = db.findUserById(creatorId);
      if (!selfObj || !(selfObj.contacts || []).includes(partnerId)) {
        res.status(403).json({ error: 'You can only start direct chats with people in your contact list.' });
        return;
      }

      // Check if chat already exists
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

// FETCH MESSAGES FOR CHAT
router.get('/:chatId/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const chat = db.getChatById(chatId);
    let messages = db.getMessagesForChat(chatId);

    // Filter messages if clearedAt is set
    if (chat && chat.clearedAt && chat.clearedAt[userId]) {
      const clearTime = new Date(chat.clearedAt[userId]).getTime();
      messages = messages.filter(m => new Date(m.createdAt).getTime() > clearTime);
    }

    // Reset manually marked unread status if any
    if (chat && chat.unreadUsers && chat.unreadUsers.includes(userId)) {
      const remainingUnreadUsers = chat.unreadUsers.filter(id => id !== userId);
      db.updateChat(chatId, { unreadUsers: remainingUnreadUsers });
    }

    // Mark messages as read by user
    let updatedNeeded = false;
    messages.forEach(m => {
      if (m.senderId !== userId && !(m.seenBy || []).includes(userId)) {
        if (!m.seenBy) m.seenBy = [];
        m.seenBy.push(userId);
        db.updateMessage(m._id, { seenBy: m.seenBy });
        updatedNeeded = true;
      }
    });

    res.status(200).json(messages);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// SEND MESSAGE (TEXT/MEDIA)
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

    // 1. Check if the conversation is closed by sender
    if ((chat.closedUsers || []).includes(senderId)) {
      res.status(403).json({ error: 'This conversation is closed. Reopen it to send messages.' });
      return;
    }

    // 2. Block lists check for 1-to-1 chats
    if (!chat.isGroup) {
      const partnerId = chat.participants.find(id => id !== senderId);
      if (partnerId) {
        const partnerUser = db.findUserById(partnerId);
        const selfUser = db.findUserById(senderId);
        if (partnerUser && (partnerUser.blockedUsers || []).includes(senderId)) {
          res.status(403).json({ error: 'This user has blocked you. Messages cannot be sent.' });
          return;
        }
        if (selfUser && (selfUser.blockedUsers || []).includes(partnerId)) {
          res.status(403).json({ error: 'You have blocked this contact. Unblock them in settings to chat.' });
          return;
        }
        
        // Contact list check
        if (selfUser && !(selfUser.contacts || []).includes(partnerId)) {
          res.status(403).json({ error: 'You can only message users in your contact list.' });
          return;
        }
      }
    }

    // If chat was deleted previously, remove deleted status so it pops back up for both
    if (chat.deletedByUsers && chat.deletedByUsers.length > 0) {
      db.updateChat(chatId, { deletedByUsers: [] });
    }

    // Optional reply text extraction
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

// PIN / UNPIN CHAT
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
    const isNowPinned = !pinnedList.includes(userId);
    const newPinnedUsers = pinnedList.includes(userId)
      ? pinnedList.filter(id => id !== userId)
      : [...pinnedList, userId];
    
    db.updateChat(chatId, { 
      pinnedUsers: newPinnedUsers,
      isPinned: isNowPinned
    });

    res.status(200).json({ message: 'Pin updated success', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// ARCHIVE / UNARCHIVE CHAT
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

    const archList = chat.archivedUsers || [];
    const isCurrentlyArchived = archList.includes(userId);

    if (isCurrentlyArchived) {
      db.unarchiveChat(chatId, userId);
    } else {
      db.archiveChat(chatId, userId);
    }

    res.status(200).json({ message: 'Archive updated success', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// UNARCHIVE CHAT DEDICATED ENDPOINT
router.post('/:chatId/unarchive', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    db.unarchiveChat(chatId, userId);

    res.status(200).json({ message: 'Unarchived successfully', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Mute endpoint logic removed completely

// MARK CHAT AS UNREAD
router.post('/:chatId/unread', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    const unreadUsers = chat.unreadUsers || [];
    if (!unreadUsers.includes(userId)) {
      chat.unreadUsers = [...unreadUsers, userId];
    }
    db.updateChat(chatId, { unreadUsers: chat.unreadUsers });

    res.status(200).json({ message: 'Marked as unread successfully', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// MARK CHAT AS READ (CLEAR ALL UNREAD COUNTS + MANUAL UNREAD TAG)
router.post('/:chatId/read', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    // 1. Remove from manually marked unread users
    let nextUnreadUsers = chat.unreadUsers || [];
    if (nextUnreadUsers.includes(userId)) {
      nextUnreadUsers = nextUnreadUsers.filter(id => id !== userId);
    }

    // 2. Mark all messages in this chat as seen by current user
    const messages = db.getMessagesForChat(chatId);
    messages.forEach(m => {
      if (m.senderId !== userId && !(m.seenBy || []).includes(userId)) {
        const nextSeen = [...(m.seenBy || []), userId];
        db.updateMessage(m._id, { seenBy: nextSeen });
      }
    });

    db.updateChat(chatId, { unreadUsers: nextUnreadUsers });
    res.status(200).json({ message: 'Chat marked as read successfully', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// CLEAR CHAT MESSAGES FOR CURRENT USER
router.post('/:chatId/clear', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    // Purge/clear messages belonging to this chat
    db.clearMessagesForChat(chatId);

    const clearedAtMap = { ...(chat.clearedAt || {}) };
    clearedAtMap[userId] = new Date().toISOString();

    const remainingUnreadUsers = (chat.unreadUsers || []).filter(id => id !== userId);

    db.updateChat(chatId, {
      clearedAt: clearedAtMap,
      unreadUsers: remainingUnreadUsers,
      lastMessageText: '',
      lastMessageSenderId: ''
    });

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('chat_messages_cleared', { chatId });
      io.emit('chat_list_update', { chatId });
    }

    res.status(200).json({ message: 'Chat cleared successfully', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// DELETE CHAT FROM CHAT LIST
router.post('/:chatId/delete', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    // Delete the conversation completely and permanently
    db.deleteChat(chatId);

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('chat_deleted', { chatId });
      io.emit('chat_list_update', { chatId });
    }

    res.status(200).json({ message: 'Chat deleted completely' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// CLOSE CHAT
router.post('/:chatId/close', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    const closedList = chat.closedUsers || [];
    const newClosedList = closedList.includes(userId) ? closedList : [...closedList, userId];

    db.updateChat(chatId, {
      closedUsers: newClosedList
    });

    res.status(200).json({ message: 'Chat closed successfully', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// REOPEN CHAT
router.post('/:chatId/reopen', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
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

    const closedList = chat.closedUsers || [];
    const newClosedList = closedList.filter(id => id !== userId);

    db.updateChat(chatId, {
      closedUsers: newClosedList
    });

    res.status(200).json({ message: 'Chat reopened successfully', chat: db.getChatById(chatId) });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// REACTION TO MESSAGES
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

    // Find the message
    const msgs = db.getMessagesForChat(chatId);
    const msg = msgs.find(m => m._id === messageId);
    if (!msg) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Toggle reaction or append
    const nextReactions = [...msg.reactions];
    const existingIndex = nextReactions.findIndex(r => r.userId === userId);
    if (existingIndex !== -1) {
      if (nextReactions[existingIndex].emoji === emoji) {
        // Toggle off if same emoji
        nextReactions.splice(existingIndex, 1);
      } else {
        // Change emoji
        nextReactions[existingIndex].emoji = emoji;
      }
    } else {
      nextReactions.push({ userId, username, emoji });
    }

    db.updateMessage(messageId, { reactions: nextReactions });
    res.status(200).json(db.getMessagesForChat(chatId).find(m => m._id === messageId));
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// EDIT OR REMOVE MESSAGES (DELETE FOR EVERYONE/ME)
router.post('/:chatId/messages/:messageId/delete', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const userId = req.user?.userId;
    const { chatId, messageId } = req.params;
    const { everyone } = req.body; // true = for everyone, false = for me

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
      db.updateMessage(messageId, {
        text: '🚫 This message was deleted',
        mediaUrl: '',
        mediaType: undefined,
        isDeletedForEveryone: true
      });
    } else {
      // Delete for me
      db.updateMessage(messageId, {
        text: '🚫 This message was deleted',
        mediaUrl: '',
        mediaType: undefined
      });
    }

    res.status(200).json(db.getMessagesForChat(chatId).find(m => m._id === messageId));
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// EDIT MESSAGE TEXT
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

    db.updateMessage(messageId, {
      text: newText,
      isEdited: true
    });

    res.status(200).json(db.getMessagesForChat(chatId).find(m => m._id === messageId));
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

export default router;

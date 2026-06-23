import express, { Response } from 'express';
import { db } from '../utils/db.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const router = express.Router();

// SEARCH USERS & CONTACT LIST
router.get('/search', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const query = (req.query.query as string || '').toLowerCase().trim();
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Return users matching query, excluding current user
    const users = db.getUsers().filter(u => {
      if (u._id === currentUserId) return false;
      if (!u.emailVerified) return false; // Only search verified

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

// GET BLOCKED USERS LIST
router.get('/blocked', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = db.findUserById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const blockedIds = user.blockedUsers || [];
    const blockedRecords = db.getBlockedUsersForUser(currentUserId) || [];

    const result = blockedIds.map(id => {
      const uObj = db.findUserById(id);
      if (!uObj) return null;
      
      const record = blockedRecords.find(r => r.blockedUserId === id);
      return {
        _id: uObj._id,
        fullName: uObj.fullName,
        username: uObj.username,
        email: uObj.email,
        bio: uObj.bio,
        profilePhoto: uObj.profilePhoto,
        onlineStatus: uObj.onlineStatus,
        lastSeen: uObj.lastSeen,
        blockedAt: record ? record.createdAt : new Date().toISOString()
      };
    }).filter(Boolean);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// GET USER DETAILS
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

// BLOCK USER
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
    db.addBlockedUser(currentUserId, userIdToBlock);

    // Update isBlocked flag on the chat between these two users
    const userChats = db.getChatsForUser(currentUserId);
    const targetChat = userChats.find(c => !c.isGroup && c.participants.includes(userIdToBlock));
    if (targetChat) {
      db.updateChat(targetChat._id, { isBlocked: true });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_list_update', { userId: currentUserId });
    }

    res.status(200).json({ message: 'User blocked successfully', blockedUsers: blockedList });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// GET FULL DETAILS FOR VERIFIED CONTACTS LIST
router.get('/contacts/all', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = db.findUserById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const contactIds = user.contacts || [];
    const contactList = contactIds.map(id => {
      const contactObj = db.findUserById(id);
      if (!contactObj) return null;
      return {
        _id: contactObj._id,
        fullName: contactObj.fullName,
        username: contactObj.username,
        bio: contactObj.bio,
        profilePhoto: contactObj.profilePhoto,
        onlineStatus: contactObj.onlineStatus,
        lastSeen: contactObj.lastSeen
      };
    }).filter(Boolean);

    res.status(200).json(contactList);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// GET PENDING CONTACT REQUESTS
router.get('/contacts/pending', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = db.findUserById(currentUserId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const incomingIds = user.incomingRequests || [];
    const outgoingIds = user.outgoingRequests || [];

    const incomingList = incomingIds.map(id => {
      const u = db.findUserById(id);
      return u ? { _id: u._id, fullName: u.fullName, username: u.username, profilePhoto: u.profilePhoto } : null;
    }).filter(Boolean);

    const outgoingList = outgoingIds.map(id => {
      const u = db.findUserById(id);
      return u ? { _id: u._id, fullName: u.fullName, username: u.username, profilePhoto: u.profilePhoto } : null;
    }).filter(Boolean);

    res.status(200).json({ incoming: incomingList, outgoing: outgoingList });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST SEND CONTACT REQUEST BY USERNAME
router.post('/contacts/request', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    const { username } = req.body;

    if (!currentUserId || !username) {
      res.status(400).json({ error: 'Target username is required' });
      return;
    }

    const selfUser = db.findUserById(currentUserId);
    if (!selfUser) {
      res.status(404).json({ error: 'Self account error' });
      return;
    }

    const targetUsernameClean = username.replace('@', '').trim().toLowerCase();
    const targetUser = db.findUserByUsername(targetUsernameClean);

    if (!targetUser) {
      res.status(404).json({ error: `User @${targetUsernameClean} was not found` });
      return;
    }

    if (targetUser._id === currentUserId) {
      res.status(400).json({ error: 'You cannot add yourself' });
      return;
    }

    const contacts = selfUser.contacts || [];
    if (contacts.includes(targetUser._id)) {
      res.status(400).json({ error: 'User is already in your contacts list' });
      return;
    }

    const outgoing = selfUser.outgoingRequests || [];
    if (outgoing.includes(targetUser._id)) {
      res.status(400).json({ error: 'You have already sent a contact request to this user' });
      return;
    }

    const incoming = selfUser.incomingRequests || [];
    if (incoming.includes(targetUser._id)) {
      res.status(400).json({ error: 'This user has already sent you a request. Go accept it!' });
      return;
    }

    // Update Self User
    const updatedOutgoing = [...outgoing, targetUser._id];
    db.updateUser(currentUserId, { outgoingRequests: updatedOutgoing });

    // Update Target User
    const targetIncoming = targetUser.incomingRequests || [];
    const updatedTargetIncoming = [...targetIncoming, currentUserId];
    db.updateUser(targetUser._id, { incomingRequests: updatedTargetIncoming });

    // Emit live update signal via Sockets if online
    const io = req.app.get('io');
    if (io) {
      io.emit('contact_request_update', { senderId: currentUserId, receiverId: targetUser._id });
    }

    res.status(200).json({ message: 'Contact request sent successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST ACCEPT CONTACT REQUEST
router.post('/contacts/accept', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    const { targetId } = req.body;

    if (!currentUserId || !targetId) {
      res.status(400).json({ error: 'Target user ID is required' });
      return;
    }

    const selfUser = db.findUserById(currentUserId);
    const targetUser = db.findUserById(targetId);

    if (!selfUser || !targetUser) {
      res.status(404).json({ error: 'User records could not be resolved' });
      return;
    }

    // Clean up request lists
    const selfIncoming = (selfUser.incomingRequests || []).filter(id => id !== targetId);
    const targetOutgoing = (targetUser.outgoingRequests || []).filter(id => id !== currentUserId);

    // Add to each other's contacts
    const selfContacts = Array.from(new Set([...(selfUser.contacts || []), targetId]));
    const targetContacts = Array.from(new Set([...(targetUser.contacts || []), currentUserId]));

    db.updateUser(currentUserId, {
      incomingRequests: selfIncoming,
      contacts: selfContacts
    });

    db.updateUser(targetId, {
      outgoingRequests: targetOutgoing,
      contacts: targetContacts
    });

    // Check if chat already exists, otherwise automatically create one
    const userChats = db.getChatsForUser(currentUserId);
    let targetChat = userChats.find(c => !c.isGroup && c.participants.includes(targetId));
    if (!targetChat) {
      targetChat = db.createChat([currentUserId, targetId], false);
    }

    // Emit live update signal
    const io = req.app.get('io');
    if (io) {
      io.emit('contact_accepted', { senderId: targetId, receiverId: currentUserId, chatId: targetChat._id });
      io.emit('chat_list_update', { userId: currentUserId });
      io.emit('chat_list_update', { userId: targetId });
    }

    res.status(200).json({ message: 'Request accepted, contact added', chatId: targetChat._id });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST REJECT/CANCEL CONTACT REQUEST
router.post('/contacts/reject', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    const { targetId } = req.body;

    if (!currentUserId || !targetId) {
      res.status(400).json({ error: 'Target user ID is required' });
      return;
    }

    const selfUser = db.findUserById(currentUserId);
    const targetUser = db.findUserById(targetId);

    if (selfUser) {
      const selfIncoming = (selfUser.incomingRequests || []).filter(id => id !== targetId);
      const selfOutgoing = (selfUser.outgoingRequests || []).filter(id => id !== targetId);
      db.updateUser(currentUserId, {
        incomingRequests: selfIncoming,
        outgoingRequests: selfOutgoing
      });
    }

    if (targetUser) {
      const targetIncoming = (targetUser.incomingRequests || []).filter(id => id !== currentUserId);
      const targetOutgoing = (targetUser.outgoingRequests || []).filter(id => id !== currentUserId);
      db.updateUser(targetId, {
        incomingRequests: targetIncoming,
        outgoingRequests: targetOutgoing
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('contact_request_update', { senderId: targetId, receiverId: currentUserId });
    }

    res.status(200).json({ message: 'Request rejected/canceled' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// REMOVE CONTACT (UNFRIEND)
router.post('/contacts/remove', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const currentUserId = req.user?.userId;
    const { targetId } = req.body;

    if (!currentUserId || !targetId) {
      res.status(400).json({ error: 'Target user ID is required' });
      return;
    }

    const selfUser = db.findUserById(currentUserId);
    const targetUser = db.findUserById(targetId);

    if (selfUser) {
      const selfContacts = (selfUser.contacts || []).filter(id => id !== targetId);
      db.updateUser(currentUserId, { contacts: selfContacts });
    }

    if (targetUser) {
      const targetContacts = (targetUser.contacts || []).filter(id => id !== currentUserId);
      db.updateUser(targetId, { contacts: targetContacts });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('contact_accepted', { senderId: targetId, receiverId: currentUserId });
      io.emit('contact_request_update', { senderId: targetId, receiverId: currentUserId });
    }

    res.status(200).json({ message: 'Contact successfully removed' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// UNBLOCK USER
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
    db.removeBlockedUser(currentUserId, userIdToUnblock);

    // Update isBlocked flag on the chat between these two users
    const userChats = db.getChatsForUser(currentUserId);
    const targetChat = userChats.find(c => !c.isGroup && c.participants.includes(userIdToUnblock));
    if (targetChat) {
      // check if the other user has ALSO blocked current user before setting to false
      const otherUser = db.findUserById(userIdToUnblock);
      const otherHasBlocked = otherUser && (otherUser.blockedUsers || []).includes(currentUserId);
      db.updateChat(targetChat._id, { isBlocked: !!otherHasBlocked });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('chat_list_update', { userId: currentUserId });
    }

    res.status(200).json({ message: 'User unblocked successfully', blockedUsers: blockedList });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// DELETE INDIVIDUAL ACCOUNT (WhatsApp Style Cascading Hard Delete)
router.delete('/delete-account/:userId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.userId;
    const { userId } = req.params;

    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Security check: normal users can only delete their own account.
    if (currentUserId !== userId) {
      res.status(403).json({ error: 'Permission denied. You can only delete your own account.' });
      return;
    }

    // Execute absolute cascading deletion from MongoDB and local layer
    const result = await db.deleteUserCascade(userId);
    if (!result) {
      res.status(404).json({ error: 'User account not found or already deleted' });
      return;
    }

    // Emit live socket deletion trigger to all screens/devices instantly
    const io = req.app.get('io');
    if (io) {
      io.emit('user_deleted', { userId });
      // Clear any call signals
      io.emit('call_ended', { partnerId: userId });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Your account and all related chats, messages, stories, and contact associations have been permanently deleted.' 
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error during account deletion: ' + error.message });
  }
});

// BULK DELETE TEST/DUMMY USERS
router.delete('/delete-test-users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Run the sweep across both in-memory arrays and MongoDB
    const result = await db.bulkDeleteTestUsers();

    // Trigger real-time notifications to clear dummy/test users from and active client lists
    const io = req.app.get('io');
    if (io && result.userIds && result.userIds.length > 0) {
      result.userIds.forEach(uId => {
        io.emit('user_deleted', { userId: uId });
      });
    }

    res.status(200).json({
      success: true,
      message: `Test users sweep completed successfully. Hard deleted ${result.deletedCount} dummy test accounts.`,
      deletedCount: result.deletedCount,
      deletedUserIds: result.userIds
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error during test user sweep: ' + error.message });
  }
});

export default router;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PhoneFrame from './components/PhoneFrame.jsx';
import AuthScreens from './components/AuthScreens.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import ProfileTab from './components/ProfileTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import { apiFetch, getSocketConnection } from './utils/api.js';

import {
  MessageSquare,
  Users,
  Camera,
  User,
  Settings,
  Search,
  Plus,
  Compass,
  CheckCircle2,
  Lock,
  PlusCircle,
  Hash,
  X,
  VolumeX,
  ShieldAlert,
  Phone,
  Video,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VideoOff,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Trash2,
  Pin,
  Archive,
  MoreVertical
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [themeSetting, setThemeSetting] = useState<'light' | 'dark'>('light');

  // Bottom Navigation tabs: 'chats' | 'groups' | 'calls' | 'profile' | 'settings'
  const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'calls' | 'profile' | 'settings'>('chats');

  // Chats states
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
   const [activeChatMenuId, setActiveChatMenuId] = useState<string | null>(null);
   const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
   const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
   const [showArchivedOnly, setShowArchivedOnly] = useState(false);

   const showToast = (text: string, type: 'success' | 'error' = 'success') => {
     setToast({ text, type });
   };

   useEffect(() => {
     if (toast) {
       const timer = setTimeout(() => {
         setToast(null);
       }, 3000);
       return () => clearTimeout(timer);
     }
   }, [toast]);

  // Group Create Popover Box States
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupBuddies, setGroupBuddies] = useState<string[]>([]); // selected User IDs
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);

  // Search/Start New 1-to-1 Chat
  const [showContactsSearch, setShowContactsSearch] = useState(false);
  const [contactCenterTab, setContactCenterTab] = useState<'my_contacts' | 'requests'>('my_contacts');
  const [contactsSearchQuery, setContactsSearchQuery] = useState('');
  const [contactsSearchResult, setContactsSearchResult] = useState<any[]>([]);

  // Calling States
  type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended';
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [callPartner, setCallPartner] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [appSocket, setAppSocket] = useState<any>(null);

  // WebRTC Stream Elements
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteStreamRef = React.useRef<MediaStream | null>(null);
  const peerConnectionRef = React.useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Calling flow tracking & log commitments
  const [callDirection, setCallDirection] = useState<'incoming' | 'outgoing' | null>(null);

  const [callLogs, setCallLogs] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('dotalk_call_logs');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('dotalk_call_logs', JSON.stringify(callLogs));
  }, [callLogs]);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const activeCallRef = React.useRef({
    partner: null as any,
    type: 'audio' as 'audio' | 'video',
    direction: null as 'incoming' | 'outgoing' | null,
    state: 'idle' as CallState,
    duration: 0
  });

  useEffect(() => {
    activeCallRef.current = {
      partner: callPartner,
      type: callType,
      direction: callDirection,
      state: callState,
      duration: callDuration
    };
  }, [callPartner, callType, callDirection, callState, callDuration]);

  const logCall = (partner: any, type: 'audio' | 'video', direction: 'incoming' | 'outgoing' | 'missed', durationSec: number) => {
    if (!partner) return;
    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      partnerId: partner._id,
      partnerName: partner.fullName,
      partnerPhoto: partner.profilePhoto,
      partnerUsername: partner.username,
      type,
      direction,
      timestamp: new Date().toISOString(),
      duration: durationSec > 0 ? durationSec : undefined
    };
    setCallLogs(prev => [newLog, ...prev]);
  };

  // Local persistent state loading
  useEffect(() => {
    const cachedToken = localStorage.getItem('dotalk_token');
    const cachedUser = localStorage.getItem('dotalk_user');
    const cachedTheme = localStorage.getItem('dotalk_theme') as 'light' | 'dark' | null;

    if (cachedToken && cachedUser && cachedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(cachedUser);
        if (parsed) {
          setToken(cachedToken);
          setUser(parsed);
        }
      } catch (err) {
        console.error('Failed to parse cached user JSON:', err);
        localStorage.removeItem('dotalk_token');
        localStorage.removeItem('dotalk_user');
      }
    }
    if (cachedTheme) {
      setThemeSetting(cachedTheme);
    }
  }, []);

  // Sync theme changes with DOM node attributes
  useEffect(() => {
    if (themeSetting === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dotalk_theme', themeSetting);
  }, [themeSetting]);

  // Fetch lists when logged in
  useEffect(() => {
    if (token) {
      fetchChats();
      fetchContacts();
      fetchPendingRequests();
    }
  }, [token, activeTab]);

  // Live Socket calling event synchronization
  useEffect(() => {
    if (token && user) {
      const s = getSocketConnection();
      setAppSocket(s);
      s.emit('register_user', user._id);

      s.on('incoming_call', (data: any) => {
        setCallPartner({
          _id: data.callerId,
          fullName: data.callerName,
          profilePhoto: data.callerPhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.callerUsername}`,
          username: data.callerUsername
        });
        setCallType(data.hasVideo ? 'video' : 'audio');
        setCallDirection('incoming');
        setCallState('incoming');
      });

      s.on('call_answered', () => {
        setCallState('connected');
        setCallDuration(0);
      });

      s.on('call_rejected', () => {
        const current = activeCallRef.current;
        if (current.state === 'outgoing') {
          logCall(current.partner, current.type, 'outgoing', 0);
        } else if (current.state === 'connected') {
          logCall(current.partner, current.type, current.direction || 'outgoing', current.duration);
        }

        setCallState('ended');
        cleanUpWebRTCCall();
        setTimeout(() => {
          setCallState('idle');
          setCallPartner(null);
          setCallDirection(null);
        }, 1500);
      });

      s.on('call_busy_rec', () => {
        const current = activeCallRef.current;
        logCall(current.partner, current.type, 'outgoing', 0);

        alert('Partner is busy on another call');
        setCallState('idle');
        cleanUpWebRTCCall();
        setCallPartner(null);
        setCallDirection(null);
      });

      s.on('call_ended', () => {
        const current = activeCallRef.current;
        if (current.state === 'connected') {
          logCall(current.partner, current.type, current.direction || 'incoming', current.duration);
        } else if (current.state === 'incoming') {
          logCall(current.partner, current.type, 'missed', 0);
        }

        setCallState('ended');
        cleanUpWebRTCCall();
        setTimeout(() => {
          setCallState('idle');
          setCallPartner(null);
          setCallDirection(null);
        }, 1500);
      });

      s.on('chat_list_update', (data: any) => {
        fetchChats();
      });

      s.on('user_deleted', (data: { userId: string }) => {
        if (user && data.userId === user._id) {
          console.log('[Sockets] Our user account was permanently deleted. Logging out...');
          handleLogout();
        } else {
          console.log('[Sockets] A user was deleted. Refreshing contacts and active chats...');
          fetchChats();
          fetchContacts();
          fetchPendingRequests();
        }
      });

      s.on('contact_request_update', (data: any) => {
        if (data.receiverId === user._id || data.senderId === user._id) {
          fetchPendingRequests();
        }
      });

      s.on('contact_accepted', (data: any) => {
        if (data.receiverId === user._id || data.senderId === user._id) {
          fetchContacts();
          fetchPendingRequests();
          fetchChats();
        }
      });

      s.on('webrtc_signal', async (data: { senderId: string; signal: any }) => {
        const pc = peerConnectionRef.current;
        const signal = data.signal;

        if (!pc) {
          console.warn('[WebRTC Client] Peer connection not set up yet');
          return;
        }

        try {
          if (signal.type === 'offer') {
            console.log('[WebRTC Client] Got offer signal');
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            s.emit('webrtc_signal', {
              targetId: data.senderId,
              signal: { type: 'answer', answer }
            });
          } else if (signal.type === 'answer') {
            console.log('[WebRTC Client] Got answer signal');
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
          } else if (signal.type === 'candidate') {
            console.log('[WebRTC Client] Got candidate signal');
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } catch (e) {
          console.error('[WebRTC signaling error]', e);
        }
      });

      return () => {
        s.off('incoming_call');
        s.off('call_answered');
        s.off('call_rejected');
        s.off('call_busy_rec');
        s.off('call_ended');
        s.off('chat_list_update');
        s.off('contact_request_update');
        s.off('contact_accepted');
        s.off('webrtc_signal');
        s.disconnect();
      };
    }
  }, [token, user]);

  // Call continuous duration timer ticking
  useEffect(() => {
    let timer: any = null;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const fetchChats = async () => {
    try {
      const response = await apiFetch('/api/chats');
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        handleLogout();
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setChats(data);
      } else {
        console.error('Failed to load chat history');
      }
    } catch (e) {
      console.error('Failed to load chat history');
    }
  };

  const [pendingRequests, setPendingRequests] = useState<{ incoming: any[], outgoing: any[] }>({ incoming: [], outgoing: [] });

  const fetchContacts = async () => {
    try {
      const response = await apiFetch('/api/users/contacts/all');
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        handleLogout();
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setAvailableContacts(data);
      } else {
        console.error('Failed to load contact lists');
      }
    } catch (e) {
      console.error('Failed to load contact lists');
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await apiFetch('/api/users/contacts/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      }
    } catch (e) {
      console.error('Failed to load pending requests');
    }
  };

  const sendContactRequest = async (usernameStr: string) => {
    try {
      const response = await apiFetch('/api/users/contacts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameStr })
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ text: 'Request sent to @' + usernameStr.trim().replace('@', ''), type: 'success' });
        fetchPendingRequests();
        setContactsSearchQuery('');
        setContactsSearchResult([]);
      } else {
        setToast({ text: data.error || 'Error sending request', type: 'error' });
      }
    } catch (e) {
      setToast({ text: 'Error contacting request API', type: 'error' });
    }
  };

  const acceptContactRequest = async (targetId: string) => {
    try {
      const response = await apiFetch('/api/users/contacts/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId })
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ text: 'Contact request accepted!', type: 'success' });
        fetchContacts();
        fetchPendingRequests();
        fetchChats();
      } else {
        setToast({ text: data.error || 'Failed to accept request', type: 'error' });
      }
    } catch (e) {
      setToast({ text: 'Error accepting request', type: 'error' });
    }
  };

  const rejectContactRequest = async (targetId: string) => {
    try {
      const response = await apiFetch('/api/users/contacts/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId })
      });
      const data = await response.json();
      if (response.ok) {
        setToast({ text: 'Contact request removed', type: 'success' });
        fetchPendingRequests();
      } else {
        setToast({ text: data.error || 'Failed to clear request', type: 'error' });
      }
    } catch (e) {
      setToast({ text: 'Error clearing request', type: 'error' });
    }
  };

  const handleSearchContacts = async (q: string) => {
    setContactsSearchQuery(q);
    if (!q.trim()) {
      setContactsSearchResult([]);
      return;
    }
    try {
      // Find matching user records in database
      const response = await apiFetch(`/api/users/search?query=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (response.ok) {
        setContactsSearchResult(data);
      }
    } catch (e) {
      console.error('Contacts lookup failed');
    }
  };

  const startPrivateChat = async (partnerId: string) => {
    try {
      const response = await apiFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, isGroup: false })
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedChat(data);
        setShowContactsSearch(false);
        setContactsSearchQuery('');
        fetchChats();
      } else {
        setToast({ text: data.error || 'Failed to start chat', type: 'error' });
      }
    } catch (e) {
      console.error('Failed to start personal chat');
      setToast({ text: 'Error initiating private conversation', type: 'error' });
    }
  };

  const handleCreateGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const response = await apiFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isGroup: true,
          groupName,
          groupDescription: groupDesc,
          participants: groupBuddies
        })
      });
      if (response.ok) {
        setGroupName('');
        setGroupDesc('');
        setGroupBuddies([]);
        setShowCreateGroup(false);
        fetchChats();
      }
    } catch (e) {
      console.error('Group creation failure');
    }
  };

  const toggleBuddySelection = (buddyId: string) => {
    setGroupBuddies(prev =>
      prev.includes(buddyId) ? prev.filter(id => id !== buddyId) : [...prev, buddyId]
    );
  };

  const handleLoginSuccess = (accessToken: string, loggedInUser: any) => {
    setToken(accessToken);
    setUser(loggedInUser);
    localStorage.setItem('dotalk_token', accessToken);
    localStorage.setItem('dotalk_user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    localStorage.removeItem('dotalk_token');
    localStorage.removeItem('dotalk_user');
    setToken(null);
    setUser(null);
    setSelectedChat(null);
    setActiveTab('chats');
  };

  // WebRTC Stream Allocation & Cleanup Control
  const cleanUpWebRTCCall = () => {
    console.log('[WebRTC] Stopping streams and closing socket RTCPeerConnection...');
    
    // Stop local ref tracks (camera & microphone)
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[WebRTC] Stopped local track:', track.kind, track.label);
        });
      } catch (err) {
        console.error('[WebRTC] Error stopping local ref tracks:', err);
      }
      localStreamRef.current = null;
    }

    // Stop local state tracks as secondary backup
    if (localStream) {
      try {
        localStream.getTracks().forEach(track => {
          track.stop();
        });
      } catch (err) {
        console.error('[WebRTC] Error stopping local state tracks:', err);
      }
    }

    // Stop remote ref tracks
    if (remoteStreamRef.current) {
      try {
        remoteStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('[WebRTC] Stopped remote track:', track.kind, track.label);
        });
      } catch (err) {
        console.error('[WebRTC] Error stopping remote ref tracks:', err);
      }
      remoteStreamRef.current = null;
    }

    // Stop remote state tracks
    if (remoteStream) {
      try {
        remoteStream.getTracks().forEach(track => {
          track.stop();
        });
      } catch (err) {
        console.error('[WebRTC] Error stopping remote state tracks:', err);
      }
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
        console.log('[WebRTC] Closed PeerConnection successfully.');
      } catch (e) {
        console.error('[WebRTC] Error closing PeerConnection:', e);
      }
      peerConnectionRef.current = null;
    }

    // Reset streams
    setLocalStream(null);
    setRemoteStream(null);

    // Reset indicator parameters
    setIsMuted(false);
    setIsVideoMuted(false);
    setIsSpeakerOn(false);
  };

  const setupPeerConnection = async (partnerId: string, hasVideo: boolean, isOfferCreator: boolean) => {
    try {
      if (peerConnectionRef.current) {
        cleanUpWebRTCCall();
      }

      console.log(`[WebRTC] Setting up tracks. Creator: ${isOfferCreator}. Video: ${hasVideo}`);
      
      const constraints = {
        audio: true,
        video: hasVideo ? { facingMode: 'user' } : false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && appSocket) {
          appSocket.emit('webrtc_signal', {
            targetId: partnerId,
            signal: { type: 'candidate', candidate: event.candidate }
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC] set remote view stream track', event.streams[0]);
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        }
      };

      if (isOfferCreator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        appSocket.emit('webrtc_signal', {
          targetId: partnerId,
          signal: { type: 'offer', offer }
        });
      }
    } catch (err) {
      console.error('[WebRTC] Access configuration exception: ', err);
      setToast({ text: 'Camera/Mic allocation blocked or failed. Please check device permissions', type: 'error' });
    }
  };

  // Calling flow controllers
  const handleInitiateCall = (type: 'audio' | 'video') => {
    if (!selectedChat || !selectedChat.partner) return;
    const partnerObj = selectedChat.partner;
    
    setCallPartner({
      _id: partnerObj._id,
      fullName: partnerObj.fullName || selectedChat.title,
      profilePhoto: partnerObj.profilePhoto || selectedChat.image,
      username: partnerObj.username
    });
    setCallType(type);
    setCallDirection('outgoing');
    setCallState('outgoing');

    if (appSocket) {
      appSocket.emit('initiate_call', {
        receiverId: partnerObj._id,
        callerId: user._id,
        callerName: user.fullName,
        callerPhoto: user.profilePhoto,
        callerUsername: user.username,
        hasVideo: type === 'video'
      });
    }

    // Allocate resources & generate offers
    setupPeerConnection(partnerObj._id, type === 'video', true);
  };

  const handleAnswerCall = () => {
    if (appSocket && callPartner) {
      appSocket.emit('answer_call', { callerId: callPartner._id });
      setCallState('connected');
      
      // Allocate local device tracks & prepare recipient's connection (non-creator of WebRTC signaling)
      setupPeerConnection(callPartner._id, callType === 'video', false);
    }
  };

  const handleRejectCall = () => {
    if (appSocket && callPartner) {
      appSocket.emit('reject_call', { callerId: callPartner._id });
      
      const current = activeCallRef.current;
      if (current.state === 'incoming') {
        logCall(current.partner, current.type, 'missed', 0);
      } else if (current.state === 'outgoing') {
        logCall(current.partner, current.type, 'outgoing', 0);
      } else if (current.state === 'connected') {
        logCall(current.partner, current.type, current.direction || 'incoming', current.duration);
      }

      setCallState('ended');
      cleanUpWebRTCCall();
      setTimeout(() => {
        setCallState('idle');
        setCallPartner(null);
        setCallDirection(null);
      }, 1200);
    }
  };

  const handleEndCall = () => {
    if (appSocket && callPartner) {
      appSocket.emit('end_call', { partnerId: callPartner._id });
      
      const current = activeCallRef.current;
      if (current.state === 'connected') {
        logCall(current.partner, current.type, current.direction || 'outgoing', current.duration);
      } else if (current.state === 'outgoing') {
        logCall(current.partner, current.type, 'outgoing', 0);
      }

      setCallState('ended');
      cleanUpWebRTCCall();
      setTimeout(() => {
        setCallState('idle');
        setCallPartner(null);
        setCallDirection(null);
      }, 1200);
    }
  };

  const formatTimer = (seconds: number) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const [callsSearchQuery, setCallsSearchQuery] = useState('');

  const handleCallBack = (log: any, type: 'audio' | 'video') => {
    if (!log.partnerId) {
      alert('Cannot perform callback: No partner ID stored.');
      return;
    }
    setCallPartner({
      _id: log.partnerId,
      fullName: log.partnerName,
      profilePhoto: log.partnerPhoto,
      username: log.partnerUsername
    });
    setCallType(type);
    setCallDirection('outgoing');
    setCallState('outgoing');

    if (appSocket && user) {
      appSocket.emit('initiate_call', {
        receiverId: log.partnerId,
        callerId: user._id,
        callerName: user.fullName,
        callerPhoto: user.profilePhoto,
        callerUsername: user.username,
        hasVideo: type === 'video'
      });
    }
  };

  const handleDeleteCallLog = (logId: string) => {
    setCallLogs(prev => prev.filter(item => item.id !== logId));
  };

  const handlePinChat = async (chatId: string) => {
    setActionLoadingId(chatId);
    try {
      const chat = chats.find(c => c._id === chatId);
      const isCurrentlyPinned = chat ? !!chat.isPinned : false;
      const res = await apiFetch(`/api/chats/${chatId}/pin`, { method: 'POST' });
      if (res.ok) {
        await fetchChats();
        setActiveChatMenuId(null);
        showToast(isCurrentlyPinned ? 'Conversation unpinned' : 'Conversation pinned', 'success');
      } else {
        showToast('Failed to update pin status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error, please retry', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const archiveChat = async (chatId: string) => {
    setActionLoadingId(chatId);
    // Optimistic UI update: instantly set isArchived state
    setChats(prev => prev.map(c => c._id === chatId ? { ...c, isArchived: true } : c));
    setActiveChatMenuId(null);
    try {
      const res = await apiFetch(`/api/chats/${chatId}/archive`, { method: 'POST' });
      if (res.ok) {
        await fetchChats();
        showToast('Conversation archived', 'success');
      } else {
        // Rollback on failure
        setChats(prev => prev.map(c => c._id === chatId ? { ...c, isArchived: false } : c));
        showToast('Failed to archive conversation', 'error');
      }
    } catch (err) {
      console.error(err);
      // Rollback on failure
      setChats(prev => prev.map(c => c._id === chatId ? { ...c, isArchived: false } : c));
      showToast('Network error, please retry', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const unarchiveChat = async (chatId: string) => {
    setActionLoadingId(chatId);
    // Optimistic UI update: instantly clear isArchived state to return to main list
    setChats(prev => prev.map(c => c._id === chatId ? { ...c, isArchived: false } : c));
    setActiveChatMenuId(null);
    try {
      const res = await apiFetch(`/api/chats/${chatId}/unarchive`, { method: 'POST' });
      if (res.ok) {
        await fetchChats();
        showToast('Conversation unarchived', 'success');
      } else {
        // Rollback on failure
        setChats(prev => prev.map(c => c._id === chatId ? { ...c, isArchived: true } : c));
        showToast('Failed to unarchive conversation', 'error');
      }
    } catch (err) {
      console.error(err);
      // Rollback on failure
      setChats(prev => prev.map(c => c._id === chatId ? { ...c, isArchived: true } : c));
      showToast('Network error, please retry', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleUnread = async (chatId: string) => {
    setActionLoadingId(chatId);
    try {
      const chat = chats.find(c => c._id === chatId);
      const isUnread = chat ? (chat.unreadCount > 0 || !!chat.isMarkedUnread) : false;
      const url = isUnread ? `/api/chats/${chatId}/read` : `/api/chats/${chatId}/unread`;
      
      const res = await apiFetch(url, { method: 'POST' });
      if (res.ok) {
        await fetchChats();
        setActiveChatMenuId(null);
        showToast(isUnread ? 'Conversation marked as read' : 'Conversation marked as unread', 'success');
      } else {
        showToast('Failed to update unread status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error, please retry', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

// Mute feature removed

  const handleClearChat = async (chatId: string) => {
    setConfirmModal({
      title: 'Clear Chat Logs',
      message: 'Are you sure you want to clear all messages for this chat? This keeps the contact in list but deletes chat history.',
      confirmText: 'Clear Logs',
      cancelText: 'Cancel',
      danger: true,
      onConfirm: async () => {
        setActionLoadingId(chatId);
        try {
          const res = await apiFetch(`/api/chats/${chatId}/clear`, { method: 'POST' });
          if (res.ok) {
            await fetchChats();
            if (selectedChat && selectedChat._id === chatId) {
              setSelectedChat(null);
            }
            setActiveChatMenuId(null);
            showToast('Chat history cleared', 'success');
          } else {
            showToast('Failed to clear chat list', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Network error, please retry', 'error');
        } finally {
          setActionLoadingId(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleDeleteChat = async (chatId: string, isGroup: boolean) => {
    setConfirmModal({
      title: 'Delete Conversation',
      message: `Are you sure you want to delete this ${isGroup ? 'group' : 'chat'} conversation? This will permanently erase the session and all its message logs instantly.`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      danger: true,
      onConfirm: async () => {
        setActionLoadingId(chatId);
        try {
          const res = await apiFetch(`/api/chats/${chatId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (res.ok) {
            await fetchChats();
            if (selectedChat && selectedChat._id === chatId) {
              setSelectedChat(null);
            }
            setActiveChatMenuId(null);
            showToast('Conversation deleted permanently', 'success');
          } else {
            showToast('Failed to delete conversation', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Network error, please retry', 'error');
        } finally {
          setActionLoadingId(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleToggleCloseChat = async (chatId: string, currentlyClosed: boolean) => {
    const url = currentlyClosed ? `/api/chats/${chatId}/reopen` : `/api/chats/${chatId}/close`;
    const actionName = currentlyClosed ? 'reopen' : 'close';
    setConfirmModal({
      title: currentlyClosed ? 'Reopen Conversation' : 'Close Session',
      message: `Are you sure you want to ${actionName} this conversation?`,
      confirmText: currentlyClosed ? 'Reopen' : 'Close Session',
      cancelText: 'Cancel',
      danger: !currentlyClosed,
      onConfirm: async () => {
        setActionLoadingId(chatId);
        try {
          const res = await apiFetch(url, { method: 'POST' });
          if (res.ok) {
            await fetchChats();
            setActiveChatMenuId(null);
            showToast(`Conversation successfully ${currentlyClosed ? 'reopened' : 'closed'}!`, 'success');
          } else {
            showToast(`Failed to ${actionName} conversation`, 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Network error, please retry', 'error');
        } finally {
          setActionLoadingId(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleToggleBlockContact = async (partnerId: string, currentlyBlocked: boolean) => {
    const url = currentlyBlocked ? '/api/users/unblock' : '/api/users/block';
    setConfirmModal({
      title: currentlyBlocked ? 'Unblock Contact' : 'Block Contact',
      message: currentlyBlocked 
        ? 'Are you sure you want to unblock this contact and resume receiving their messages?' 
        : 'Are you sure you want to block this user contact? They will not be able to message or call you anymore.',
      confirmText: currentlyBlocked ? 'Unblock Contact' : 'Block Contact',
      cancelText: 'Cancel',
      danger: !currentlyBlocked,
      onConfirm: async () => {
        const partnerChat = chats.find(c => !c.isGroup && c.partner && c.partner._id === partnerId);
        const targetLoadId = partnerChat ? partnerChat._id : partnerId;
        setActionLoadingId(targetLoadId);
        try {
          const res = await apiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentlyBlocked ? { userIdToUnblock: partnerId } : { userIdToBlock: partnerId })
          });
          if (res.ok) {
            await fetchChats();
            await fetchContacts();
            const freshUser = { ...user };
            if (currentlyBlocked) {
              freshUser.blockedUsers = (freshUser.blockedUsers || []).filter((id: string) => id !== partnerId);
            } else {
              freshUser.blockedUsers = [...(freshUser.blockedUsers || []), partnerId];
            }
            setUser(freshUser);
            localStorage.setItem('dotalk_user', JSON.stringify(freshUser));
            setActiveChatMenuId(null);
            showToast(currentlyBlocked ? 'Contact unblocked successfully' : 'Contact blocked', 'success');
          } else {
            showToast('Failed to update blocked status', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Network error, please retry', 'error');
        } finally {
          setActionLoadingId(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleClearAllCallLogs = () => {
    if (window.confirm('Are you sure you want to clear your entire call history?')) {
      setCallLogs([]);
    }
  };

  const filteredChats = chats.filter(c => {
    if (activeTab === 'groups' && !c.isGroup) return false;
    if (activeTab === 'chats' && c.isGroup) return false;

    if (showArchivedOnly) {
      if (!c.isArchived) return false;
    } else {
      if (c.isArchived) return false;
    }

    return c.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    const pinA = a.isPinned ? 1 : 0;
    const pinB = b.isPinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
  });

  const archivedCount = chats.filter(c => c.isArchived && ((activeTab === 'groups' && c.isGroup) || (activeTab === 'chats' && !c.isGroup))).length;
  const archivedUnreadChatsCount = chats.filter(c => c.isArchived && (c.unreadCount > 0 || !!c.isMarkedUnread) && ((activeTab === 'groups' && c.isGroup) || (activeTab === 'chats' && !c.isGroup))).length;

  const totalUnreads = chats.reduce((acc, obj) => acc + (obj.unreadCount || 0), 0);

  // Handle auto-back when archived folder is empty
  useEffect(() => {
    if (showArchivedOnly && archivedCount === 0) {
      setShowArchivedOnly(false);
    }
  }, [showArchivedOnly, archivedCount]);

  return (
    <PhoneFrame theme={themeSetting}>
      {!token || !user ? (
        <AuthScreens onLoginSuccess={handleLoginSuccess} theme={themeSetting} />
      ) : selectedChat ? (
        <ChatWindow
          chat={selectedChat}
          currentUser={user}
          onBack={() => { setSelectedChat(null); fetchChats(); }}
          theme={themeSetting}
          onInitiateCall={handleInitiateCall}
        />
      ) : (
        <div className="w-full h-full flex flex-col justify-between relative select-none bg-app-bg text-app-text-primary">
          
          {/* A. HOME COMPONENT TOP FRAME BAR */}
          <div className={`px-5 pt-4 pb-2.5 flex items-center justify-between border-b ${
            themeSetting === 'dark' ? 'bg-[#3B2E2B] border-[#5A4A45] text-[#FEEBC5]' : 'bg-[#FEEBC5] border-[#E8D6B3] text-[#3B2E2B]'
          }`}>
            <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold tracking-tight">DoTalk</h1>
              <span className="text-[10px] opacity-75 font-semibold tracking-wider uppercase">Active user: {user?.fullName}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowContactsSearch(!showContactsSearch)}
                className="p-1.5 hover:bg-black/5 rounded-full cursor-pointer"
                title="Start a Chat"
              >
                <Search className="w-5 h-5 opacity-80" />
              </button>

              <img
                src={user?.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
                onClick={() => setActiveTab('profile')}
                className="w-8 h-8 rounded-full border-2 border-zinc-300 dark:border-zinc-700 object-cover cursor-pointer"
                title="My Profile"
              />
            </div>
          </div>

          {/* FRONTEND CONTACTS CENTER PANEL OVERLAY */}
          {showContactsSearch && (
            <div className="absolute top-14 inset-x-0 bottom-16 bg-app-card border-b border-app-border z-40 p-4 flex flex-col text-app-text-primary">
              <div className="flex justify-between items-center border-b pb-2 border-app-border">
                <span className="font-extrabold text-sm tracking-tight">DoTalk Contact Center</span>
                <button 
                  onClick={() => { 
                    setShowContactsSearch(false); 
                    setContactsSearchQuery(''); 
                    setContactsSearchResult([]);
                  }} 
                  className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-full cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4"/>
                </button>
              </div>

              {/* Sub tabs: 'my_contacts' | 'requests' */}
              <div className="flex gap-2 border-b border-app-border py-2 mb-3">
                <button
                  onClick={() => { setContactCenterTab('my_contacts'); }}
                  className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all ${
                    contactCenterTab === 'my_contacts' 
                      ? 'bg-[#b3ada9] text-[#3B2E2B]' 
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-app-text-secondary'
                  }`}
                >
                  Contacts ({availableContacts.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setContactCenterTab('requests'); }}
                  className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    contactCenterTab === 'requests' 
                      ? 'bg-[#b3ada9] text-[#3B2E2B]' 
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-app-text-secondary'
                  }`}
                >
                  Add & Requests
                  {(pendingRequests.incoming || []).length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black animate-pulse">
                      {(pendingRequests.incoming || []).length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: MY CONTACTS LIST */}
              {contactCenterTab === 'my_contacts' && (
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"/>
                    <input
                      type="text"
                      value={contactsSearchQuery}
                      onChange={e => handleSearchContacts(e.target.value)}
                      placeholder="Search active contacts by name..."
                      className="w-full h-9 pl-9 pr-4 rounded-xl border border-stone-200 dark:border-zinc-800 text-xs bg-stone-50 dark:bg-stone-900 placeholder-slate-400 outline-none text-app-text-primary"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5 scrollbar-none">
                    {availableContacts.filter(c => 
                      c.fullName.toLowerCase().includes(contactsSearchQuery.toLowerCase()) || 
                      c.username.toLowerCase().includes(contactsSearchQuery.toLowerCase())
                    ).length === 0 ? (
                      <div className="py-8 text-center text-xs opacity-65 flex flex-col items-center justify-center gap-1">
                        <span className="font-bold">No contacts found</span>
                        <p className="text-[10px] text-app-text-secondary max-w-[220px] leading-relaxed">Go to 'Add & Requests' tab and search usernames like @fiza or @sara to send contact requests.</p>
                      </div>
                    ) : (
                      availableContacts
                        .filter(c => 
                          c.fullName.toLowerCase().includes(contactsSearchQuery.toLowerCase()) || 
                          c.username.toLowerCase().includes(contactsSearchQuery.toLowerCase())
                        )
                        .map((contact) => (
                          <div
                            key={contact._id}
                            onClick={() => {
                              startPrivateChat(contact._id);
                              setShowContactsSearch(false);
                            }}
                            className="p-2 sm:p-2.5 rounded-xl flex items-center gap-3 bg-stone-50 dark:bg-stone-900/40 hover:bg-stone-105 border border-app-border transition-all cursor-pointer group"
                          >
                            <img src={contact.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${contact.username}`} alt={contact.fullName} className="w-8 h-8 rounded-full object-cover border border-app-border shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-extrabold text-app-text-primary group-hover:text-app-btn-bg transition-colors block truncate">{contact.fullName}</span>
                              <span className="text-[10px] text-app-text-secondary block truncate">@{contact.username} • {contact.bio || 'Available'}</span>
                            </div>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${contact.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-transparent'}`} />
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ADD BY USERNAME & PENDING REQUESTS */}
              {contactCenterTab === 'requests' && (
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-0.5 scrollbar-none">
                  
                  {/* Search username box */}
                  <div className="bg-stone-50 dark:bg-stone-900/40 p-2.5 rounded-2xl border border-app-border flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase text-app-text-secondary tracking-wider">Search New User</span>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-55"/>
                        <input
                          type="text"
                          value={contactsSearchQuery}
                          onChange={e => handleSearchContacts(e.target.value)}
                          placeholder="Type precise username (e.g. sara)..."
                          className="w-full h-8 pl-8 pr-3 rounded-lg border border-stone-200 dark:border-zinc-800 text-xs bg-white dark:bg-[#121212] placeholder-slate-400 outline-none text-app-text-primary"
                        />
                      </div>
                    </div>

                    {/* Rendering matching searched user cards */}
                    {contactsSearchQuery && (
                      <div className="flex flex-col gap-2 mt-1">
                        {contactsSearchResult.length === 0 ? (
                          <span className="text-[11px] italic text-center text-app-text-secondary py-1.5">Lookup in progress...</span>
                        ) : (
                          contactsSearchResult.map((matchedUser) => (
                            <div
                              key={matchedUser._id}
                              className="p-2 rounded-xl border border-app-border bg-white dark:bg-stone-900 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img 
                                  src={matchedUser.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${matchedUser.username}`} 
                                  className="w-7 h-7 rounded-full object-cover border border-app-border shrink-0" 
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-app-text-primary block truncate">{matchedUser.fullName}</span>
                                  <span className="text-[10px] text-app-text-secondary block">@{matchedUser.username}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => sendContactRequest(matchedUser.username)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow-xs shrink-0 cursor-pointer"
                              >
                                Add Contact
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* INCOMING REQUESTS BLOCK */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase text-app-text-secondary tracking-wider">Incoming Requests ({(pendingRequests.incoming || []).length})</span>
                    {(pendingRequests.incoming || []).length === 0 ? (
                      <span className="text-[10px] opacity-50 py-1 italic">No pending invitations</span>
                    ) : (
                      pendingRequests.incoming.map((reqUser: any) => (
                        <div
                          key={reqUser._id}
                          className="p-2 bg-stone-50 dark:bg-stone-900/30 border border-app-border rounded-xl flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img 
                              src={reqUser.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reqUser.username}`} 
                              className="w-7 h-7 rounded-full border shrink-0 border-app-border" 
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-extrabold text-app-text-primary block truncate">{reqUser.fullName}</span>
                              <span className="text-[9px] text-app-text-secondary block">@{reqUser.username}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => rejectContactRequest(reqUser._id)}
                              className="p-1 px-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-red-500 dark:hover:bg-red-600 hover:text-white text-app-text-primary rounded-lg text-[9px] font-black transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => acceptContactRequest(reqUser._id)}
                              className="p-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-black shadow-xs transition-colors cursor-pointer"
                            >
                              Accept
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* OUTGOING PENDING SENT REQUESTS */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase text-app-text-secondary tracking-wider">Sent Pending ({(pendingRequests.outgoing || []).length})</span>
                    {(pendingRequests.outgoing || []).length === 0 ? (
                      <span className="text-[10px] opacity-50 py-1 italic">No sent requests pending</span>
                    ) : (
                      pendingRequests.outgoing.map((reqUser: any) => (
                        <div
                          key={reqUser._id}
                          className="p-2 bg-stone-50 dark:bg-stone-900/30 border border-app-border rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <img 
                              src={reqUser.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${reqUser.username}`} 
                              className="w-6 h-6 rounded-full border shrink-0 border-app-border" 
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-app-text-primary block truncate">{reqUser.fullName}</span>
                              <span className="text-[9px] text-app-text-secondary">@{reqUser.username}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => rejectContactRequest(reqUser._id)}
                            className="p-1 px-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-red-500 hover:text-white rounded-lg text-[9px] font-semibold text-app-text-secondary shrink-0 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

          {/* B. ACTIVE BODY TAB CONTAINER VIEWPORT - NO STATUS STORIES */}
          <div className="flex-1 overflow-hidden relative">

            {/* CHATS & GROUPS TAB LIST */}
            {(activeTab === 'chats' || activeTab === 'groups') && (
              <div className="w-full h-full flex flex-col p-4 gap-4">
                
                {/* Search index filter */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeTab === 'chats' ? 'direct messages' : 'group rooms'}...`}
                    className="w-full h-10 pl-10 pr-4 bg-app-input-bg placeholder-slate-400 rounded-xl outline-none text-sm border border-app-border text-app-input-text"
                  />
                </div>

                {/* Main list view */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 scrollbar-thin">
                  {/* ARCHIVE LINK HEADER ROW */}
                  {!showArchivedOnly && archivedCount > 0 && (
                    <button
                      onClick={() => setShowArchivedOnly(true)}
                      className="mx-0.5 px-4 py-3 bg-stone-100 hover:bg-stone-200 dark:bg-[#1E1E1E]/50 dark:hover:bg-[#1E1E1E] rounded-2xl flex items-center justify-between border border-dashed border-stone-300 dark:border-zinc-800 cursor-pointer transition-all animate-fade-in shrink-0"
                    >
                      <div className="flex items-center gap-3">
                        <Archive className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold tracking-tight">Archived Chats</span>
                        {archivedUnreadChatsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-extrabold text-[9px] shrink-0 animate-bounce">
                            {archivedUnreadChatsCount} UNREAD
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-stone-200 dark:bg-zinc-800 font-extrabold text-[10px] text-stone-600 dark:text-stone-300">
                        {archivedCount}
                      </span>
                    </button>
                  )}

                  {/* SHOWING ARCHIVED BAR HEADER ROW */}
                  {showArchivedOnly && (
                    <div className="mx-0.5 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold font-mono uppercase tracking-wide">Archived Folder</span>
                      </div>
                      <button
                        onClick={() => setShowArchivedOnly(false)}
                        className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-500 text-white hover:bg-amber-600 shrink-0 cursor-pointer"
                      >
                        ← Back
                      </button>
                    </div>
                  )}

                  {sortedChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center my-16 text-center opacity-60 gap-2">
                      <Compass className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
                      <p className="text-xs font-bold text-app-text-primary">No active {activeTab === 'chats' ? 'conversations' : 'groups'}</p>
                      <button onClick={() => setShowContactsSearch(true)} className="text-xs font-bold underline hover:opacity-85 text-amber-500 dark:text-amber-400">Find your first buddy</button>
                    </div>
                  ) : (
                    sortedChats.map((c) => {
                      const isUnreadMarked = !!c.isMarkedUnread;
                      const isContactBlocked = !c.isGroup && c.partner && user?.blockedUsers?.includes(c.partner._id);

                      return (
                        <div
                          key={c._id}
                          onClick={() => {
                            setSelectedChat(c);
                            setActiveChatMenuId(null);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setActiveChatMenuId(activeChatMenuId === c._id ? null : c._id);
                          }}
                          className="p-3 relative rounded-2xl flex items-center gap-3.5 border border-app-border shadow-xs cursor-pointer bg-app-card hover:opacity-90 transition-all duration-200 select-none"
                        >
                          {/* Image and online state indicator */}
                          <div className="relative whitespace-nowrap">
                            <img src={c.image} alt={c.title} className={`w-11 h-11 rounded-full object-cover border border-app-border ${isContactBlocked ? 'grayscale opacity-75' : ''}`} />
                            {!c.isGroup && c.partner?.onlineStatus === 'online' && !isContactBlocked && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4CAF50] rounded-full border-2 border-white" />
                            )}
                          </div>

                          {/* Info Column */}
                          <div className="flex-grow flex flex-col gap-0.5 overflow-hidden text-left">
                            <div className="flex justify-between items-center gap-1.5">
                              {/* Title and Pin/Mute indicators */}
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                {c.isPinned && (
                                  <Pin className="w-3 h-3 text-amber-500 rotate-45 shrink-0" />
                                )}
                                <span className={`text-xs font-bold truncate tracking-tight break-all ${isContactBlocked ? 'text-red-505 font-bold' : 'text-app-text-primary'}`}>
                                  {c.title}
                                </span>
                                {c.isClosed && (
                                  <span className="text-[8px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full font-extrabold font-mono tracking-wide uppercase shrink-0">Closed</span>
                                )}
                                {isContactBlocked && (
                                  <span className="text-[8px] bg-red-500/10 text-red-550 px-1.5 py-0.5 rounded-full font-extrabold font-mono tracking-wide uppercase shrink-0">Blocked</span>
                                )}
                              </div>

                              {/* Timestamp */}
                              <span className="text-[9px] opacity-70 shrink-0 font-medium whitespace-nowrap">
                                {new Date(c.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Last message text or typing */}
                            <div className="flex justify-between items-center pr-1 min-w-0">
                              <p className="text-[11px] opacity-80 truncate pr-5 text-app-text-secondary min-w-0 flex-grow">
                                {c.lastMessageText || <span className="opacity-40 italic">No messages yet</span>}
                              </p>

                              <div className="flex items-center gap-2 shrink-0 animate-fade-in">
                                {c.unreadCount > 0 && !isUnreadMarked && (
                                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-app-btn-bg text-app-btn-text flex items-center justify-center text-[9px] font-extrabold shadow">
                                    {c.unreadCount}
                                  </span>
                                )}

                                {isUnreadMarked && (
                                  <span className="w-2.5 h-2.5 rounded-full bg-[#4CAF50] animate-pulse inline-block animate-fade-in shrink-0" title="Marked as unread" />
                                )}

                                {/* Menu trigger */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveChatMenuId(activeChatMenuId === c._id ? null : c._id);
                                  }}
                                  className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition-all outline-none"
                                >
                                  <MoreVertical className="w-4 h-4 shrink-0" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Popover action lists */}
                          {activeChatMenuId === c._id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-4 top-13 min-w-[210px] bg-white dark:bg-[#1E1E1E] border border-stone-200 dark:border-zinc-800 shadow-xl rounded-2xl p-2 z-50 animate-fade-in text-left text-xs font-semibold text-stone-800 dark:text-amber-100 flex flex-col gap-0.5 relative"
                            >
                              {actionLoadingId === c._id && (
                                <div className="absolute inset-0 bg-white/70 dark:bg-black/70 rounded-2xl flex items-center justify-center z-50">
                                  <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                                </div>
                              )}
                              <button
                                onClick={() => handlePinChat(c._id)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer"
                              >
                                <Pin className="w-3.5 h-3.5 shrink-0" />
                                <span>{c.isPinned ? 'Unpin Chat' : 'Pin to Top'}</span>
                              </button>

                              <button
                                onClick={() => c.isArchived ? unarchiveChat(c._id) : archiveChat(c._id)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5 shrink-0" />
                                <span>{c.isArchived ? 'Unarchive Chat' : 'Archive Chat'}</span>
                              </button>

                              <button
                                onClick={() => handleToggleUnread(c._id)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                <span>{(c.unreadCount > 0 || c.isMarkedUnread) ? 'Mark as Read' : 'Mark as Unread'}</span>
                              </button>

                              <button
                                onClick={() => handleClearChat(c._id)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-red-500/5 text-red-500 rounded-xl cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span>Clear Chat Logs</span>
                              </button>

                              <button
                                onClick={() => handleDeleteChat(c._id, c.isGroup)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-red-500/5 text-red-650 rounded-xl font-extrabold cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Delete Conversation</span>
                              </button>

                              <button
                                onClick={() => handleToggleCloseChat(c._id, !!c.isClosed)}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-amber-500"
                              >
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>{c.isClosed ? 'Reopen Conversation' : 'Close Session'}</span>
                              </button>

                              {!c.isGroup && c.partner && (
                                <button
                                  onClick={() => handleToggleBlockContact(c.partner._id, isContactBlocked)}
                                  className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl cursor-pointer text-orange-600 font-extrabold animate-fade-in"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                                  <span>{isContactBlocked ? 'Unblock Buddy' : 'Block Contact'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* FAB (Floating Action Button) for creating groups/private chats */}
                <button
                  onClick={() => activeTab === 'groups' ? setShowCreateGroup(true) : setShowContactsSearch(true)}
                  className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-app-btn-bg text-app-btn-text flex items-center justify-center shadow-lg hover:scale-105 cursor-pointer z-20 transition-transform duration-100 outline-none"
                >
                  <Plus className="w-6 h-6 animate-fade" />
                </button>
              </div>
            )}

            {/* CREATE GROUP DIALOG DISPLAY */}
            {showCreateGroup && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className={`p-6 rounded-3xl w-full max-w-sm shadow-xl flex flex-col gap-4 max-h-[90%] overflow-y-auto relative bg-white dark:bg-[#1E1E1E] border border-stone-200 dark:border-zinc-800 ${
                  themeSetting === 'dark' ? 'text-white' : 'text-[#1A1A1A]'
                }`}>
                  <div className="flex justify-between items-center border-b pb-1.5 border-app-border">
                    <span className="font-extrabold text-sm text-app-text-primary">Create New Group</span>
                    <button onClick={() => setShowCreateGroup(false)} className="p-1 hover:bg-black/5 rounded-full cursor-pointer"><X className="w-5 h-5 text-app-text-primary"/></button>
                  </div>

                  <form onSubmit={handleCreateGroupChat} className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Group Name (e.g. Design Studio)"
                      value={groupName}
                      maxLength={40}
                      required
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full h-10 px-3 bg-stone-50 dark:bg-zinc-800/20 border border-stone-200 dark:border-zinc-800 rounded-lg text-sm outline-none text-app-text-primary"
                    />
                    <input
                      type="text"
                      placeholder="Description (e.g. Collaborators only)"
                      value={groupDesc}
                      maxLength={120}
                      onChange={e => setGroupDesc(e.target.value)}
                      className="w-full h-10 px-3 bg-stone-50 dark:bg-zinc-800/20 border border-stone-200 dark:border-zinc-800 rounded-lg text-sm outline-none text-app-text-primary"
                    />

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Select Members</span>
                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                        {availableContacts.map(c => (
                          <div
                            key={c._id}
                            onClick={() => toggleBuddySelection(c._id)}
                            className={`p-2 rounded-xl flex items-center gap-2.5 cursor-pointer border transition-colors ${
                              groupBuddies.includes(c._id) ? 'bg-app-btn-bg/10 border-app-btn-bg text-app-text-primary' : 'bg-transparent border-transparent text-app-text-primary'
                            }`}
                          >
                            <img src={c.profilePhoto} alt={c.fullName} className="w-8 h-8 rounded-full object-cover border border-app-border" />
                            <span className="text-xs font-bold flex-1 text-app-text-primary">{c.fullName}</span>
                            <input
                              type="checkbox"
                              checked={groupBuddies.includes(c._id)}
                              onChange={() => {}} // Controlled by row toggler
                              className="accent-app-btn-bg"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-10 mt-2 bg-app-btn-bg hover:opacity-90 text-app-btn-text rounded-xl font-bold text-xs shadow focus:outline-none transition-colors cursor-pointer"
                    >
                      Construct Group Room
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* CALLS TAB */}
            {activeTab === 'calls' && (
              <div className="w-full h-full flex flex-col p-4 gap-4 overflow-hidden relative">
                
                {/* Search & Action bar */}
                <div className="flex gap-2.5 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-60" />
                    <input
                      type="text"
                      value={callsSearchQuery}
                      onChange={e => setCallsSearchQuery(e.target.value)}
                      placeholder="Search recent callers..."
                    className="w-full h-10 pl-10 pr-4 bg-app-input-bg placeholder-slate-400 rounded-xl outline-none text-sm border border-app-border text-app-input-text"
                    />
                  </div>

                  {callLogs.length > 0 && (
                    <button
                      onClick={handleClearAllCallLogs}
                      className="h-10 px-3 flex items-center justify-center bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-600 dark:text-red-450 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Clear History"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear all
                    </button>
                  )}
                </div>

                {/* Call logs list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 scrollbar-thin">
                  {callLogs.filter(log => log.partnerName.toLowerCase().includes(callsSearchQuery.toLowerCase())).length === 0 ? (
                    <div className="flex flex-col items-center justify-center my-16 text-center opacity-65 gap-3">
                      <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Phone className="w-7 h-7" />
                      </div>
                      <div className="max-w-[200px]">
                        <p className="text-xs font-bold font-sans">No Call History</p>
                        <p className="text-[10px] mt-1 text-app-text-secondary">Start video or audio calls with your buddies from the chat window.</p>
                      </div>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {callLogs
                        .filter(log => log.partnerName.toLowerCase().includes(callsSearchQuery.toLowerCase()))
                        .map((log) => {
                          const dateObj = new Date(log.timestamp);
                          const formattedTime = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -50 }}
                              transition={{ duration: 0.18 }}
                      className="p-3 bg-app-card rounded-2xl flex items-center justify-between gap-3 border border-app-border shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <img src={log.partnerPhoto} alt={log.partnerName} className="w-10 h-10 rounded-full object-cover border border-app-border shrink-0" />
                                
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                  <span className="text-xs font-black truncate text-app-text-primary leading-tight">
                                    {log.partnerName}
                                  </span>
                                  
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {log.direction === 'incoming' && (
                                      <PhoneIncoming className="w-3 h-3 text-emerald-500 shrink-0" />
                                    )}
                                    {log.direction === 'outgoing' && (
                                      <PhoneOutgoing className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
                                    )}
                                    {log.direction === 'missed' && (
                                      <PhoneMissed className="w-3 h-3 text-red-500 shrink-0" />
                                    )}

                                    <span className={`text-[9px] font-extrabold uppercase tracking-wider ${
                                      log.direction === 'missed' ? 'text-red-500' : 'text-app-text-secondary'
                                    }`}>
                                      {log.direction === 'incoming' && 'Incoming'}
                                      {log.direction === 'outgoing' && 'Outgoing'}
                                      {log.direction === 'missed' && 'Missed'}
                                    </span>

                                    <span className="text-[9px] opacity-40">•</span>

                                    <span className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 shrink-0">
                                      {log.type === 'video' ? '📹 Video' : '📞 Voice'}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 mt-0.5 select-none">
                                    <span className="text-[10px] text-slate-400 dark:text-slate-200/50 font-medium whitespace-nowrap">
                                      {formattedTime}
                                    </span>
                                    {log.duration !== undefined && (
                                      <>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold font-mono bg-emerald-500/10 px-1 py-0.5 rounded">
                                          {formatTimer(log.duration)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Dial Back Call and Trash Controls */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleCallBack(log, 'audio')}
                                  className="w-7 h-7 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                                  title={`Redial voice call to ${log.partnerName}`}
                                >
                                  <Phone className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleCallBack(log, 'video')}
                                  className="w-7 h-7 rounded-full bg-blue-500/15 hover:bg-blue-500 text-blue-600 dark:text-blue-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                                  title={`Redial video call to ${log.partnerName}`}
                                >
                                  <Video className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCallLog(log.id)}
                                  className="w-7 h-7 rounded-full bg-red-500/15 hover:bg-red-500 text-red-500 dark:text-red-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>
                  )}
                </div>

              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <SettingsTab
                theme={themeSetting}
                onChangeTheme={(theme) => setThemeSetting(theme)}
                onLogout={handleLogout}
                user={user}
                onUpdateUser={(updated) => { setUser(updated); localStorage.setItem('dotalk_user', JSON.stringify(updated)); }}
                onStartPrivateChat={async (partnerId) => { await startPrivateChat(partnerId); setActiveTab('chats'); }}
              />
            )}

          </div>

          {/* C. BOTTOM PHONE FRAME NAVIGATION BAR */}
          <div className={`h-16 px-4 flex items-center justify-around border-t relative z-30 shadow-md ${
            themeSetting === 'dark' ? 'bg-[#3B2E2B] border-[#5A4A45] text-[#FEEBC5]' : 'bg-[#FEEBC5] border-[#E8D6B3] text-[#3B2E2B]'
          }`}>
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'chats' ? 'scale-110 text-app-text-primary font-black opacity-100' : 'opacity-[0.55] text-app-text-primary hover:opacity-100'
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5" />
                {totalUnreads > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">
                    {totalUnreads}
                  </span>
                )}
              </div>
              <span className="text-[9px]">Chats</span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'groups' ? 'scale-110 text-app-text-primary font-black opacity-100' : 'opacity-[0.55] text-app-text-primary hover:opacity-100'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[9px]">Groups</span>
            </button>

            <button
              onClick={() => setActiveTab('calls')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'calls' ? 'scale-110 text-app-text-primary font-black opacity-100' : 'opacity-[0.55] text-app-text-primary hover:opacity-100'
              }`}
            >
              <Phone className="w-5 h-5" />
              <span className="text-[9px]">Calls</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'settings' ? 'scale-110 text-app-text-primary font-black opacity-100' : 'opacity-[0.55] text-app-text-primary hover:opacity-100'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[9px]">Settings</span>
            </button>
          </div>

        </div>
      )}

      {/* D. FULL SCREEN INTERACTIVE COLOR-COHERENT CALLING SYSTEM */}
      <AnimatePresence>
        {callState !== 'idle' && callPartner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="absolute inset-0 z-50 bg-[#121212] text-white flex flex-col justify-between p-6 font-sans resize"
          >
            
            {/* Incoming Call Header Accent badge */}
            <div className="flex flex-col items-center pt-8 text-center gap-2 select-none">
              <motion.span
                key={`${callType}-${callState}`}
                initial={{ y: -15, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 15, opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400 bg-stone-900 px-3.5 py-1 rounded-full border border-stone-800 shadow animate-pulse inline-block"
              >
                {callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
              </motion.span>
              <p className="text-[11px] opacity-75 text-amber-200/75">DoTalk End-to-End Encrypted Secure Line</p>
            </div>

            {/* Core Visual Focus Area */}
            <div className="my-auto flex flex-col items-center text-center relative py-6">
              
              {/* Animated Ripple circles for call state */}
              <div className="relative flex items-center justify-center mb-8">
                <div className="absolute w-36 h-36 rounded-full bg-amber-500/10 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="absolute w-28 h-28 rounded-full bg-amber-500/20 animate-pulse" />
                <img
                  src={callPartner.profilePhoto}
                  alt={callPartner.fullName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 relative z-10 shadow-lg"
                />
              </div>

              <h2 className="text-xl font-extrabold tracking-tight text-white">{callPartner.fullName}</h2>
              <p className="text-xs opacity-75 mt-1 text-stone-300">@{callPartner.username}</p>

              {/* Dynamic visual state message */}
              <div className="mt-6 w-full min-h-[72px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {callState === 'connected' ? (
                    <motion.div
                      key="connected-state"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                      className="flex flex-col gap-1 items-center"
                    >
                      <motion.span
                        key={callDuration}
                        initial={{ scale: 0.9, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="text-lg font-bold font-mono tracking-wider text-emerald-400 py-1.5 px-4 bg-black/35 rounded-2xl border border-emerald-500/20 inline-block"
                      >
                        {formatTimer(callDuration)}
                      </motion.span>
                      <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mt-1">Active Call Session</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`other-state-${callState}`}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex flex-col gap-1 items-center"
                    >
                      {callState === 'outgoing' && (
                        <div className="flex flex-col gap-1 items-center animate-fade">
                          <span className="text-sm font-bold text-amber-400 animate-pulse">Ringing...</span>
                          <p className="text-[10px] opacity-75 text-stone-300">Waiting for response</p>
                        </div>
                      )}
                      {callState === 'incoming' && (
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-sm font-bold text-emerald-400 animate-bounce">Calling you incoming...</span>
                          <p className="text-[10px] opacity-75 text-stone-300">Click accept to connect</p>
                        </div>
                      )}
                      {callState === 'ended' && (
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-sm font-bold text-red-500">Call Terminated</span>
                          <p className="text-[10px] opacity-75 text-stone-305">Finished</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Real WebRTC Video stream box */}
              {callType === 'video' && callState === 'connected' && (
                <div className="w-full mt-6 h-36 flex gap-3 relative z-15">
                  <div className="flex-1 bg-black rounded-xl border border-white/10 relative overflow-hidden">
                    <img src={user?.profilePhoto} className="absolute right-2 top-2 w-7 h-7 rounded-full border border-amber-400 z-10 shadow-md" />
                    {localStream ? (
                      <video
                        ref={el => { if (el) el.srcObject = localStream; }}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] italic opacity-60 bg-amber-900/10">
                        {isVideoMuted ? 'Camera Muted' : 'Setting up camera preview...'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 bg-black rounded-xl border border-white/10 relative overflow-hidden">
                    <img src={callPartner.profilePhoto} className="absolute right-2 top-2 w-7 h-7 rounded-full border border-amber-400 z-10 shadow-md" />
                    {remoteStream ? (
                      <video
                        ref={el => { if (el) el.srcObject = remoteStream; }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] italic opacity-60 bg-amber-900/10 animate-pulse">
                        Connecting partner video feed...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Lower Control Actions Deck */}
            <div className="flex flex-col gap-6 pb-8 items-center bg-stone-900 p-5 rounded-3xl border border-stone-800 shadow-inner">
              
              {/* Audio Toggle deck (In Call) */}
              {callState === 'connected' && (
                <div className="flex gap-6 items-center justify-center animate-fade">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-3 rounded-full border transition-all cursor-pointer ${
                      isMuted ? 'bg-amber-400 text-stone-950 border-amber-400' : 'bg-transparent border-white/20 text-white hover:bg-white/10'
                    }`}
                    title="Mute Mic"
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {callType === 'video' && (
                    <button
                      onClick={() => setIsVideoMuted(!isVideoMuted)}
                      className={`p-3 rounded-full border transition-all cursor-pointer ${
                        isVideoMuted ? 'bg-amber-400 text-stone-950 border-amber-400' : 'bg-transparent border-white/20 text-white hover:bg-white/10'
                      }`}
                      title="Camera state"
                    >
                      {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>
                  )}

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-3 rounded-full border transition-all cursor-pointer ${
                      isSpeakerOn ? 'bg-emerald-400 text-stone-950 border-emerald-400' : 'bg-transparent border-white/20 text-white hover:bg-white/10'
                    }`}
                    title="Speakerphone"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Answer & Hangup main togglers */}
              <div className="flex justify-center items-center gap-8 w-full">
                {callState === 'incoming' ? (
                  <>
                    <button
                      onClick={handleRejectCall}
                      className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-all transform active:scale-95"
                      title="Decline Call"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </button>

                    <button
                      onClick={handleAnswerCall}
                      className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:bg-emerald-600 transition-all transform active:scale-95 animate-bounce"
                      title="Accept Call"
                    >
                      <Phone className="w-6 h-6" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={callState === 'outgoing' ? handleRejectCall : handleEndCall}
                    disabled={callState === 'ended'}
                    className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                      callState === 'ended' ? 'bg-zinc-600 opacity-50' : 'bg-red-600 hover:bg-red-700'
                    }`}
                    title="End Call"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Call Status Indicators */}
              <p className="text-[9px] opacity-40 text-center uppercase tracking-wide">
                {callState === 'outgoing' && 'Ringing...'}
                {callState === 'incoming' && 'Incoming call...'}
                {callState === 'connected' && `Speaker is ${isSpeakerOn ? 'ON' : 'OFF'} • Mic is ${isMuted ? 'Muted' : 'Unmuted'}`}
              </p>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Elegant non-blocking Toast Banner */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className={`px-4 py-2.5 rounded-full shadow-2xl border text-xs font-bold leading-none tracking-tight flex items-center justify-center gap-2 ${
            toast.type === 'success' 
              ? 'bg-emerald-500 border-emerald-600/20 text-white' 
              : 'bg-red-600 border-red-700/20 text-white'
          }`}>
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Responsive custom-built Confirmation Modal overlay */}
      {confirmModal && (
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px] z-50 flex items-end justify-center p-4 animate-fade-in" id="custom-confirm-modal">
          <div className="w-full bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 animate-slide-up flex flex-col gap-4 text-left">
            <div>
              <h3 className="text-base font-bold text-stone-950 dark:text-stone-50 tracking-tight">{confirmModal.title}</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-1 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 text-center rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-3 text-center rounded-2xl font-semibold text-xs text-white transition-colors cursor-pointer ${
                  confirmModal.danger 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </PhoneFrame>
  );
}

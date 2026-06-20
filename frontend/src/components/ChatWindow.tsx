import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  MoreVertical, 
  Check, 
  MessageSquare, 
  Edit, 
  Trash2, 
  Reply, 
  Smile, 
  Image, 
  FileText, 
  CheckCheck, 
  Phone, 
  Video, 
  Search, 
  X, 
  Lock, 
  ShieldAlert,
  Mic,
  Camera,
  Download,
  Users,
  CheckCircle,
  Play,
  Volume2
} from 'lucide-react';
import { apiFetch, getSocketConnection } from '../utils/api.js';

// Advanced WhatsApp elements
import { 
  ChatAudioPlayer, 
  ContactCardWidget, 
  CameraCaptureOverlay, 
  ContactShareModal, 
  AttachmentPreviewModal 
} from './AttachmentShare.jsx';

interface ChatWindowProps {
  chat: {
    _id: string;
    isGroup: boolean;
    title: string;
    image: string;
    partner?: any;
    participants: string[];
    groupDescription?: string;
    isClosed?: boolean;
  };
  currentUser: any;
  onBack: () => void;
  theme: 'light' | 'dark';
  onInitiateCall?: (type: 'audio' | 'video') => void;
}

export default function ChatWindow({ chat, currentUser, onBack, theme, onInitiateCall }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyMessage, setReplyMessage] = useState<any>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);

  // Advanced attachments states
  const [showCamera, setShowCamera] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<any[]>([]);
  const [caption, setCaption] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [zoomedMediaUrl, setZoomedMediaUrl] = useState<string | null>(null);

  // Voice note / active mic recorder
  const [isRecordingVN, setIsRecordingVN] = useState(false);
  const [vnDuration, setVnDuration] = useState(0);
  const [vnIsCancelled, setVnIsCancelled] = useState(false);
  const [vnSlideOffset, setVnSlideOffset] = useState(0);

  const vnTimerRef = useRef<any>(null);
  const vnMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const vnAudioChunksRef = useRef<Blob[]>([]);
  const vnDragStartX = useRef<number | null>(null);

  // Dynamic user details drawer states
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isClosedState, setIsClosedState] = useState<boolean>(!!chat.isClosed);
  const [partnerBlockedByMe, setPartnerBlockedByMe] = useState<boolean>(
    !chat.isGroup && chat.partner && currentUser?.blockedUsers?.includes(chat.partner._id)
  );
  const [groupParticipants, setGroupParticipants] = useState<any[]>([]);

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [localConfirmModal, setLocalConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUnblockPartner = async () => {
    if (!chat.partner) return;
    try {
      const res = await apiFetch('/api/users/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIdToUnblock: chat.partner._id })
      });
      if (res.ok) {
        setPartnerBlockedByMe(false);
        showToast('Contact unblocked successfully!', 'success');
      }
    } catch (e) {
      console.error('Failed to unblock partner:', e);
    }
  };

  const handleReopenChat = async () => {
    try {
      const res = await apiFetch(`/api/chats/${chat._id}/reopen`, {
        method: 'POST'
      });
      if (res.ok) {
        setIsClosedState(false);
        alert('Conversation reopened!');
      }
    } catch (e) {
      console.error('Failed to reopen chat:', e);
    }
  };

  useEffect(() => {
    if (chat.isGroup) {
      apiFetch('/api/users/search?query=')
        .then(res => res.json())
        .then(users => {
          const filtered = users.filter((u: any) => chat.participants?.includes(u._id));
          setGroupParticipants(filtered);
        })
        .catch(err => console.error('Failed to load group users:', err));
    }
  }, [chat.isGroup, chat.participants]);

  // Dynamic Viewport Height state to fix mobile software keyboard overlap
  const [viewportHeight, setViewportHeight] = useState('100dvh');

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamic viewport height calculation
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      } else {
        setViewportHeight(`${window.innerHeight}px`);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Initialize socket and fetch historic logs
  useEffect(() => {
    const socket = getSocketConnection();
    socketRef.current = socket;

    socket.emit('register_user', currentUser._id);
    socket.emit('join_chat', chat._id);

    fetchMessages();

    socket.on('new_message', (msg: any) => {
      if (msg.chatId === chat._id) {
        setMessages(prev => {
          if (prev.find(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        socket.emit('mark_seen', { chatId: chat._id, userId: currentUser._id });
      }
    });

    socket.on('user_typing', (data: any) => {
      if (data.chatId === chat._id && data.userId !== currentUser._id) {
        setPartnerTyping(data.isTyping);
      }
    });

    socket.on('message_reaction_update', (data: any) => {
      setMessages(prev => prev.map(m =>
        m._id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    });

    socket.on('messages_seen_ack', (data: any) => {
      if (data.chatId === chat._id) {
        setMessages(prev => prev.map(m => {
          if (m.senderId !== data.userId && !m.seenBy.includes(data.userId)) {
            return { ...m, seenBy: [...m.seenBy, data.userId] };
          }
          return m;
        }));
      }
    });

    return () => {
      socket.emit('leave_chat', chat._id);
      socket.disconnect();
    };
  }, [chat._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await apiFetch(`/api/chats/${chat._id}/messages`);
      const data = await response.json();
      if (response.ok) {
        setMessages(data);
        socketRef.current?.emit('mark_seen', { chatId: chat._id, userId: currentUser._id });
      }
    } catch (e) {
      console.error('Failed to load chat history');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customBody?: any) => {
    if (e) e.preventDefault();
    if (!text.trim() && !customBody) return;

    const payload = customBody || {
      chatId: chat._id,
      senderId: currentUser._id,
      senderName: currentUser.fullName,
      text: text,
      replyToMessageId: replyMessage ? replyMessage._id : undefined
    };

    if (editingMsg) {
      try {
        const response = await apiFetch(`/api/chats/${chat._id}/messages/${editingMsg._id}`, {
          method: 'PUT',
          body: JSON.stringify({ newText: text })
        });
        if (response.ok) {
          const updated = await response.json();
          setMessages(prev => prev.map(m => m._id === editingMsg._id ? updated : m));
          setEditingMsg(null);
          setText('');
        }
      } catch (e) {
        console.error('Edit failed');
      }
      return;
    }

    socketRef.current?.emit('send_message', payload);
    setText('');
    setReplyMessage(null);
    handleTyping(false);
  };

  const handleTyping = (isTyping: boolean) => {
    setTyping(isTyping);
    socketRef.current?.emit('typing', {
      chatId: chat._id,
      userId: currentUser._id,
      isTyping
    });
  };

  const handleReact = (messageId: string, emoji: string) => {
    socketRef.current?.emit('message_react', {
      chatId: chat._id,
      messageId,
      userId: currentUser._id,
      username: currentUser.username,
      emoji
    });
    setShowOptionsId(null);
  };

  const handleDeleteMessage = async (messageId: string, everyone: boolean) => {
    try {
      const response = await apiFetch(`/api/chats/${chat._id}/messages/${messageId}/delete`, {
        method: 'POST',
        body: JSON.stringify({ everyone })
      });
      if (response.ok) {
        const deleted = await response.json();
        setMessages(prev => prev.map(m => m._id === messageId ? deleted : m));
      }
    } catch (e) {
      console.error('Delete message request failed');
    }
    setShowOptionsId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    setShowAttachMenu(false);

    const prepared: any[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > 50 * 1024 * 1024) {
        alert(`Error: "${file.name}" exceeds the 50MB size limit.`);
        continue;
      }

      const mimeType = file.type;
      let type: 'image' | 'video' | 'file' | 'audio' = 'file';
      if (mimeType.startsWith('image/')) type = 'image';
      else if (mimeType.startsWith('video/')) type = 'video';
      else if (mimeType.startsWith('audio/')) type = 'audio';

      const formatKMB = (bytes: number) => {
        if (!bytes || bytes <= 0) return '0 Bytes';
        const k = 1024;
        const s = ['Bytes', 'KB', 'MB'];
        const idx = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, idx)).toFixed(1)) + ' ' + s[idx];
      };

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      prepared.push({
        name: file.name,
        type,
        sizeStr: formatKMB(file.size),
        dataUrl
      });
    }

    if (prepared.length > 0) {
      setPreviewFiles(prev => [...prev, ...prepared]);
      setCaption('');
    }
    // reset element
    e.target.value = '';
  };

  const handleSendAttachments = async () => {
    if (previewFiles.length === 0) return;
    
    setUploadProgress(10);
    const intervalRef = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(intervalRef);
          return 90;
        }
        return prev + 12;
      });
    }, 150);

    try {
      for (let i = 0; i < previewFiles.length; i++) {
        const file = previewFiles[i];
        let backendUrl = '';
        let dbFileName = file.name;
        let dbFileSize = file.sizeStr;

        if (file.type === 'contact') {
          // compile instant contact .vcf string
          const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${file.name}\nN:${file.name.split(' ')[1]||''};${file.name.split(' ')[0]||''};;;\nTEL;TYPE=CELL,VOICE:+1 (555) 728-1920\nNOTE:DoTalk member @${file.dataUrl}\nEND:VCARD`;
          const base64Vcard = btoa(unescape(encodeURIComponent(vcard)));
          const dataUrlVcard = `data:text/vcard;base64,${base64Vcard}`;

          const res = await apiFetch('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              fileName: `${file.name.replace(/\s+/g, '_')}_contact.vcf`,
              fileType: 'file',
              fileData: dataUrlVcard
            })
          });

          if (res.ok) {
            const data = await res.json();
            backendUrl = data.cloudinaryUrl;
            dbFileName = data.fileName;
            dbFileSize = data.fileSize;
          } else {
            throw new Error('Contact upload block failed');
          }
        } else {
          // Standard upload file
          const res = await apiFetch('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileData: file.dataUrl
            })
          });

          if (res.ok) {
            const data = await res.json();
            backendUrl = data.cloudinaryUrl;
            dbFileName = data.fileName;
            dbFileSize = data.fileSize;
          } else {
            const errData = await res.json();
            throw new Error(errData.error || 'Server rejected file upload');
          }
        }

        // Emit sequentially
        await handleSendMessage(undefined, {
          chatId: chat._id,
          senderId: currentUser._id,
          senderName: currentUser.fullName,
          text: i === 0 ? caption : '',
          mediaUrl: backendUrl,
          mediaType: file.type === 'contact' ? 'contact' : file.type,
          mediaName: dbFileName,
          mediaSize: dbFileSize,
          replyToMessageId: replyMessage ? replyMessage._id : undefined
        });
      }

      setUploadProgress(100);
      setTimeout(() => {
        setPreviewFiles([]);
        setCaption('');
        setUploadProgress(0);
        clearInterval(intervalRef);
      }, 350);

    } catch (err: any) {
      console.error('[Attachment share fail]', err);
      alert(err.message || 'Media post failed. Ensure connection or type configurations.');
      setUploadProgress(0);
      clearInterval(intervalRef);
    }
  };

  const handleStartRecordingVN = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setVnIsCancelled(false);
      setVnSlideOffset(0);
      vnAudioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      vnMediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          vnAudioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      vnDragStartX.current = clientX;

      mediaRecorder.start();
      setIsRecordingVN(true);
      setVnDuration(0);

      vnTimerRef.current = setInterval(() => {
        setVnDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Audio recorder denied:', err);
      alert('Microphone access represents a security blocking or missing interface.');
    }
  };

  const handleDragRecordingVN = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isRecordingVN || vnDragStartX.current === null) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - vnDragStartX.current;

    if (deltaX < 0) {
      const offset = Math.min(140, Math.abs(deltaX));
      setVnSlideOffset(offset);
      if (offset >= 75) {
        setVnIsCancelled(true);
      } else {
        setVnIsCancelled(false);
      }
    }
  };

  const handleStopRecordingVN = () => {
    if (!isRecordingVN || !vnMediaRecorderRef.current) return;

    clearInterval(vnTimerRef.current);
    setIsRecordingVN(false);
    vnDragStartX.current = null;

    const isCancelled = vnIsCancelled || vnSlideOffset >= 75;

    if (isCancelled) {
      vnMediaRecorderRef.current.stop();
      vnAudioChunksRef.current = [];
      setVnSlideOffset(0);
      setVnIsCancelled(false);
      return;
    }

    vnMediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(vnAudioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size > 150) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setPreviewFiles([{
              name: `voice_note_${Date.now()}.mp3`,
              type: 'audio',
              sizeStr: `${Math.round(audioBlob.size / 1024)} KB`,
              dataUrl: reader.result
            }]);
            setCaption('');
          }
        };
        reader.readAsDataURL(audioBlob);
      }
    };

    vnMediaRecorderRef.current.stop();
    setVnSlideOffset(0);
    setVnIsCancelled(false);
  };

  return (
    <div 
      style={{ height: viewportHeight }}
      className={`w-full flex flex-col justify-between relative overflow-hidden ${
        theme === 'dark' ? 'bg-[#3B2E2B]' : 'bg-[#FAECE1]'
      }`}
    >
      
      {/* PERFECT WHATSAPP-LIKE HEADER HEADER */}
      <div className={`h-16 px-3 flex items-center justify-between border-b relative z-30 shadow-sm ${
        theme === 'dark' ? 'bg-[#3B2E2B] border-[#5A4A45] text-[#FEEBC5]' : 'bg-[#FEEBC5] border-[#E8D6B3] text-[#3B2E2B]'
      }`}>
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button 
            onClick={onBack} 
            className={`p-1.5 rounded-full transition-colors ${
              theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-emerald-800/55'
            }`}
          >
            <ArrowLeft className="w-5.5 h-5.5" />
          </button>
          
          <div 
            onClick={() => setShowProfileDetails(true)} 
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-90 active:scale-98 transition-all"
            title="Click to view details"
          >
            <div className="relative shrink-0">
              <img 
                src={chat.image} 
                alt={chat.title} 
                className="w-10 h-10 rounded-full object-cover border border-white/20" 
              />
              {!chat.isGroup && chat.partner?.onlineStatus === 'online' && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#128C7E]" />
              )}
            </div>

            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-bold tracking-tight truncate leading-tight">{chat.title}</span>
              <span className="text-[10px] opacity-85 truncate leading-none">
                {partnerTyping ? (
                  <span className="text-emerald-400 font-extrabold animate-pulse">typing...</span>
                ) : chat.isGroup ? (
                  'group chat • details'
                ) : (
                  chat.partner?.onlineStatus === 'online' ? 'Online • details' : 'Last seen recently • details'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Action icons like WhatsApp */}
        <div className="flex items-center gap-1">
          {!chat.isGroup && (
            <>
              <button 
                onClick={() => onInitiateCall?.('video')}
                className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-emerald-800/55'}`}
                title="Start Video Call"
              >
                <Video className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => onInitiateCall?.('audio')}
                className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-emerald-800/55'}`}
                title="Start Voice Call"
              >
                <Phone className="w-4.5 h-4.5" />
              </button>
            </>
          )}
          <button 
            onClick={() => setShowProfileDetails(true)}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-emerald-800/55'}`}
            title="View Details"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={() => setShowProfileDetails(true)}
            className={`p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-emerald-800/55'}`}
            title="Menu"
          >
            <MoreVertical className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* CHAT BUBBLES - NO SHIFTING */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4 scrollbar-thin bg-app-bg">
        {messages.map((m) => {
          const isMe = m.senderId === currentUser._id;
          const showOptions = showOptionsId === m._id;

          return (
            <div key={m._id} className={`flex flex-col max-w-[85%] relative ${isMe ? 'self-end' : 'self-start'}`}>
              
              {chat.isGroup && !isMe && (
                <span className={`text-[10px] font-bold mb-0.5 ml-2 ${
                  theme === 'dark' ? 'text-orange-200' : 'text-emerald-700'
                }`}>{m.senderName}</span>
              )}

              {/* Reply Quote bubble */}
              {m.replyToMessageId && (
                <div className={`text-[10px] p-2 pl-3 rounded-t-xl mb-[-4px] opacity-85 border-l-4 ${
                  isMe ? 'bg-emerald-900/20 text-slate-100 border-[#056162]' : 'bg-zinc-200/80 text-slate-700 border-[#A67C52]'
                }`}>
                  <span className="font-bold block text-[9px]">Replying to:</span>
                  <span className="italic truncate block">{m.replyToMessageText || 'Media attachment'}</span>
                </div>
              )}

              {/* Chat Bubble Body */}
              <div
                onClick={() => setShowOptionsId(m._id === showOptionsId ? null : m._id)}
                className={`p-3 rounded-2xl shadow-sm text-sm relative transition-all cursor-pointer ${
                  m.isDeletedForEveryone ? 'italic opacity-60' : ''
                } ${
                  isMe
                    ? 'bg-[#FEEBC5] text-[#3B2E2B] rounded-tr-none border border-[#E8D6B3]'
                    : theme === 'dark'
                      ? 'bg-[#4A3A36] text-[#FEEBC5] rounded-tl-none border border-[#5A4A45]'
                      : 'bg-[#FFFFFF] text-[#3B2E2B] rounded-tl-none border border-[#E8D6B3]'
                }`}
              >
                {m.mediaType && (
                  <div className="mb-2">
                    {m.mediaType === 'image' && (
                      <div className="relative group overflow-hidden rounded-lg cursor-zoom-in">
                        <img 
                          onClick={() => setZoomedMediaUrl(m.mediaUrl)}
                          src={m.mediaUrl} 
                          alt="shared snap" 
                          className="w-full max-h-52 rounded-lg object-cover hover:scale-101 transition-transform" 
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded-md flex">
                          <a href={m.mediaUrl} download={m.mediaName || 'image.png'} className="p-1 hover:bg-white/20 rounded">
                            <Download className="w-3.5 h-3.5 text-white" />
                          </a>
                        </div>
                      </div>
                    )}
                    {m.mediaType === 'video' && (
                      <div className="relative group overflow-hidden rounded-lg border border-black/10">
                        <video src={m.mediaUrl} controls className="w-full max-h-60 rounded-lg object-cover bg-black" playsInline />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded-md flex">
                          <a href={m.mediaUrl} download={m.mediaName || 'video.mp4'} className="p-1 hover:bg-white/20 rounded">
                            <Download className="w-3.5 h-3.5 text-white" />
                          </a>
                        </div>
                      </div>
                    )}
                    {m.mediaType === 'file' && (
                      <div className="flex items-center gap-2 bg-stone-100 dark:bg-black/35 p-2.5 rounded-xl border border-black/5 dark:border-white/5 text-left">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-grow overflow-hidden pr-1">
                          <span className="text-xs font-bold block truncate leading-tight dark:text-slate-100 text-stone-800" title={m.mediaName}>
                            {m.mediaName}
                          </span>
                          <span className="text-[9px] opacity-75 block font-mono mt-0.5">
                            {m.mediaSize || 'Document'}
                          </span>
                        </div>
                        <a 
                          href={m.mediaUrl} 
                          download={m.mediaName || 'file'} 
                          className="w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center shrink-0 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                    {m.mediaType === 'audio' && (
                      <ChatAudioPlayer
                        src={m.mediaUrl}
                        name={m.mediaName || 'audio_memo.mp3'}
                        size={m.mediaSize || '120 KB'}
                        theme={theme}
                        isVoiceNote={m.mediaName?.includes('voice_note') || m.mediaName?.includes('recording')}
                        senderPhoto={m.senderId === currentUser._id ? currentUser.profilePhoto : chat.partner?.profilePhoto}
                      />
                    )}
                    {m.mediaType === 'contact' && (
                      <ContactCardWidget
                        fullName={m.mediaName || 'Contact User'}
                        username={m.mediaUrl || ''}
                        bio="DoTalk Contact profile shared details."
                        theme={theme}
                        onQuickMessage={() => {
                          alert(`To converse with @${m.mediaUrl}, find them in search dashboard.`);
                        }}
                      />
                    )}
                  </div>
                )}

                <p className="leading-relaxed text-[13px]">{m.text}</p>

                {m.reactions && m.reactions.length > 0 && (
                  <div className="absolute -bottom-2.5 right-2 flex gap-0.5 bg-white dark:bg-[#4A3B36] border px-1.5 py-0.5 rounded-full shadow text-[10px] z-10 font-bold">
                    {m.reactions.map((r: any, idx: number) => (
                      <span key={idx} title={r.username}>{r.emoji}</span>
                    ))}
                  </div>
                )}

                <div className="flex justify-end items-center gap-1 mt-1 opacity-70 text-[9px] text-right">
                  {m.isEdited && <span>edited</span>}
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && (
                    m.seenBy.length > 1 ? (
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500 font-bold" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-zinc-400" />
                    )
                  )}
                </div>
              </div>

              {/* Hover/Tap triggers Options popup */}
              {showOptions && !m.isDeletedForEveryone && (
                <div className={`absolute bottom-full mb-1 z-40 bg-white dark:bg-[#4A3B36] border border-[#8C6A4D]/30 p-1.5 rounded-xl flex gap-1.5 shadow-md ${
                  isMe ? 'right-0' : 'left-0'
                }`}>
                  <button onClick={() => setReplyMessage(m)} className="p-1.5 hover:bg-black/5 rounded-lg text-xs" title="Reply"><Reply className="w-4 h-4 text-slate-800 dark:text-slate-100"/></button>
                  <button onClick={() => handleReact(m._id, '👍')} className="p-1 hover:bg-black/5 rounded-lg text-sm">👍</button>
                  <button onClick={() => handleReact(m._id, '❤️')} className="p-1 hover:bg-black/5 rounded-lg text-sm">❤️</button>
                  <button onClick={() => handleReact(m._id, '😂')} className="p-1 hover:bg-black/5 rounded-lg text-sm">😂</button>
                  
                  {isMe && (
                    <>
                      <button onClick={() => { setEditingMsg(m); setText(m.text); }} className="p-1.5 hover:bg-black/5 rounded-lg text-xs" title="Edit"><Edit className="w-4 h-4 text-slate-800 dark:text-slate-100"/></button>
                      <button onClick={() => handleDeleteMessage(m._id, true)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg text-xs" title="Delete Everyone"><Trash2 className="w-4 h-4"/></button>
                    </>
                  )}
                </div>
              )}

            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ATTACHMENT TRAY */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-4 right-4 bg-app-card rounded-3xl shadow-xl border border-app-border p-4 z-40 grid grid-cols-5 gap-1.5 animate-fade-in animate-slide-up">
          <button 
            type="button"
            onClick={() => { setShowAttachMenu(false); document.getElementById('galleryInput')?.click(); }} 
            className="flex flex-col items-center gap-1.5 text-stone-700 dark:text-stone-200 outline-none hover:scale-103 transition-transform"
          >
            <span className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center shadow-xs"><Image className="w-5 h-5 text-purple-600 dark:text-purple-400"/></span>
            <span className="text-[9px] font-bold">Gallery</span>
          </button>

          <button 
            type="button"
            onClick={() => { setShowAttachMenu(false); setShowCamera(true); }} 
            className="flex flex-col items-center gap-1.5 text-stone-700 dark:text-stone-200 outline-none hover:scale-103 transition-transform"
          >
            <span className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center shadow-xs"><Camera className="w-5 h-5 text-pink-600 dark:text-pink-400"/></span>
            <span className="text-[9px] font-bold">Camera</span>
          </button>

          <button 
            type="button"
            onClick={() => { setShowAttachMenu(false); document.getElementById('documentInput')?.click(); }} 
            className="flex flex-col items-center gap-1.5 text-stone-700 dark:text-stone-200 outline-none hover:scale-103 transition-transform"
          >
            <span className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shadow-xs"><FileText className="w-5 h-5 text-blue-600 dark:text-blue-400"/></span>
            <span className="text-[9px] font-bold">Document</span>
          </button>

          <button 
            type="button"
            onClick={() => { setShowAttachMenu(false); document.getElementById('audioInput')?.click(); }} 
            className="flex flex-col items-center gap-1.5 text-stone-700 dark:text-stone-200 outline-none hover:scale-103 transition-transform"
          >
            <span className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center shadow-xs"><Smile className="w-5 h-5 text-orange-600 dark:text-orange-400"/></span>
            <span className="text-[9px] font-bold">Audio Clip</span>
          </button>

          <button 
            type="button"
            onClick={() => { setShowAttachMenu(false); setShowContactPicker(true); }} 
            className="flex flex-col items-center gap-1.5 text-stone-700 dark:text-stone-200 outline-none hover:scale-103 transition-transform"
          >
            <span className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center shadow-xs"><Users className="w-5 h-5 text-teal-600 dark:text-teal-400"/></span>
            <span className="text-[9px] font-bold">Contact</span>
          </button>
        </div>
      )}

      {/* REPLY QUOTED STICKY BAR */}
      {replyMessage && (
        <div className={`px-4 py-2 border-t flex justify-between items-center ${
          theme === 'dark' ? 'bg-[#332724] border-zinc-700' : 'bg-orange-50 border-orange-100'
        }`}>
          <div className="flex flex-col border-l-4 border-emerald-500 pl-2 overflow-hidden">
            <span className="text-[10px] font-extrabold text-[#075E54] dark:text-orange-300">Replying to {replyMessage.senderName}</span>
            <span className="text-xs italic truncate opacity-80 text-slate-800 dark:text-slate-100">{replyMessage.text || 'Media file'}</span>
          </div>
          <button onClick={() => setReplyMessage(null)} className="p-1 hover:bg-black/5 rounded-full text-xs font-bold text-slate-800 dark:text-slate-100">✕</button>
        </div>
      )}

      {/* BOTTOM CONTROL PANEL */}
      <div className={`px-3 py-3 flex items-center justify-between border-t relative z-30 min-h-16 ${
        theme === 'dark' ? 'bg-[#3B2E2B] border-[#5A4A45] text-[#FEEBC5]' : 'bg-[#FEEBC5] border-[#E8D6B3] text-[#3B2E2B]'
      }`}>
        {partnerBlockedByMe ? (
          <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-red-500/10 dark:bg-red-500/15 border border-red-500/20 text-red-500 text-xs font-semibold animate-fade-in w-full">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>You have blocked this contact.</span>
            </div>
            <button
              onClick={handleUnblockPartner}
              type="button"
              className="px-3 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Unblock
            </button>
          </div>
        ) : isClosedState ? (
          <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-655 dark:text-amber-400 text-xs font-semibold animate-fade-in w-full">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>This conversation is closed.</span>
            </div>
            <button
              onClick={handleReopenChat}
              type="button"
              className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Reopen
            </button>
          </div>
        ) : (
          <div className="w-full flex items-center gap-2 transition-all">
            {/* Hidden Input Files fields */}
            <input 
              type="file" 
              id="galleryInput" 
              accept="image/*,video/*" 
              multiple 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <input 
              type="file" 
              id="documentInput" 
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <input 
              type="file" 
              id="audioInput" 
              accept="audio/*" 
              className="hidden" 
              onChange={handleFileChange} 
            />

            {isRecordingVN ? (
              <div 
                className="w-full flex items-center justify-between px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs text-red-500 animate-fade-in"
                onMouseMove={handleDragRecordingVN}
                onTouchMove={handleDragRecordingVN}
                onMouseUp={handleStopRecordingVN}
                onTouchEnd={handleStopRecordingVN}
              >
                <div className="flex items-center gap-2 font-bold select-none py-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
                  <span>Recording voice note: {Math.floor(vnDuration / 60)}:{(vnDuration % 60) < 10 ? '0' : ''}{vnDuration % 60}</span>
                </div>
                
                {/* Visual displacement indicator */}
                <div 
                  style={{ transform: `translateX(-${vnSlideOffset}px)` }}
                  className="text-[10px] font-bold opacity-75 transition-all text-neutral-500 dark:text-neutral-400 select-none cursor-pointer"
                  onClick={() => {
                    // Tap back cancel
                    setIsRecordingVN(false);
                    clearInterval(vnTimerRef.current);
                    vnMediaRecorderRef.current?.stop();
                    vnAudioChunksRef.current = [];
                    setVnSlideOffset(0);
                    setVnIsCancelled(false);
                  }}
                >
                  {vnIsCancelled ? "Release to Delete 🗑️" : "◀ Swipe left to cancel / Tap to close"}
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`p-2 rounded-full cursor-pointer hover:bg-black/5 transition-colors shrink-0 ${
                    showAttachMenu ? 'bg-orange-100/50' : ''
                  }`}
                  title="Share attachment"
                >
                  <Paperclip className="w-5 h-5 opacity-80 text-slate-800 dark:text-slate-100" />
                </button>

                <form onSubmit={handleSendMessage} className="flex-grow flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={text}
                    onChange={e => { setText(e.target.value); handleTyping(e.target.value.length > 0); }}
                    placeholder={editingMsg ? "Edit message..." : "Type a message..."}
                    className="flex-1 h-10 px-4 rounded-full border border-app-border bg-app-input-bg text-app-input-text placeholder-slate-400 text-sm outline-none focus:border-app-btn-bg min-w-0"
                  />

                  {text.trim() ? (
                    <button
                      type="submit"
                      className="w-10 h-10 rounded-full bg-app-btn-bg text-app-btn-text flex items-center justify-center shadow hover:opacity-95 cursor-pointer shrink-0 outline-none"
                    >
                      <Send className="w-4.5 h-4.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={handleStartRecordingVN}
                      onTouchStart={handleStartRecordingVN}
                      onMouseMove={handleDragRecordingVN}
                      onTouchMove={handleDragRecordingVN}
                      onMouseUp={handleStopRecordingVN}
                      onTouchEnd={handleStopRecordingVN}
                      className="w-10 h-10 rounded-full bg-app-btn-bg text-app-btn-text flex items-center justify-center shadow hover:opacity-90 cursor-pointer select-none shrink-0 outline-none hover:scale-102 active:scale-95 transition-transform"
                      title="Hold to record, hold & slide left to delete voice memo"
                    >
                      <Mic className="w-4.5 h-4.5" />
                    </button>
                  )}
                </form>
              </>
            )}
          </div>
        )}
      </div>

      {/* OVERLAY INTERACTIVE ADDONS */}

      {/* Camera Capture Direct overlay */}
      {showCamera && (
        <CameraCaptureOverlay
          theme={theme}
          onClose={() => setShowCamera(false)}
          onCapture={(dataUrl, type) => {
            setShowCamera(false);
            setPreviewFiles([{
              name: type === 'image' ? `Camera_Snap_${Date.now()}.jpg` : `Camera_Recording_${Date.now()}.webm`,
              type,
              sizeStr: type === 'image' ? '320 KB' : '1.4 MB',
              dataUrl
            }]);
            setCaption('');
          }}
        />
      )}

      {/* Database Select Contacts overlay */}
      {showContactPicker && (
        <ContactShareModal
          theme={theme}
          onClose={() => setShowContactPicker(false)}
          onContactsSelected={(selectedContacts) => {
            setShowContactPicker(false);
            const formatted = selectedContacts.map(c => ({
              name: c.fullName,
              type: 'contact',
              sizeStr: 'vCard Profile Card',
              dataUrl: c.username
            }));
            setPreviewFiles(formatted);
            setCaption('');
          }}
        />
      )}

      {/* Single/Multiple files Upload Preview overlay */}
      {previewFiles.length > 0 && (
        <AttachmentPreviewModal
          theme={theme}
          files={previewFiles}
          caption={caption}
          onCaptionChange={setCaption}
          uploadProgress={uploadProgress}
          onClose={() => setPreviewFiles([])}
          onRemoveFile={(idx) => {
            setPreviewFiles(prev => prev.filter((_, idx2) => idx2 !== idx));
          }}
          onSend={handleSendAttachments}
        />
      )}

      {/* Full screen high resolution media viewer */}
      {zoomedMediaUrl && (
        <div 
          className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center p-4 z-50 animate-fade-in text-white cursor-zoom-out"
          onClick={() => setZoomedMediaUrl(null)}
        >
          <button 
            onClick={() => setZoomedMediaUrl(null)} 
            className="absolute top-4 right-4 p-2 px-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-xs outline-none"
          >
            ✕ Close View
          </button>

          <div 
            className="max-w-3xl max-h-[75vh] flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <img src={zoomedMediaUrl} alt="Zoomed view" className="max-w-full max-h-[75vh] object-contain rounded-xl" />
          </div>

          <div className="mt-5 flex gap-4 shrink-0" onClick={e => e.stopPropagation()}>
            <a 
              href={zoomedMediaUrl} 
              download={`shared_media_${Date.now()}.jpg`}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-2xl text-xs font-bold text-white shadow transition-all hover:scale-102 flex items-center gap-1.5 outline-none select-none"
            >
              <Download className="w-4 h-4 text-white" />
              <span>Save to Device</span>
            </a>
          </div>
        </div>
      )}

      {/* DETAILED USER/ORGANIZATION PROFILE SLIDE-OVER SHEET */}
      {showProfileDetails && (
        <div className="absolute inset-0 bg-black/60 z-50 flex justify-end animate-fade-in">
          <div className={`w-full max-w-[364px] h-full flex flex-col justify-between overflow-hidden shadow-2xl bg-app-bg text-app-text-primary`}>
            
            {/* Drawer Header */}
            <div className={`p-4 flex items-center justify-between border-b bg-app-card border-app-border`}>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight">
                  {chat.isGroup ? 'Group Information' : 'Contact Details'}
                </span>
              </div>
              <button
                onClick={() => { setShowProfileDetails(false); setIsZoomed(false); }}
                className="p-1.5 rounded-full hover:bg-black/5"
                title="Close drawer"
              >
                <X className="w-5 h-5 opacity-70" />
              </button>
            </div>

            {/* Scrollable details panel */}
            <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5 scrollbar-thin">
              
              {/* Profile Card Banner */}
              <div className="flex flex-col items-center text-center gap-3">
                <div 
                  onClick={() => setIsZoomed(!isZoomed)}
                  className={`relative cursor-zoom-in group transition-all duration-300 ${
                    isZoomed ? 'scale-110 border-amber-400' : ''
                  }`}
                >
                  <img
                    src={chat.image}
                    alt={chat.title}
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#8C6A4D]/25 mx-auto bg-white shadow-md group-hover:scale-105 transition-transform"
                  />
                  {isZoomed && (
                    <div className="absolute inset-0 bg-black/15 rounded-full flex items-center justify-center">
                      <span className="text-[10px] text-white px-1.5 py-0.5 bg-black/50 rounded-full font-bold">Zoomed</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-extrabold tracking-tight">{chat.title}</h3>
                  <p className="text-xs opacity-75 mt-0.5">
                    {chat.isGroup ? `Created Room` : `@${chat.partner?.username || 'user'}`}
                  </p>
                </div>

                {!chat.isGroup && (
                  <div className="flex gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      chat.partner?.onlineStatus === 'online' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/30' 
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-300/30'
                    }`}>
                      {chat.partner?.onlineStatus === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                )}
              </div>

              <hr className="opacity-15" />

              {/* BIO / Description Info */}
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
                  {chat.isGroup ? 'Group Description' : 'Bio / Signature'}
                </span>
                <p className="text-xs bg-white/40 dark:bg-black/15 p-3 rounded-xl border border-neutral-300/20 italic leading-relaxed">
                  {chat.isGroup 
                    ? chat.groupDescription || 'No description provided.' 
                    : chat.partner?.bio || 'Hey there! I am using DoTalk.'
                  }
                </p>
              </div>

              {/* Private User Details */}
              {!chat.isGroup && chat.partner && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Email</span>
                    <span className="text-xs font-mono select-all bg-white/40 dark:bg-black/15 p-2.5 rounded-xl border border-neutral-300/20 block truncate">
                      {chat.partner.email || `${chat.partner.username}@dotalk.io`}
                    </span>
                  </div>
                </div>
              )}

              {/* Group participants roster list */}
              {chat.isGroup && (
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">
                    Group Members ({groupParticipants.length})
                  </span>
                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin mt-2">
                    {groupParticipants.map((part) => (
                      <div key={part._id} className="flex items-center gap-3 p-2 bg-white/30 dark:bg-black/10 rounded-xl border border-transparent hover:border-[#8C6A4D]/25 transition-colors">
                        <img src={part.profilePhoto} alt={part.fullName} className="w-8 h-8 rounded-full object-cover border animate-fade-in" />
                        <div className="flex-1 flex flex-col min-w-0 text-left">
                          <span className="text-xs font-bold leading-tight truncate block">{part.fullName}</span>
                          <span className="text-[9px] opacity-75 truncate block">@{part.username} {part._id === currentUser._id && '(You)'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <hr className="opacity-15" />

              {/* Shared Photos Library widget */}
              <div className="flex flex-col gap-1 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">Shared Media files</span>
                
                {messages.filter(m => m.mediaType === 'image').length === 0 ? (
                  <p className="text-[10px] italic opacity-50 my-2">No photos shared yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {messages.filter(m => m.mediaType === 'image').slice(0, 6).map((m, idx) => (
                      <img
                        key={idx}
                        src={m.mediaUrl}
                        alt="Shared thumbnail"
                        className="w-full h-16 rounded-xl object-cover border hover:scale-105 transition-transform cursor-pointer"
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Quick Settings Action tray */}
            <div className={`p-4 flex flex-col gap-2.5 border-t bg-app-card border-app-border`}>

              <button
                onClick={() => {
                  setLocalConfirmModal({
                    title: 'Clear Conversation Logs',
                    message: 'Are you sure you want to clear all messages? This keeps the contact in your list but removes the history for you.',
                    confirmText: 'Clear Logs',
                    cancelText: 'Cancel',
                    danger: true,
                    onConfirm: async () => {
                      try {
                        const res = await apiFetch(`/api/chats/${chat._id}/clear`, { method: 'POST' });
                        if (res.ok) {
                          setMessages([]);
                          setShowProfileDetails(false);
                          showToast('Conversation logs cleared successfully!', 'success');
                        } else {
                          showToast('Failed to clear logs', 'error');
                        }
                      } catch (e) {
                        console.error('Clear failed', e);
                        showToast('Error clearing logs', 'error');
                      } finally {
                        setLocalConfirmModal(null);
                      }
                    }
                  });
                }}
                className="w-full py-2 border rounded-xl hover:bg-black/5 font-extrabold text-[11px] uppercase tracking-wide cursor-pointer text-red-500 border-red-500/10"
              >
                Clear Conversation Logs
              </button>

              <button
                onClick={() => {
                  setLocalConfirmModal({
                    title: 'Delete Conversation',
                    message: 'Are you sure you want to delete this conversation completely? All messages will be permanently removed, and you will return to the home screen.',
                    confirmText: 'Delete Permanently',
                    cancelText: 'Cancel',
                    danger: true,
                    onConfirm: async () => {
                      try {
                        const res = await apiFetch(`/api/chats/${chat._id}/delete`, { method: 'POST' });
                        if (res.ok) {
                          setLocalConfirmModal(null);
                          setShowProfileDetails(false);
                          showToast('Conversation deleted permanently!', 'success');
                          setTimeout(() => {
                            onBack(); // Instantly returns back to list and fetch fresh chats
                          }, 500);
                        } else {
                          showToast('Failed to delete conversation', 'error');
                        }
                      } catch (e) {
                        console.error('Delete failed', e);
                        showToast('Error deleting conversation', 'error');
                      } finally {
                        setLocalConfirmModal(null);
                      }
                    }
                  });
                }}
                className="w-full py-2 border rounded-xl hover:bg-black/5 font-extrabold text-[11px] uppercase tracking-wide cursor-pointer text-red-650 border-red-600/20"
              >
                Delete Conversation
              </button>

              <button
                onClick={() => {
                  const url = isClosedState ? `/api/chats/${chat._id}/reopen` : `/api/chats/${chat._id}/close`;
                  setLocalConfirmModal({
                    title: isClosedState ? 'Reopen Conversation' : 'Close Conversation',
                    message: isClosedState 
                      ? 'Reopen this conversation thread?' 
                      : 'Are you sure you want to close this session? You will not be able to send messages until reopened.',
                    confirmText: isClosedState ? 'Reopen Thread' : 'Close Session',
                    cancelText: 'Cancel',
                    danger: !isClosedState,
                    onConfirm: async () => {
                      try {
                        const res = await apiFetch(url, { method: 'POST' });
                        if (res.ok) {
                          setIsClosedState(!isClosedState);
                          setShowProfileDetails(false);
                          showToast(`Conversation ${isClosedState ? 'reopened' : 'closed'}!`, 'success');
                        } else {
                          showToast('Failed to change session state', 'error');
                        }
                      } catch (e) {
                        console.error('Close/Reopen failed', e);
                        showToast('Error updating session', 'error');
                      } finally {
                        setLocalConfirmModal(null);
                      }
                    }
                  });
                }}
                className="w-full py-2 border rounded-xl hover:bg-black/5 font-extrabold text-[11px] uppercase tracking-wide cursor-pointer text-amber-500 border-amber-500/10"
              >
                {isClosedState ? 'Reopen Conversation' : 'Close Conversation'}
              </button>

              {!chat.isGroup && chat.partner && (
                <button
                  onClick={() => {
                    const url = partnerBlockedByMe ? '/api/users/unblock' : '/api/users/block';
                    const body = partnerBlockedByMe ? { userIdToUnblock: chat.partner?._id } : { userIdToBlock: chat.partner?._id };
                    setLocalConfirmModal({
                      title: partnerBlockedByMe ? 'Unblock Contact' : 'Block Contact',
                      message: partnerBlockedByMe 
                        ? 'Are you sure you want to unblock this contact and resume messaging?' 
                        : 'Are you sure you want to block this user? They will not be able to message or call you anymore.',
                      confirmText: partnerBlockedByMe ? 'Unblock Buddy' : 'Block Contact',
                      cancelText: 'Cancel',
                      danger: !partnerBlockedByMe,
                      onConfirm: async () => {
                        try {
                          const res = await apiFetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                          });
                          if (res.ok) {
                            setPartnerBlockedByMe(!partnerBlockedByMe);
                            setShowProfileDetails(false);
                            showToast(partnerBlockedByMe ? 'Contact unblocked successfully' : 'Contact blocked', 'success');
                          } else {
                            showToast('Failed to update block status', 'error');
                          }
                        } catch (e) {
                          console.error('Block action failed', e);
                          showToast('Error changing block status', 'error');
                        } finally {
                          setLocalConfirmModal(null);
                        }
                      }
                    });
                  }}
                  className={`w-full py-2 border rounded-xl hover:bg-black/5 font-extrabold text-[11px] uppercase tracking-wide cursor-pointer ${
                    partnerBlockedByMe ? 'text-emerald-500 border-zinc-200' : 'text-red-500 border-red-200'
                  }`}
                >
                  {partnerBlockedByMe ? 'Unblock Contact' : 'Block Contact'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Dynamic toast inside ChatWindow */}
      {toast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-fade-in pointer-events-none">
          <div className="px-4 py-2 bg-stone-900 border border-stone-800 text-white text-xs font-bold rounded-full shadow-2xl flex items-center gap-2">
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Dynamic custom confirm modal inside ChatWindow */}
      {localConfirmModal && (
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-[2px] z-50 flex items-end justify-center p-4 animate-fade-in">
          <div className="w-full bg-white dark:bg-[#1E1E1E] rounded-3xl p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 animate-slide-up flex flex-col gap-4 text-left">
            <div>
              <h3 className="text-base font-bold text-stone-950 dark:text-stone-50 tracking-tight">{localConfirmModal.title}</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mt-1 leading-relaxed">{localConfirmModal.message}</p>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setLocalConfirmModal(null)}
                className="flex-1 py-3 text-center rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                {localConfirmModal.cancelText || 'Cancel'}
              </button>
              <button
                onClick={localConfirmModal.onConfirm}
                className={`flex-1 py-3 text-center rounded-2xl font-semibold text-xs text-white transition-colors cursor-pointer ${
                  localConfirmModal.danger 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-emerald-500 hover:bg-emerald-600'
                }`}
              >
                {localConfirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

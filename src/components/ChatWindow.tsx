import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, Send, Paperclip, MoreVertical, Check, MessageSquare, Edit, Trash2, Reply, Smile, Image, FileText, CheckCheck, CornerUpLeft, Pin, ShieldClose } from 'lucide-react';

interface ChatWindowProps {
  chat: {
    _id: string;
    isGroup: boolean;
    title: string;
    image: string;
    partner?: any;
    participants: string[];
    groupDescription?: string;
  };
  currentUser: any;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export default function ChatWindow({ chat, currentUser, onBack, theme }: ChatWindowProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [replyMessage, setReplyMessage] = useState<any>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<any>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize socket and fetch historic logs
  useEffect(() => {
    // Connect socket on same origin port
    const socket = io({
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    // Register session
    socket.emit('register_user', currentUser._id);
    socket.emit('join_chat', chat._id);

    // Initial load
    fetchMessages();

    // Listen socket events
    socket.on('new_message', (msg: any) => {
      if (msg.chatId === chat._id) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.find(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        // Mark message seen instantly on dynamic socket delivery
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
      const token = localStorage.getItem('dotalk_token');
      const response = await fetch(`/api/chats/${chat._id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data);
        // Mark messages read on initial list view
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
        const token = localStorage.getItem('dotalk_token');
        const response = await fetch(`/api/chats/${chat._id}/messages/${editingMsg._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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

    // Dynamic Optimistic rendering triggers then socket emits
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
      const token = localStorage.getItem('dotalk_token');
      const response = await fetch(`/api/chats/${chat._id}/messages/${messageId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

  const triggerUploadMock = async (mediaType: 'image' | 'video' | 'file' | 'audio') => {
    setShowAttachMenu(false);
    // Simulate high speed media selection uploads
    const mockFiles: Record<string, string> = {
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500',
      video: 'https://www.w3schools.com/html/mov_bbb.mp4',
      file: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      audio: 'https://codesandbox.io/mock-audio.mp3'
    };

    const mockNames: Record<string, string> = {
      image: 'ux_concept_bezel.png',
      video: 'onboarding_lottie.mp4',
      file: 'UX_Specs_DoTalk.pdf',
      audio: 'rec_0923.mp3'
    };

    const url = mockFiles[mediaType];

    try {
      const token = localStorage.getItem('dotalk_token');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: mockNames[mediaType],
          fileType: mediaType,
          fileData: url
        })
      });
      const data = await response.json();
      if (response.ok) {
        // Send actual message
        handleSendMessage(undefined, {
          chatId: chat._id,
          senderId: currentUser._id,
          senderName: currentUser.fullName,
          text: '',
          mediaUrl: data.cloudinaryUrl,
          mediaType: mediaType,
          mediaName: data.fileName,
          mediaSize: data.fileSize
        });
      }
    } catch (e) {
      console.error('Mock upload fails');
    }
  };

  return (
    <div className={`w-full h-full flex flex-col justify-between relative ${
      theme === 'dark' ? 'bg-[#3B2E2B]' : 'bg-[#FAECE1]'
    }`}>
      
      {/* 1. HEADER CHAT BAR */}
      <div className={`h-14 px-4 flex items-center justify-between border-b relative z-30 shadow-sm ${
        theme === 'dark' ? 'bg-[#4A3B36] border-zinc-700 text-amber-50' : 'bg-white border-zinc-200/60 text-[#3B2E2B]'
      }`}>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 hover:bg-black/5 rounded-full"><ArrowLeft className="w-5.5 h-5.5" /></button>
          <img src={chat.image} alt={chat.title} className="w-9 h-9 rounded-full object-cover border border-zinc-300" />
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">{chat.title}</span>
            <span className="text-[10px] opacity-75">
              {partnerTyping ? (
                <span className="text-emerald-500 font-bold">typing...</span>
              ) : chat.isGroup ? (
                'group conversation'
              ) : (
                chat.partner?.onlineStatus === 'online' ? 'Online' : 'Last seen recently'
              )}
            </span>
          </div>
        </div>

        <button className="p-1.5 hover:bg-black/5 rounded-full"><MoreVertical className="w-5 h-5" /></button>
      </div>

      {/* 2. CHAT BUBBLES LIST VIEW */}
      <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 scrollbar-thin ${
        theme === 'dark' ? 'bg-[#3B2E2B]' : 'bg-[#FEEBC5]/40'
      }`}>
        {messages.map((m) => {
          const isMe = m.senderId === currentUser._id;
          const showOptions = showOptionsId === m._id;

          return (
            <div key={m._id} className={`flex flex-col max-w-[80%] relative ${isMe ? 'self-end' : 'self-start'}`}>
              
              {/* Sender Name if Group */}
              {chat.isGroup && !isMe && (
                <span className="text-[9px] font-bold opacity-75 mb-0.5 ml-1.5">{m.senderName}</span>
              )}

              {/* Reply Quote Display */}
              {m.replyToMessageId && (
                <div className={`text-[10px] p-2 pl-3 rounded-t-xl mb-[-4px] opacity-80 border-l-4 ${
                  isMe ? 'bg-[#8C6A4D]/20 text-slate-700 border-[#8C6A4D]' : 'bg-[#FAECE1]/85 text-slate-600 border-[#A67C52]'
                }`}>
                  <span className="font-semibold block text-[9px]">Replying to:</span>
                  <span className="italic">{m.replyToMessageText || 'Media attachment'}</span>
                </div>
              )}

              {/* Core Message Card */}
              <div
                onClick={() => setShowOptionsId(m._id === showOptionsId ? null : m._id)}
                className={`p-3 rounded-2xl shadow-sm text-sm relative transition-all cursor-pointer ${
                  m.isDeletedForEveryone ? 'italic opacity-60' : ''
                } ${
                  isMe
                    ? 'bg-[#3B2E2B] text-amber-50 rounded-tr-none'
                    : 'bg-white text-slate-800 rounded-tl-none border border-neutral-200'
                }`}
              >
                {/* Media representation */}
                {m.mediaType && (
                  <div className="mb-2">
                    {m.mediaType === 'image' && (
                      <img src={m.mediaUrl} alt="uploaded image" className="w-full max-h-48 rounded-lg object-cover" />
                    )}
                    {m.mediaType === 'video' && (
                      <div className="w-full bg-[#FAECE1]/10 rounded-lg p-2 flex items-center justify-center gap-2">
                        <span className="text-xl">🎬</span>
                        <div className="flex-1 flex flex-col overflow-hidden">
                          <span className="text-xs font-bold truncate">{m.mediaName}</span>
                          <span className="text-[10px] opacity-75">{m.mediaSize}</span>
                        </div>
                      </div>
                    )}
                    {(m.mediaType === 'file' || m.mediaType === 'audio') && (
                      <div className="flex items-center gap-3 bg-neutral-100/10 p-2.5 rounded-lg">
                        {m.mediaType === 'audio' ? <Smile className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        <div className="flex-1 overflow-hidden">
                          <span className="text-xs font-bold block truncate">{m.mediaName}</span>
                          <span className="text-[10px] opacity-75">{m.mediaSize}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Text */}
                <p className="leading-relaxed text-[13px]">{m.text}</p>

                {/* Reactions elements */}
                {m.reactions && m.reactions.length > 0 && (
                  <div className="absolute -bottom-2 right-2 flex gap-0.5 bg-white dark:bg-[#4A3B36] border px-1.5 py-0.5 rounded-full shadow-xs text-[10px] z-10 font-bold">
                    {m.reactions.map((r: any, idx: number) => (
                      <span key={idx} title={r.username}>{r.emoji}</span>
                    ))}
                  </div>
                )}

                {/* Footer specs inside balloon */}
                <div className="flex justify-end items-center gap-1 mt-1 opacity-70 text-[9px] text-right">
                  {m.isEdited && <span>edited</span>}
                  <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && (
                    m.seenBy.length > 1 ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-500 font-bold" />
                    ) : (
                      <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
                    )
                  )}
                </div>
              </div>

              {/* Message Context Options popup */}
              {showOptions && !m.isDeletedForEveryone && (
                <div className={`absolute bottom-full mb-1 z-40 bg-white dark:bg-[#4A3B36] border border-[#8C6A4D]/30 p-1.5 rounded-xl flex gap-1.5 shadow-md ${
                  isMe ? 'right-0' : 'left-0'
                }`}>
                  <button onClick={() => setReplyMessage(m)} className="p-1.5 hover:bg-black/5 rounded-lg text-xs" title="Reply"><Reply className="w-4 h-4"/></button>
                  <button onClick={() => handleReact(m._id, '👍')} className="p-1 hover:bg-black/5 rounded-lg text-sm">👍</button>
                  <button onClick={() => handleReact(m._id, '❤️')} className="p-1 hover:bg-black/5 rounded-lg text-sm">❤️</button>
                  <button onClick={() => handleReact(m._id, '😂')} className="p-1 hover:bg-black/5 rounded-lg text-sm">😂</button>
                  
                  {isMe && (
                    <>
                      <button onClick={() => { setEditingMsg(m); setText(m.text); }} className="p-1.5 hover:bg-black/5 rounded-lg text-xs" title="Edit"><Edit className="w-4 h-4"/></button>
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

      {/* 3. ATTACHMENT BOTTOM SHEET MOCK */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-4 right-4 bg-white dark:bg-[#4A3B36] rounded-2xl shadow-lg border border-[#8C6A4D]/30 p-4 z-40 flex justify-around gap-2">
          <button onClick={() => triggerUploadMock('image')} className="flex flex-col items-center gap-1 text-[#3B2E2B] dark:text-amber-100">
            <span className="w-11 h-11 bg-orange-100 rounded-full flex items-center justify-center"><Image className="w-5 h-5 text-orange-600"/></span>
            <span className="text-[10px] font-bold">Gallery</span>
          </button>
          <button onClick={() => triggerUploadMock('file')} className="flex flex-col items-center gap-1 text-[#3B2E2B] dark:text-amber-100">
            <span className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600"/></span>
            <span className="text-[10px] font-bold">Document</span>
          </button>
          <button onClick={() => triggerUploadMock('audio')} className="flex flex-col items-center gap-1 text-[#3B2E2B] dark:text-amber-100">
            <span className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center"><Smile className="w-5 h-5 text-purple-600"/></span>
            <span className="text-[10px] font-bold">Audio Clip</span>
          </button>
        </div>
      )}

      {/* 4. REPLY QUOTED STICKY BAR */}
      {replyMessage && (
        <div className={`px-4 py-2 border-t flex justify-between items-center ${
          theme === 'dark' ? 'bg-[#332724] border-zinc-700' : 'bg-orange-50 border-orange-100'
        }`}>
          <div className="flex flex-col border-l-4 border-[#3B2E2B] pl-2 overflow-hidden">
            <span className="text-[10px] font-bold">Replying to {replyMessage.senderName}</span>
            <span className="text-xs italic truncate opacity-80">{replyMessage.text || 'Media file'}</span>
          </div>
          <button onClick={() => setReplyMessage(null)} className="p-1 hover:bg-black/5 rounded-full text-xs font-bold">✕</button>
        </div>
      )}

      {/* 5. FOOTER CONTROL MESSAGE INPUT */}
      <div className={`h-16 px-4 py-3 flex items-center gap-2 border-t relative z-30 ${
        theme === 'dark' ? 'bg-[#4A3B36] border-zinc-700' : 'bg-white border-zinc-200'
      }`}>
        <button
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className={`p-2 rounded-full cursor-pointer hover:bg-black/5 transition-colors ${
            showAttachMenu ? 'bg-orange-100/50' : ''
          }`}
        >
          <Paperclip className="w-5 h-5 opacity-75" />
        </button>

        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={e => { setText(e.target.value); handleTyping(e.target.value.length > 0); }}
            placeholder={editingMsg ? "Edit message..." : "Type a message..."}
            className="flex-1 h-10 px-4 rounded-full border border-zinc-200/80 bg-[#FAECE1]/30 text-slate-800 placeholder-slate-400 text-sm outline-none focus:border-[#3B2E2B]"
          />

          <button
            type="submit"
            className="w-10 h-10 rounded-full bg-[#3B2E2B] dark:bg-[#FEEBC5] dark:text-[#3B2E2B] text-amber-100 flex items-center justify-center shadow hover:opacity-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
}

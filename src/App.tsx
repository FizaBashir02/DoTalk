import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame.tsx';
import AuthScreens from './components/AuthScreens.tsx';
import ChatWindow from './components/ChatWindow.tsx';
import ProfileTab from './components/ProfileTab.tsx';
import SettingsTab from './components/SettingsTab.tsx';
import StatusViewer from './components/StatusViewer.tsx';
import { db } from '../server/utils/db';

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
  ShieldAlert
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [themeSetting, setThemeSetting] = useState<'light' | 'dark'>('light');

  // Bottom Navigation tabs: 'chats' | 'groups' | 'profile' | 'settings'
  const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'profile' | 'settings'>('chats');

  // Chats states
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Status Stories States
  const [stories, setStories] = useState<any[]>([]);
  const [activeStoryViewer, setActiveStoryViewer] = useState<any[] | null>(null);

  // Group Create Popover Box States
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupBuddies, setGroupBuddies] = useState<string[]>([]); // selected User IDs
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);

  // Search/Start New 1-to-1 Chat
  const [showContactsSearch, setShowContactsSearch] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState('');
  const [contactsSearchResult, setContactsSearchResult] = useState<any[]>([]);

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
      fetchStories();
      fetchContacts();
    }
  }, [token, activeTab]);

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setChats(data);
      }
    } catch (e) {
      console.error('Failed to load chat history');
    }
  };

  const fetchStories = async () => {
    try {
      const response = await fetch('/api/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setStories(data);
      }
    } catch (e) {
      console.error('Failed to load status stories');
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch(`/api/users/search?query=`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        handleLogout();
        return;
      }
      const data = await response.json();
      if (response.ok) {
        setAvailableContacts(data);
      }
    } catch (e) {
      console.error('Failed to load contact lists');
    }
  };

  const handleSearchContacts = async (q: string) => {
    setContactsSearchQuery(q);
    try {
      const response = await fetch(`/api/users/search?query=${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ partnerId, isGroup: false })
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedChat(data);
        setShowContactsSearch(false);
        setContactsSearchQuery('');
        fetchChats();
      }
    } catch (e) {
      console.error('Failed to start personal chat');
    }
  };

  const handleCreateGroupChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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

  const handlePostStory = async () => {
    // Post random lifestyle story photo with custom quotes
    const randomStatuses = [
      { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600', caption: 'Dreaming of sandy beaches and ocean waves today! 🌊✈️' },
      { url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600', caption: 'Code, Design, Repeat. DoTalk style. 📲💻' },
      { url: 'https://images.unsplash.com/photo-1542241647-9cbb2225278b?w=600', caption: 'Chasing the morning light in style 🌤️🌲' }
    ];

    const pick = randomStatuses[Math.floor(Math.random() * randomStatuses.length)];

    try {
      const response = await fetch('/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mediaUrl: pick.url, caption: pick.caption })
      });
      if (response.ok) {
        fetchStories();
        alert('Your status story has been posted! Lasts for 24h.');
      }
    } catch (e) {
      console.error('Failed to post status update');
    }
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

  const filteredChats = chats.filter(c => {
    if (activeTab === 'groups' && !c.isGroup) return false;
    if (activeTab === 'chats' && c.isGroup) return false;

    return c.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Calculate global totals
  const totalUnreads = chats.reduce((acc, obj) => acc + (obj.unreadCount || 0), 0);

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
        />
      ) : (
        <div className={`w-full h-full flex flex-col justify-between relative select-none ${
          themeSetting === 'dark' ? 'bg-[#3B2E2B] text-amber-50' : 'bg-[#FAECE1] text-[#3B2E2B]'
        }`}>
          
          {/* A. HOME COMPONENT TOP FRAME BAR */}
          <div className={`px-5 pt-4 pb-2.5 flex items-center justify-between border-b ${
            themeSetting === 'dark' ? 'bg-[#4A3B36] border-zinc-700' : 'bg-[#FAECE1] border-orange-200/50'
          }`}>
            <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold tracking-tight">DoTalk</h1>
              <span className="text-[10px] opacity-70 font-semibold tracking-wider uppercase">Active user: {user?.fullName}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowContactsSearch(!showContactsSearch)}
                className="p-1.5 hover:bg-black/5 rounded-full"
                title="Start a Chat"
              >
                <Search className="w-5 h-5 opacity-80" />
              </button>

              <img
                src={user?.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
                onClick={() => setActiveTab('profile')}
                className="w-8 h-8 rounded-full border-2 border-[#3B2E2B] object-cover cursor-pointer"
                title="My Profile"
              />
            </div>
          </div>

          {/* START CHAT DIRECT USER LOOKUP POPUP */}
          {showContactsSearch && (
            <div className={`absolute top-14 inset-x-0 bottom-16 bg-white dark:bg-[#4A3B36] z-40 p-4 border-b flex flex-col gap-4 ${
              themeSetting === 'dark' ? 'text-amber-50 border-zinc-700' : 'text-[#3B2E2B]'
            }`}>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-bold text-sm">New Conversation Partner</span>
                <button onClick={() => { setShowContactsSearch(false); setContactsSearchQuery(''); }} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5"/></button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"/>
                <input
                  type="text"
                  value={contactsSearchQuery}
                  onChange={e => handleSearchContacts(e.target.value)}
                  placeholder="Insert name or username..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-zinc-200 text-sm bg-[#FAECE1]/30 placeholder-slate-400 outline-none text-slate-800"
                />
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                {contactsSearchQuery && contactsSearchResult.length === 0 ? (
                  <p className="text-xs text-center opacity-70 my-6">No users found</p>
                ) : (
                  (contactsSearchQuery ? contactsSearchResult : availableContacts).map((contact) => (
                    <div
                      key={contact._id}
                      onClick={() => startPrivateChat(contact._id)}
                      className="p-2.5 rounded-xl flex items-center gap-3 bg-[#FAECE1]/20 hover:bg-[#FAECE1]/45 transition-colors cursor-pointer"
                    >
                      <img src={contact.profilePhoto} alt={contact.fullName} className="w-9 h-9 rounded-full object-cover border" />
                      <div className="flex flex-col flex-1">
                        <span className="text-xs font-bold">{contact.fullName}</span>
                        <span className="text-[10px] opacity-75">@{contact.username} • {contact.bio}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* B. ACTIVE BODY TAB CONTAINER VIEWPORT */}
          <div className="flex-1 overflow-hidden relative">

            {/* CHATS TAB LIST */}
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
                    className="w-full h-10 pl-10 pr-4 bg-white/70 dark:bg-[#4A3B36]/90 placeholder-slate-400 rounded-xl outline-none text-sm border border-orange-200/40 text-slate-800"
                  />
                </div>

                {/* Main list view */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 scrollbar-thin">
                  {filteredChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center my-16 text-center opacity-60 gap-2">
                      <Compass className="w-10 h-10" />
                      <p className="text-xs font-bold">No active {activeTab === 'chats' ? 'conversations' : 'groups'}</p>
                      <button onClick={() => setShowContactsSearch(true)} className="text-xs font-bold underline hover:opacity-85 text-[#8C6A4D]">Find your first buddy</button>
                    </div>
                  ) : (
                    filteredChats.map((c) => (
                      <div
                        key={c._id}
                        onClick={() => setSelectedChat(c)}
                        className="p-3 bg-white hover:bg-[#FAECE1]/20 dark:bg-[#4A3B36] rounded-2xl flex items-center gap-3.5 border border-orange-200/10 shadow-xs cursor-pointer transition-all duration-200"
                      >
                        <div className="relative">
                          <img src={c.image} alt={c.title} className="w-11 h-11 rounded-full object-cover border border-[#8C6A4D]/10" />
                          {!c.isGroup && c.partner?.onlineStatus === 'online' && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#4CAF50] rounded-full border-2 border-white" />
                          )}
                        </div>

                        <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold truncate tracking-tight">{c.title}</span>
                            <span className="text-[9px] opacity-70">
                              {new Date(c.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-[11px] opacity-80 truncate pr-4">{c.lastMessageText}</p>
                            {c.unreadCount > 0 && (
                              <span className="h-5 min-w-5 px-1.5 rounded-full bg-[#3B2E2B] dark:bg-[#FEEBC5] dark:text-[#3B2E2B] text-amber-100 flex items-center justify-center text-[9px] font-extrabold shadow">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* FAB (Floating Action Button) for creating groups/private chats */}
                <button
                  onClick={() => activeTab === 'groups' ? setShowCreateGroup(true) : setShowContactsSearch(true)}
                  className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-[#3B2E2B] dark:bg-[#FEEBC5] dark:text-[#3B2E2B] text-[#FEEBC5] flex items-center justify-center shadow-lg hover:scale-105 cursor-pointer z-20"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* CREATE GROUP DIALOG DISPLAY */}
            {showCreateGroup && (
              <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className={`p-6 rounded-3xl w-full max-w-sm shadow-xl flex flex-col gap-4 max-h-[90%] overflow-y-auto relative ${
                  themeSetting === 'dark' ? 'bg-[#4A3B36] text-amber-50' : 'bg-white text-[#3B2E2B]'
                }`}>
                  <div className="flex justify-between items-center border-b pb-1.5">
                    <span className="font-extrabold text-sm">Create New Group</span>
                    <button onClick={() => setShowCreateGroup(false)} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5"/></button>
                  </div>

                  <form onSubmit={handleCreateGroupChat} className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Group Name (e.g. Design Studio)"
                      value={groupName}
                      maxLength={40}
                      required
                      onChange={e => setGroupName(e.target.value)}
                      className="w-full h-10 px-3 bg-zinc-100 dark:bg-zinc-800/20 border rounded-lg text-sm outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Description (e.g. Collaborators only)"
                      value={groupDesc}
                      maxLength={120}
                      onChange={e => setGroupDesc(e.target.value)}
                      className="w-full h-10 px-3 bg-zinc-100 dark:bg-zinc-800/20 border rounded-lg text-sm outline-none"
                    />

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Select Members</span>
                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                        {availableContacts.map(c => (
                          <div
                            key={c._id}
                            onClick={() => toggleBuddySelection(c._id)}
                            className={`p-2 rounded-xl flex items-center gap-2.5 cursor-pointer border ${
                              groupBuddies.includes(c._id) ? 'bg-orange-100/50 border-[#8C6A4D]' : 'bg-transparent border-transparent'
                            }`}
                          >
                            <img src={c.profilePhoto} alt={c.fullName} className="w-8 h-8 rounded-full object-cover" />
                            <span className="text-xs font-bold flex-1">{c.fullName}</span>
                            <input
                              type="checkbox"
                              checked={groupBuddies.includes(c._id)}
                              onChange={() => {}} // Controlled by row toggler
                              className="accent-[#3B2E2B]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-10 mt-2 bg-[#3B2E2B] dark:bg-[#FEEBC5] dark:text-[#3B2E2B] text-amber-50 rounded-xl font-bold text-xs shadow focus:outline-none"
                    >
                      Construct Group Room
                    </button>
                  </form>
                </div>
              </div>
            )}



            {/* PROFILE TAB */}
            {activeTab === 'profile' && (
              <ProfileTab
                user={user}
                onUpdateUser={(updated) => { setUser(updated); localStorage.setItem('dotalk_user', JSON.stringify(updated)); }}
                theme={themeSetting}
              />
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <SettingsTab
                theme={themeSetting}
                onChangeTheme={(theme) => setThemeSetting(theme)}
                onLogout={handleLogout}
              />
            )}

          </div>

          {/* C. BOTTOM PHONE FRAME NAVIGATION BAR */}
          <div className={`h-16 px-4 flex items-center justify-around border-t relative z-30 shadow-md ${
            themeSetting === 'dark' ? 'bg-[#4A3B36] border-zinc-700' : 'bg-white border-zinc-200'
          }`}>
            <button
              onClick={() => setActiveTab('chats')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'chats' ? 'scale-110 text-slate-900 dark:text-[#FEEBC5] font-bold' : 'opacity-60 text-slate-500'
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
                activeTab === 'groups' ? 'scale-110 text-slate-900 dark:text-[#FEEBC5] font-bold' : 'opacity-60 text-slate-500'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[9px]">Groups</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'profile' ? 'scale-110 text-slate-900 dark:text-[#FEEBC5] font-bold' : 'opacity-60 text-slate-500'
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[9px]">Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-transform duration-100 ${
                activeTab === 'settings' ? 'scale-110 text-slate-900 dark:text-[#FEEBC5] font-bold' : 'opacity-60 text-slate-500'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[9px]">Settings</span>
            </button>
          </div>

          {/* D. IMMERSIVE STORIES MODAL ACTIVE VIEWPORTS */}
          {activeStoryViewer && (
            <StatusViewer
              stories={activeStoryViewer}
              onClose={() => setActiveStoryViewer(null)}
              theme={themeSetting}
            />
          )}

        </div>
      )}
    </PhoneFrame>
  );
}

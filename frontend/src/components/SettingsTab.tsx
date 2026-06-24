import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  Shield, 
  Bell, 
  HardDrive, 
  HelpCircle, 
  LogOut, 
  ChevronRight, 
  X, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Mail, 
  AlertTriangle, 
  Check, 
  FileText, 
  Info,
  ExternalLink,
  Search,
  User,
  Camera,
  AtSign,
  AlignLeft,
  MessageSquare,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../utils/api.js';
import ProfileTab from './ProfileTab.jsx';
import { DebugPage } from './DebugPage';

interface SettingsTabProps {
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onLogout: () => void;
  user: any;
  onUpdateUser: (updatedUser: any) => void;
  onStartPrivateChat: (partnerId: string) => void;
}

export default function SettingsTab({ theme, onChangeTheme, onLogout, user, onUpdateUser, onStartPrivateChat }: SettingsTabProps) {
  const [settingsSubView, setSettingsSubView] = useState<'main' | 'profile' | 'debug'>('main');
  const [privateReadReceipts, setPrivateReadReceipts] = useState(true);

  // Blocked users states
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [errorBlocked, setErrorBlocked] = useState('');
  const [successBlocked, setSuccessBlocked] = useState('');
  const [blockedSearchQuery, setBlockedSearchQuery] = useState('');
  const [unblockConfirmUser, setUnblockConfirmUser] = useState<any | null>(null);

  const fetchBlockedUsers = async () => {
    setShowBlockedModal(true);
    setLoadingBlocked(true);
    setErrorBlocked('');
    try {
      const res = await apiFetch('/api/users/blocked');
      if (res.ok) {
        const data = await res.json();
        setBlockedUsers(data);
      } else {
        setErrorBlocked('Failed to retrieve blocked list');
      }
    } catch (err) {
      setErrorBlocked('Error establishing connection');
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleUnblockUser = async (blockedUserId: string) => {
    setErrorBlocked('');
    setSuccessBlocked('');
    try {
      const res = await apiFetch('/api/users/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIdToUnblock: blockedUserId })
      });
      if (res.ok) {
        setBlockedUsers(prev => prev.filter(u => u._id !== blockedUserId));
        setSuccessBlocked('Contact unblocked successfully!');
        setTimeout(() => setSuccessBlocked(''), 3000);
        const localUserStr = localStorage.getItem('dotalk_user');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          localUser.blockedUsers = (localUser.blockedUsers || []).filter((id: string) => id !== blockedUserId);
          localStorage.setItem('dotalk_user', JSON.stringify(localUser));
        }
      } else {
        setErrorBlocked('Unblock request failed');
      }
    } catch (err) {
      setErrorBlocked('Connection error while unblocking');
    }
  };

  // Storage states
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [storageStats, setStorageStats] = useState({
    images: 5320, // in KB
    videos: 7480, // in KB
    docs: 1740,   // in KB
  });
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState('');
  const [clearError, setClearError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<'all' | 'images' | 'videos' | 'docs' | null>(null);

  // User Profile states within Settings
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFullName, setProfileFullName] = useState(user?.fullName || '');
  const [profileUsername, setProfileUsername] = useState(user?.username || '');
  const [profileBio, setProfileBio] = useState(user?.bio || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState('');
  const [profileUpdateError, setProfileUpdateError] = useState('');

  // Contacts States
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsQuery, setContactsQuery] = useState('');

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setProfileFullName(user.fullName || '');
      setProfileUsername(user.username || '');
      setProfileBio(user.bio || '');
      setProfilePhoto(user.profilePhoto || '');
    }
  }, [user]);

  // Help center states
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [supportFeedback, setSupportFeedback] = useState('');

  // Version Info
  const appVersion = "2.4.1 (Stable)";

  // Load storage states from localStorage to maintain absolute durability across tests/reloads
  useEffect(() => {
    const imgCache = localStorage.getItem('dotalk_cache_images');
    const vidCache = localStorage.getItem('dotalk_cache_videos');
    const docCache = localStorage.getItem('dotalk_cache_docs');

    setStorageStats({
      images: imgCache !== null ? parseInt(imgCache, 10) : 5320,
      videos: vidCache !== null ? parseInt(vidCache, 10) : 7480,
      docs: docCache !== null ? parseInt(docCache, 10) : 1740,
    });
  }, []);

  // Compute total in MB helper
  const totalKB = storageStats.images + storageStats.videos + storageStats.docs;
  const totalMB = (totalKB / 1024).toFixed(1);

  // Percent calculation for the progress bar
  const maxCapacityKB = 20000; // 20 MB ceiling for progress visualization
  const percentUsed = Math.min((totalKB / maxCapacityKB) * 100, 100);

  // Clear categories
  const triggerClear = async (category: 'all' | 'images' | 'videos' | 'docs') => {
    setIsClearing(true);
    setClearSuccess('');
    setClearError('');

    try {
      // Small visual delay to simulate scanning files on storage
      await new Promise(resolve => setTimeout(resolve, 800));

      if (category === 'all') {
        localStorage.setItem('dotalk_cache_images', '0');
        localStorage.setItem('dotalk_cache_videos', '0');
        localStorage.setItem('dotalk_cache_docs', '0');
        setStorageStats({ images: 0, videos: 0, docs: 0 });
        setClearSuccess('Entire client cache was successfully cleared!');
      } else {
        localStorage.setItem(`dotalk_cache_${category}`, '0');
        setStorageStats(prev => {
          const next = { ...prev, [category]: 0 };
          return next;
        });
        setClearSuccess(`${category.charAt(0).toUpperCase() + category.slice(1)} cache successfully cleared!`);
      }

      setTimeout(() => {
        setClearSuccess('');
      }, 2000);
    } catch (err) {
      setClearError('Access boundary restriction: Failed to clear storage directories.');
    } finally {
      setIsClearing(false);
      setShowConfirmDialog(null);
    }
  };

  // Prefilled email builder
  const handleContactSupport = (type: 'support' | 'bug') => {
    try {
      const subject = type === 'support' ? "Dotalk Support Request" : "Dotalk Bug Report";
      const browserInfo = navigator.userAgent;
      
      const body = `Hey DoTalk Support Team,

[Tell us what you need help with or describe the bug here]

----------------------------
System Diagnostic Logs:
App Version: ${appVersion}
Environment Protocol: ${window.location.protocol}
Platform Agent: ${browserInfo}
Device: Web Preview Sandbox Engine
----------------------------`;

      const mailtoUrl = `mailto:client@dotalk.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // Perform navigation
      window.location.href = mailtoUrl;
      setSupportFeedback('Mail client request triggered.');
      setTimeout(() => setSupportFeedback(''), 3000);
    } catch (err) {
      setSupportFeedback('Could not launch device mail app. Please write to client@dotalk.app.');
    }
  };

  const handleSaveProfileInSettings = async () => {
    setIsUpdatingProfile(true);
    setProfileUpdateSuccess('');
    setProfileUpdateError('');

    if (profileFullName.trim().length === 0) {
      setProfileUpdateError('Full name cannot be empty');
      setIsUpdatingProfile(false);
      return;
    }
    if (profileFullName.length > 50) {
      setProfileUpdateError('Full name must be under 50 characters');
      setIsUpdatingProfile(false);
      return;
    }
    if (profileBio.length > 150) {
      setProfileUpdateError('Bio must be under 150 characters');
      setIsUpdatingProfile(false);
      return;
    }

    try {
      // 1. Update Username if changed
      if (profileUsername !== user?.username) {
        const usernameResponse = await apiFetch('/api/profile/username', {
          method: 'PUT',
          body: JSON.stringify({ username: profileUsername })
        });
        const usernameData = await usernameResponse.json();
        if (!usernameResponse.ok) {
          setProfileUpdateError(usernameData.error || 'Username already in use');
          setIsUpdatingProfile(false);
          return;
        }
        onUpdateUser(usernameData.user);
      }

      // 2. Update other details (fullName, bio, profilePhoto)
      const detailsResponse = await apiFetch('/api/profile/update', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: profileFullName,
          bio: profileBio,
          profilePhoto: profilePhoto
        })
      });
      const detailsData = await detailsResponse.json();
      if (!detailsResponse.ok) {
        setProfileUpdateError(detailsData.error || 'Failed to update profile details');
        setIsUpdatingProfile(false);
        return;
      }

      onUpdateUser(detailsData.user);
      setProfileUpdateSuccess('Profile updated successfully!');
      setTimeout(() => setProfileUpdateSuccess(''), 3500);
    } catch (err: any) {
      setProfileUpdateError('Failed to save details: ' + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const fetchContactsInSettings = async (searchQuery = '') => {
    setLoadingContacts(true);
    try {
      const res = await apiFetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setContactsList(data);
      } else {
        console.error('Failed to load contacts');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const faqs = [
    {
      q: "How do I change my Dark / Light mode?",
      a: "DoTalk provides an elegant appearance toggle. Simply flip the \"Active Dark Theme\" switch inside the top panel of this Settings screen."
    },
    {
      q: "How does the self-expiring Status work?",
      a: "Post beautiful instant photos or message stories under your Status Tab. They are visible to your contacts and expire completely automatically after 24 hours."
    },
    {
      q: "Can I manage admin rights in groups?",
      a: "Yes! If you are the creator or an existing admin of any channel group, you can long-tap or click any member to promote them to admin status or demote them back."
    },
    {
      q: "Are messaging verification codes secure?",
      a: "DoTalk uses cryptographically secure random number generators on our Node backend to ensure OTP logs are fully secure, expiring after 5 minutes."
    }
  ];

  if (settingsSubView === 'profile') {
    return (
      <ProfileTab
        user={user}
        onUpdateUser={onUpdateUser}
        theme={theme}
        onBack={() => setSettingsSubView('main')}
      />
    );
  }

  if (settingsSubView === 'debug') {
    return (
      <DebugPage
        isDarkMode={theme === 'dark'}
        onBack={() => setSettingsSubView('main')}
      />
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-5 py-4 flex flex-col gap-5 scrollbar-none relative bg-app-bg text-app-text-primary transition-colors duration-300">
      
      {/* 0. USER PROFILE QUICK VIEW & SETTINGS CARD */}
      {user && (
        <div 
          onClick={() => {
            setSettingsSubView('profile');
          }}
          className="flex items-center gap-4 bg-app-card p-4 rounded-2xl border border-app-border hover:border-app-btn-bg/40 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] shadow-sm hover:shadow-md group"
        >
          <div className="relative">
            <img 
              src={user.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} 
              alt={user.fullName} 
              className="w-14 h-14 rounded-full object-cover border border-app-border group-hover:scale-105 transition-transform" 
            />
            <div className="absolute -bottom-1 -right-1 bg-app-btn-bg text-[#3B2E2B] p-1 rounded-full border border-app-card shadow-sm">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold">Your Profile</span>
            </div>
            <h3 className="font-extrabold text-base tracking-tight text-app-text-primary group-hover:text-app-btn-bg transition-colors truncate mt-1">{user.fullName}</h3>
            <p className="text-xs text-app-text-secondary truncate">@{user.username}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-app-text-secondary/50 group-hover:text-app-text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      )}

      {/* 1. THEME TOGGLE CONTROL */}
      <div className="flex flex-col gap-1.5 bg-app-card p-4 rounded-2xl border border-app-border shadow-xs transition-colors duration-300">
        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-app-text-secondary">
          {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-app-text-primary"/> : <Sun className="w-3.5 h-3.5 text-app-text-primary"/>} Appearance Mode
        </span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm font-semibold text-app-text-primary">Active Dark Theme</span>
          <button
            onClick={() => onChangeTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer outline-none ${
              theme === 'dark' ? 'bg-app-btn-bg' : 'bg-stone-300/80'
            }`}
            aria-label="Toggle Dark Theme"
          >
            <div className={`w-5 h-5 rounded-full bg-app-card shadow-sm transition-transform ${
              theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* 2. ACCORDION LIST CONTROLS */}
      <div className="flex flex-col gap-4">
        
        {/* PRIVACY */}
        <div className="flex flex-col gap-2.5 bg-app-card p-4 rounded-2xl border border-app-border shadow-xs transition-colors duration-300">
          <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-app-text-secondary">
            <Shield className="w-3.5 h-3.5 text-app-text-secondary"/> Account Privacy
          </span>

          <div className="flex justify-between items-center mt-1 border-b border-app-border pb-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-app-text-primary">Read Receipts Seen Ticks</span>
              <span className="text-[9px] text-app-text-secondary">Allow others to view seen ticks</span>
            </div>
            <input
              type="checkbox"
              checked={privateReadReceipts}
              onChange={e => setPrivateReadReceipts(e.target.checked)}
              className="w-4 h-4 rounded accent-app-btn-bg cursor-pointer outline-none"
            />
          </div>

          <div 
            onClick={fetchBlockedUsers}
            className="flex justify-between items-center mt-1.5 cursor-pointer hover:opacity-80 active:scale-[0.99] transition-all"
          >
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-app-text-primary">Blocked Users</span>
              <span className="text-[9px] text-app-text-secondary">Manage and unblock user contacts</span>
            </div>
            <ChevronRight className="w-4 h-4 text-app-text-secondary/65" />
          </div>
        </div>

        {/* INTERACTIVE STORAGE USAGE CARD */}
        <div 
          onClick={() => setShowStorageModal(true)}
          className="flex flex-col gap-3 bg-app-card p-4 rounded-2xl border border-app-border hover:border-app-btn-bg/40 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] shadow-xs hover:shadow-md group"
        >
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-app-text-secondary">
              <HardDrive className="w-3.5 h-3.5 text-app-text-secondary" /> Storage Usage
            </span>
            <ChevronRight className="w-4 h-4 text-app-text-secondary/50 group-hover:text-app-text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          
          <div className="flex justify-between items-center text-xs mt-0.5">
            <div className="flex flex-col">
              <span className="font-semibold text-app-text-primary">Local Upload cache size</span>
              <span className="text-[9px] text-app-text-secondary">Tap to configure & clear spaces</span>
            </div>
            <span className="font-bold text-sm text-app-text-primary">{totalMB} MB</span>
          </div>

          <div className="w-full bg-stone-200/50 dark:bg-stone-800/50 h-1.5 rounded-full overflow-hidden mt-1">
            <div 
              style={{ width: `${percentUsed}%` }}
              className="h-full bg-app-btn-bg transition-all duration-500"
            />
          </div>
        </div>

        {/* INTERACTIVE SYSTEM CONTACTS DIRECTORY */}
        <div 
          onClick={() => {
            setContactsQuery('');
            fetchContactsInSettings('');
            setShowContactsModal(true);
          }}
          className="flex items-center gap-3 bg-app-card p-4 rounded-2xl border border-app-border hover:border-app-btn-bg/40 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] shadow-xs hover:shadow-md group"
        >
          <User className="w-4 h-4 text-app-text-secondary group-hover:scale-105 transition-transform" />
          <div className="flex-1">
            <span className="font-bold block text-sm text-app-text-primary">System Contacts Directory</span>
            <span className="text-app-text-secondary text-[10px]">Lookup partners, inspect bios, and initiate chats</span>
          </div>
          <ChevronRight className="w-4 h-4 text-app-text-secondary/50 group-hover:text-app-text-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* INTERACTIVE CONTACT GUIDE HELP SUPPORT CARD */}
        <div 
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-3 bg-app-card p-4 rounded-2xl border border-app-border hover:border-app-btn-bg/40 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] shadow-xs hover:shadow-md group"
        >
          <HelpCircle className="w-4 h-4 text-app-text-secondary group-hover:scale-105 transition-transform" />
          <div className="flex-1">
            <span className="font-bold block text-sm text-app-text-primary">Help & Support guide</span>
            <span className="text-app-text-secondary text-[10px]">FAQs, terms, bug reports & contact logs</span>
          </div>
          <ChevronRight className="w-4 h-4 text-app-text-secondary/50 group-hover:text-app-text-primary group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* INTERACTIVE DEBUG & CONNECTIVITY DIAGNOSTICS CARD */}
        <div 
          onClick={() => setSettingsSubView('debug')}
          className="flex items-center gap-3 bg-app-card p-4 rounded-2xl border border-app-border hover:border-app-btn-bg/40 transition-all duration-200 cursor-pointer select-none active:scale-[0.98] shadow-xs hover:shadow-md group"
        >
          <Activity className="w-4 h-4 text-amber-500 group-hover:scale-105 transition-transform animate-pulse" />
          <div className="flex-1">
            <span className="font-bold block text-sm text-app-text-primary">Debug & Diagnostics</span>
            <span className="text-app-text-secondary text-[10px]">Real-time API probes, health status & Socket.IO telemetry</span>
          </div>
          <ChevronRight className="w-4 h-4 text-app-text-secondary/50 group-hover:text-app-text-primary group-hover:translate-x-0.5 transition-all" />
        </div>

      </div>

      {/* 4. LOGOUT SYSTEM */}
      <button
        onClick={onLogout}
        className="w-full h-11 bg-red-500 hover:bg-red-650 dark:bg-red-650 dark:hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-4 cursor-pointer shadow-sm hover:shadow-md active:scale-95 transition-all outline-none"
      >
        <LogOut className="w-4 h-4"/> Sign Out of DoTalk
      </button>


      {/* ==================== PROFILE MODAL VIEW ==================== */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm rounded-[24px] p-5 shadow-2xl border bg-app-card border-app-border text-app-text-primary transition-colors max-h-[90vh] overflow-y-auto scrollbar-none duration-300"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-app-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-app-text-primary" />
                  <h3 className="text-base font-extrabold tracking-tight text-app-text-primary">Customize Your Profile</h3>
                </div>
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="p-1 hover:bg-[#3B2E2B]/10 dark:hover:bg-[#FEEBC5]/10 rounded-full cursor-pointer transition-colors outline-none"
                >
                  <X className="w-5 h-5 text-app-text-primary" />
                </button>
              </div>

              {/* Success/Error displays */}
              {profileUpdateSuccess && (
                <div className="p-2.5 mb-4 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl flex items-center gap-1.5 font-bold">
                  <Check className="w-4 h-4" /> {profileUpdateSuccess}
                </div>
              )}
              {profileUpdateError && (
                <div className="p-2.5 mb-4 text-xs bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4" /> {profileUpdateError}
                </div>
              )}

              {/* Photo selector area */}
              <div className="flex flex-col items-center gap-3 mb-5">
                <img 
                  src={profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=default`} 
                  alt="Avatar mockup" 
                  className="w-20 h-20 rounded-full object-cover border-2 border-app-btn-bg shadow-md"
                />
                
                <span className="text-[10px] font-bold text-app-text-secondary uppercase tracking-wider">Select Avatar Preset</span>
                
                {/* 8 Avatar presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    'Felix', 'Aria', 'Aneka', 'George', 
                    'Fiza', 'Charlie', 'Milo', 'Ruby'
                  ].map((seed) => {
                    const presetUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => setProfilePhoto(presetUrl)}
                        className={`p-0.5 rounded-full border-2 transition-all hover:scale-115 cursor-pointer ${
                          profilePhoto === presetUrl ? 'border-app-btn-bg scale-110' : 'border-transparent'
                        }`}
                      >
                        <img src={presetUrl} alt={seed} className="w-9 h-9 rounded-full bg-stone-105" />
                      </button>
                    );
                  })}
                </div>

                {/* Custom Photo URL Input */}
                <div className="w-full mt-2">
                  <label className="text-[10px] font-semibold text-app-text-secondary block mb-1">Or paste custom image URL</label>
                  <input 
                    type="url"
                    value={profilePhoto}
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="w-full h-8 px-2.5 rounded-lg border border-app-border text-xs bg-stone-50 dark:bg-stone-900 outline-none text-app-text-primary focus:ring-1 focus:ring-app-btn-bg/50"
                  />
                </div>
              </div>

              {/* Form Input fields */}
              <div className="flex flex-col gap-3.5 mb-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary block mb-1.5 flex items-center gap-1">
                    <User className="w-3 h-3" /> Full Name
                  </label>
                  <input 
                    type="text"
                    value={profileFullName}
                    onChange={(e) => setProfileFullName(e.target.value)}
                    maxLength={50}
                    placeholder="e.g. John Doe"
                    className="w-full h-10 px-3 rounded-xl border border-app-border text-xs bg-stone-50 dark:bg-stone-900 outline-none font-medium text-app-text-primary focus:ring-1 focus:ring-app-btn-bg/50"
                  />
                  <span className="text-[9px] text-app-text-secondary/70 text-right block mt-1">{profileFullName.length}/50 characters</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary block mb-1.5 flex items-center gap-1">
                    <AtSign className="w-3 h-3" /> Handle / Username
                  </label>
                  <input 
                    type="text"
                    value={profileUsername}
                    onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="john_doe"
                    className="w-full h-10 px-3 rounded-xl border border-app-border text-xs bg-stone-50 dark:bg-stone-900 outline-none font-mono text-app-text-primary focus:ring-1 focus:ring-app-btn-bg/50"
                  />
                  <p className="text-[9px] text-app-text-secondary/70 mt-1">Only lowercase letters, numbers & underscores allowed</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary block mb-1.5 flex items-center gap-1">
                    <AlignLeft className="w-3 h-3" /> Bio Note
                  </label>
                  <textarea 
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    maxLength={150}
                    placeholder="Tell us about yourself..."
                    className="w-full min-h-16 p-2 rounded-xl border border-app-border text-xs bg-stone-50 dark:bg-stone-900 outline-none text-app-text-primary focus:ring-1 focus:ring-app-btn-bg/50 scrollbar-none resize-none"
                  />
                  <span className="text-[9px] text-app-text-secondary/70 text-right block mt-1">{profileBio.length}/150 characters</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2 text-xs font-semibold border border-app-border rounded-xl text-app-text-primary hover:bg-[#3B2E2B]/5 dark:hover:bg-[#FEEBC5]/5 transition-colors cursor-pointer outline-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfileInSettings}
                  disabled={isUpdatingProfile}
                  className="flex-1 py-2 text-xs font-black text-[#3B2E2B] bg-app-btn-bg rounded-xl transition-all cursor-pointer font-bold select-none outline-none hover:opacity-90 active:scale-95 disabled:scale-100 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isUpdatingProfile ? 'Saving...' : 'Sync Changes'}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== SYSTEM CONTACTS MODAL VIEW ==================== */}
      <AnimatePresence>
        {showContactsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm rounded-[24px] p-5 shadow-2xl border bg-app-card border-app-border text-app-text-primary transition-colors max-h-[85vh] flex flex-col duration-300"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-app-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-app-text-primary" />
                  <h3 className="text-base font-extrabold tracking-tight text-app-text-primary">System Directory</h3>
                </div>
                <button 
                  onClick={() => setShowContactsModal(false)}
                  className="p-1 hover:bg-[#3B2E2B]/10 dark:hover:bg-[#FEEBC5]/10 rounded-full cursor-pointer transition-colors outline-none"
                >
                  <X className="w-5 h-5 text-app-text-primary" />
                </button>
              </div>

              {/* Dynamic Live Filter */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50"/>
                <input
                  type="text"
                  value={contactsQuery}
                  onChange={(e) => {
                    setContactsQuery(e.target.value);
                    fetchContactsInSettings(e.target.value);
                  }}
                  placeholder="Insert name, username or email..."
                  className="w-full h-10 pl-9 pr-4 rounded-xl border border-app-border text-xs bg-stone-50 dark:bg-stone-900 placeholder-slate-400 outline-none text-app-text-primary focus:ring-1 focus:ring-app-btn-bg/50"
                />
              </div>

              {/* Body contacts list */}
              <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2 scrollbar-none mb-4">
                {loadingContacts ? (
                  <div className="py-12 flex flex-col items-center justify-center text-xs text-app-text-secondary gap-2">
                    <div className="w-6 h-6 border-2 border-app-btn-bg border-t-transparent rounded-full animate-spin" />
                    <span>Searching DoTalk database...</span>
                  </div>
                ) : contactsList.length === 0 ? (
                  <div className="py-12 text-center">
                    <Info className="w-6 h-6 mx-auto mb-2 opacity-30 text-app-text-secondary" />
                    <p className="text-xs text-app-text-secondary">No matching contacts verified</p>
                  </div>
                ) : (
                  contactsList.map((contact) => (
                    <div
                      key={contact._id}
                      onClick={() => {
                        onStartPrivateChat(contact._id);
                        setShowContactsModal(false);
                      }}
                      className="p-2.5 rounded-2xl flex items-center gap-3 bg-stone-50 dark:bg-stone-900/10 hover:bg-stone-100 dark:hover:bg-amber-950/20 active:scale-[0.98] border border-app-border transition-all cursor-pointer group"
                    >
                      <img 
                        src={contact.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${contact.username}`} 
                        alt={contact.fullName} 
                        className="w-10 h-10 rounded-full object-cover border border-app-border" 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-extrabold text-app-text-primary group-hover:text-app-btn-bg transition-colors truncate block">{contact.fullName}</span>
                          {contact.onlineStatus === 'online' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 ml-1" title="Online" />
                          )}
                        </div>
                        <span className="text-[10px] text-app-text-secondary block">@{contact.username}</span>
                        {contact.bio && (
                          <span className="text-[9px] text-app-text-secondary/80 truncate block mt-0.5">"{contact.bio}"</span>
                        )}
                      </div>
                      <button type="button" className="px-2.5 py-1 bg-app-btn-bg text-[#3B2E2B] text-[10px] font-black rounded-lg group-hover:scale-105 transition-transform shrink-0 shadow-xs cursor-pointer">
                        Chat
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom footer button */}
              <button
                type="button"
                onClick={() => setShowContactsModal(false)}
                className="w-full py-2.5 text-xs font-bold bg-[#3B2E2B]/5 dark:bg-[#FEEBC5]/5 dark:hover:bg-[#FEEBC5]/10 hover:bg-[#3B2E2B]/10 rounded-xl text-app-text-primary transition-all cursor-pointer outline-none"
              >
                Close Directory
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ==================== STORAGE MODAL VIEW ==================== */}
      <AnimatePresence>
        {showStorageModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm rounded-3xl p-5 shadow-2xl border bg-app-card border-app-border text-app-text-primary transition-colors duration-300"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-app-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-app-text-primary" />
                  <h3 className="text-base font-extrabold tracking-tight text-app-text-primary">Storage Management</h3>
                </div>
                <button 
                  onClick={() => {
                    if (!isClearing) setShowStorageModal(false);
                  }}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full cursor-pointer transition-colors outline-none"
                >
                  <X className="w-5 h-5 text-app-text-primary" />
                </button>
              </div>

              {/* Status notifications */}
              {clearSuccess && (
                <div className="p-2.5 mb-3 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl flex items-center gap-1.5 font-bold animate-pulse">
                  <Check className="w-4 h-4" /> {clearSuccess}
                </div>
              )}
              {clearError && (
                <div className="p-2.5 mb-3 text-xs bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4" /> {clearError}
                </div>
              )}

              {/* Total display */}
              <div className="bg-stone-50 dark:bg-stone-900/50 p-4 rounded-2xl mb-4 text-center border border-app-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Total Space Occupied</span>
                <p className="text-3xl font-extrabold mt-1 text-app-text-primary">{totalMB} MB</p>
                <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full overflow-hidden mt-3">
                  <div 
                    style={{ width: `${percentUsed}%` }}
                    className="h-full bg-app-btn-bg"
                  />
                </div>
              </div>

              {/* Categories detail lists */}
              <div className="flex flex-col gap-2.5 mb-5">
                
                {/* Images */}
                <div className="flex justify-between items-center bg-stone-50 dark:bg-stone-900/30 p-2.5 rounded-xl text-xs border border-app-border">
                  <div className="flex flex-col">
                    <span className="font-bold text-app-text-primary">Image Cache Assets</span>
                    <span className="text-[10px] text-app-text-secondary">{(storageStats.images / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-app-text-primary">{storageStats.images} KB</span>
                    {storageStats.images > 0 && (
                      <button 
                        onClick={() => setShowConfirmDialog('images')}
                        disabled={isClearing}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg cursor-pointer transition-colors outline-none"
                        title="Clear Images only"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Videos */}
                <div className="flex justify-between items-center bg-stone-50 dark:bg-stone-900/30 p-2.5 rounded-xl text-xs border border-app-border">
                  <div className="flex flex-col">
                    <span className="font-bold text-app-text-primary">Video Assets & Playbacks</span>
                    <span className="text-[10px] text-app-text-secondary">{(storageStats.videos / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-app-text-primary">{storageStats.videos} KB</span>
                    {storageStats.videos > 0 && (
                      <button 
                        onClick={() => setShowConfirmDialog('videos')}
                        disabled={isClearing}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg cursor-pointer transition-colors outline-none"
                        title="Clear Videos only"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Documents */}
                <div className="flex justify-between items-center bg-stone-50 dark:bg-stone-900/30 p-2.5 rounded-xl text-xs border border-app-border">
                  <div className="flex flex-col">
                    <span className="font-bold text-app-text-primary">Documents & PDF Shares</span>
                    <span className="text-[10px] text-app-text-secondary">{(storageStats.docs / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-app-text-primary">{storageStats.docs} KB</span>
                    {storageStats.docs > 0 && (
                      <button 
                        onClick={() => setShowConfirmDialog('docs')}
                        disabled={isClearing}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg cursor-pointer transition-colors outline-none"
                        title="Clear Documents only"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowStorageModal(false)}
                  disabled={isClearing}
                  className="flex-1 py-1.5 border border-app-border text-app-text-primary hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-xs font-bold cursor-pointer transition-colors outline-none"
                >
                  Go Back
                </button>
                {totalKB > 0 && (
                  <button
                    onClick={() => setShowConfirmDialog('all')}
                    disabled={isClearing}
                    className="flex-[1.5] py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer outline-none"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isClearing ? 'Clearing...' : 'Clear All Cache'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* CONFIRMATION STORAGE OVERLAY DIALOG */}
      <AnimatePresence>
        {showConfirmDialog !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-5 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-xs rounded-2xl p-5 text-center shadow-2xl border bg-app-card border-app-border text-app-text-primary transition-colors duration-300"
            >
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h4 className="text-sm font-extrabold mb-1.5 text-app-text-primary">Confirm Free Up Space</h4>
              <p className="text-xs text-app-text-secondary leading-relaxed mb-4">
                Are you absolutely sure you want to clean the {showConfirmDialog === 'all' ? 'entire' : showConfirmDialog} cached files directory? This change cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmDialog(null)}
                  className="flex-1 py-1.5 border border-app-border text-app-text-primary hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-xs font-bold cursor-pointer outline-none"
                >
                  Cancel
                </button>
                <button
                  onClick={() => triggerClear(showConfirmDialog)}
                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-650 text-white rounded-lg text-xs font-bold cursor-pointer outline-none"
                >
                  Clear Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ==================== HELP GUIDE CENTER MODAL ==================== */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.96, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 15 }}
              className="w-full max-w-sm rounded-3xl p-5 shadow-2xl border flex flex-col max-h-[85vh] bg-app-card border-app-border text-app-text-primary transition-colors duration-300"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-app-border pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-5 h-5 text-app-text-primary" />
                  <h3 className="text-base font-extrabold tracking-tight text-app-text-primary">Help & Support Center</h3>
                </div>
                <button 
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full cursor-pointer transition-colors outline-none"
                >
                  <X className="w-5 h-5 text-app-text-primary" />
                </button>
              </div>

              {/* Version & Device diagnostic badges */}
              <div className="flex justify-between items-center text-[10px] bg-stone-50 dark:bg-stone-900/40 px-3 py-1.5 rounded-lg border border-app-border mb-3 shrink-0">
                <span className="font-semibold text-app-text-secondary">DoTalk Application Version</span>
                <span className="font-bold bg-app-btn-bg text-app-btn-text px-2 py-0.5 rounded-md">{appVersion}</span>
              </div>

              {supportFeedback && (
                <span className="text-[10px] font-bold text-center mb-2 px-2 py-1 bg-amber-500/10 text-amber-650 dark:text-amber-200 border border-amber-500/20 rounded-lg block">
                  {supportFeedback}
                </span>
              )}

              {/* Scrollable contents wrapper */}
              <div className="flex-1 overflow-y-auto pr-1 pb-3 scrollbar-none flex flex-col gap-3">
                
                {/* FAQ ACCORDION SECTION */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-app-text-secondary pl-1 block mb-1">Frequently Asked Questions</span>
                  
                  {faqs.map((item, idx) => {
                    const isExpanded = expandedFaq === idx;
                    return (
                      <div 
                        key={idx}
                        className="bg-stone-50 dark:bg-stone-900/30 rounded-xl border border-app-border overflow-hidden transition-all duration-300"
                      >
                        <button
                          onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                          className="w-full p-2.5 flex justify-between items-center text-xs font-bold text-left outline-none cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 text-app-text-primary"
                        >
                          <span className="leading-tight">{item.q}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0 ml-1.5" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-3 pb-3 pt-1 text-[11px] leading-relaxed text-app-text-secondary border-t border-app-border bg-stone-50/50 dark:bg-black/10"
                            >
                              {item.a}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* ACTION TRIGGERS */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-app-text-secondary pl-1 block">Instant Support Channels</span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleContactSupport('support')}
                      className="p-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-900/30 border border-app-border rounded-xl flex flex-col items-center justify-center text-center gap-1 cursor-pointer hover:shadow-xs active:scale-95 transition-all text-xs text-app-text-primary outline-none"
                    >
                      <Mail className="w-4 h-4 text-app-text-primary" />
                      <span className="font-extrabold text-[11px]">Contact Service</span>
                      <span className="text-[8px] text-app-text-secondary">client@dotalk.app</span>
                    </button>

                    <button
                      onClick={() => handleContactSupport('bug')}
                      className="p-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-900/30 border border-app-border rounded-xl flex flex-col items-center justify-center text-center gap-1 cursor-pointer hover:shadow-xs active:scale-95 transition-all text-xs text-app-text-primary outline-none"
                    >
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-extrabold text-[11px]">Submit Bug</span>
                      <span className="text-[8px] text-app-text-secondary">Report an issue</span>
                    </button>
                  </div>
                </div>

                {/* LEGAL SECTION LINKS */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-app-text-secondary pl-1 block">Legal Agreements</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPrivacyModal(true)}
                      className="flex-1 py-1.5 bg-stone-50 hover:bg-stone-100 dark:bg-stone-900/30 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 border border-app-border cursor-pointer text-app-text-primary outline-none"
                    >
                      <FileText className="w-3.5 h-3.5 text-app-text-secondary" /> Privacy Policy
                    </button>
                    <button
                      onClick={() => setShowTermsModal(true)}
                      className="flex-1 py-1.5 bg-stone-50 hover:bg-stone-100 dark:bg-stone-900/30 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 border border-app-border cursor-pointer text-app-text-primary outline-none"
                    >
                      <Info className="w-3.5 h-3.5 text-app-text-secondary" /> Terms of Service
                    </button>
                  </div>
                </div>

              </div>

              {/* Close row */}
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2 bg-app-btn-bg text-app-btn-text rounded-xl text-xs font-bold shadow cursor-pointer mt-2 shrink-0 border border-app-border outline-none transition-transform"
              >
                Close Help Center
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* PRIVACY POLICY DETAIL SLIDE SCREEN */}
      <AnimatePresence>
        {showPrivacyModal && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed inset-0 z-50 flex flex-col p-5 bg-app-card text-app-text-primary transition-colors duration-300"
          >
            <div className="flex justify-between items-center border-b border-app-border pb-3">
              <span className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-app-text-primary animate-fade">
                <FileText className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Privacy Policy Agreement
              </span>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full cursor-pointer text-app-text-primary outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 text-xs leading-relaxed space-y-3.5 scrollbar-none pr-1 text-app-text-secondary">
              <p className="font-bold text-sm text-app-text-primary">Last updated: June 15, 2026</p>
              <p>At DoTalk, we take security extremely seriously. We are committed to safeguarding the privacy and digital footprints of users accessing our instant communication environments.</p>
              
              <h5 className="font-bold text-sm text-app-text-primary pt-2">1. Authentication & OTP Keys</h5>
              <p>We eliminate passwords in favor of WhatsApp-like Email OTP keys. The 6-digit confirmation passwords sent during register or login sequences expire automatically after 5 minutes and are kept hashed in our secure server database logs.</p>

              <h5 className="font-bold text-sm text-app-text-primary pt-2">2. Local Storage Assets cache</h5>
              <p>We log local images, video replays, and text file structures onto client side sandboxed caches to assure responsive performance. These assets can always be managed or fully purged by utilizing the Storage Usage settings tab dashboard instantly.</p>

              <h5 className="font-bold text-sm text-app-text-primary pt-2">3. Socket Connection telemetry</h5>
              <p>Instant messages are funneled through low latency Socket.io endpoints. We do not inspect message payloads or preserve histories in plain document states; they are secured over fully certified standard SSL paths.</p>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2.5 bg-app-btn-bg text-app-btn-text rounded-xl font-bold text-xs shadow cursor-pointer mt-2 outline-none"
            >
              I Accept & Understand
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* TERMS OF SERVICE DETAIL SLIDE SCREEN */}
      <AnimatePresence>
        {showTermsModal && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed inset-0 z-50 flex flex-col p-5 bg-app-card text-app-text-primary transition-colors duration-300"
          >
            <div className="flex justify-between items-center border-b border-app-border pb-3">
              <span className="text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 text-app-text-primary">
                <Info className="w-4 h-4 text-amber-500 dark:text-amber-400" /> Terms & Conditions
              </span>
              <button 
                onClick={() => setShowTermsModal(false)}
                className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full cursor-pointer text-app-text-primary outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 text-xs leading-relaxed space-y-3.5 scrollbar-none pr-1 text-app-text-secondary">
              <p className="font-bold text-sm text-app-text-primary">Last updated: June 15, 2026</p>
              <p>These terms regulate standard utilization of the DoTalk real-time message program suite. By starting sessions, you subscribe to this terms compliance contract.</p>

              <h5 className="font-bold text-sm text-app-text-primary pt-2">1. Permitted Uses</h5>
              <p>You agree not to abuse socket payloads, spam auto-generated system updates, distribute malicious files, or execute automated packet scanning strategies targeting our Node instance ports.</p>

              <h5 className="font-bold text-sm text-app-text-primary pt-2">2. Verification Rate limits</h5>
              <p>Any account requesting verification codes is limited under strict rates. Maximum 5 login/registration trials are permitted per user segment before an automatic system block list triggers to mitigate brute force risks.</p>

              <h5 className="font-bold text-sm text-app-text-primary pt-2">3. Storage cleanup</h5>
              <p>Users are individually responsible for periodic audits of their cached documents size indicators. DoTalk holds zero liability for local file size excesses or media items cached in local browser state buffers.</p>
            </div>

            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full py-2.5 bg-app-btn-bg text-app-btn-text rounded-xl font-bold text-xs shadow cursor-pointer mt-2 outline-none"
            >
              Accept Terms of Service
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BLOCKED USERS LIST MODAL */}
      <AnimatePresence>
        {showBlockedModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-sm rounded-3xl p-5 shadow-2xl border flex flex-col max-h-[85vh] bg-app-card border-app-border text-app-text-primary transition-colors duration-300 animate-fade-in"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-app-border pb-3 mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-500" />
                  <h3 className="text-base font-extrabold tracking-tight text-app-text-primary">Blocked Contacts</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowBlockedModal(false);
                    setBlockedSearchQuery('');
                    setUnblockConfirmUser(null);
                  }}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full cursor-pointer transition-colors outline-none text-app-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Feedback messages */}
              {errorBlocked && (
                <div className="p-2.5 mb-3 text-xs bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl flex items-center gap-1.5 font-semibold shrink-0">
                  <AlertTriangle className="w-4 h-4" /> {errorBlocked}
                </div>
              )}
              {successBlocked && (
                <div className="p-2.5 mb-3 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 rounded-xl flex items-center gap-1.5 font-semibold shrink-0 animate-fade-in">
                  <Check className="w-4 h-4" /> {successBlocked}
                </div>
              )}

              {/* Conditionally render List View OR Unblock Confirmation Dialog */}
              {unblockConfirmUser ? (
                /* WhatsApp-Style Confirmation Card */
                <div className="py-4 text-center flex flex-col gap-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-2">
                    <Shield className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-app-text-primary">Unblock Contact?</h4>
                    <p className="text-xs text-app-text-secondary mt-1.5 leading-relaxed px-2">
                      Do you want to unblock <span className="font-bold text-app-text-primary">{unblockConfirmUser.fullName}</span>? They will be allowed to send you messages and initiate video or voice calls again.
                    </p>
                  </div>
                  <div className="flex gap-2.5 mt-2">
                    <button
                      onClick={() => setUnblockConfirmUser(null)}
                      className="flex-1 py-3 text-center rounded-2xl bg-stone-100 dark:bg-stone-800 hover:opacity-90 text-app-text-primary font-bold text-xs cursor-pointer transition-all border border-app-border outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const targetId = unblockConfirmUser._id;
                        setUnblockConfirmUser(null);
                        await handleUnblockUser(targetId);
                      }}
                      className="flex-1 py-3 text-center rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer transition-all outline-none"
                    >
                      Unblock
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Search Bar if database list exists or query is set */}
                  {(blockedUsers.length > 0 || blockedSearchQuery) && (
                    <div className="relative mb-3.5 shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary/60" />
                      <input
                        type="text"
                        value={blockedSearchQuery}
                        onChange={(e) => setBlockedSearchQuery(e.target.value)}
                        placeholder="Search by name, email or username..."
                        className="w-full h-10 pl-9 pr-4 rounded-xl border border-app-border bg-stone-50 dark:bg-stone-900/40 text-xs outline-none text-app-text-primary transition-colors focus:border-orange-500/30"
                      />
                      {blockedSearchQuery && (
                        <button 
                          onClick={() => setBlockedSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-app-text-secondary hover:text-app-text-primary"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* List body */}
                  <div className="flex-grow overflow-y-auto flex flex-col gap-2.5 mb-4 pr-1 scrollbar-none max-h-[45vh]">
                    {loadingBlocked ? (
                      <div className="flex justify-center items-center py-12">
                        <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
                      </div>
                    ) : (blockedUsers.filter((u: any) => {
                      const query = blockedSearchQuery.toLowerCase().trim();
                      if (!query) return true;
                      return (
                        u.fullName?.toLowerCase().includes(query) ||
                        u.username?.toLowerCase().includes(query) ||
                        u.email?.toLowerCase().includes(query)
                      );
                    })).length === 0 ? (
                      blockedUsers.length === 0 ? (
                        /* Empty state: No blocked users */
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-75 gap-2.5">
                          <Shield className="w-9 h-9 text-stone-400 mx-auto" />
                          <p className="text-sm font-bold text-app-text-primary">No blocked contacts</p>
                          <p className="text-[10px] text-app-text-secondary px-6 leading-relaxed">Blocked users will not be able to message or make audio/video calls with you.</p>
                        </div>
                      ) : (
                        /* Empty state: No search matches */
                        <div className="flex flex-col items-center justify-center py-10 text-center opacity-70">
                          <p className="text-xs font-bold text-app-text-primary">No matching contacts found</p>
                          <p className="text-[10px] text-app-text-secondary mt-1">Try refining your search keyword</p>
                        </div>
                      )
                    ) : (
                      (blockedUsers.filter((u: any) => {
                        const query = blockedSearchQuery.toLowerCase().trim();
                        if (!query) return true;
                        return (
                          u.fullName?.toLowerCase().includes(query) ||
                          u.username?.toLowerCase().includes(query) ||
                          u.email?.toLowerCase().includes(query)
                        );
                      })).map((u: any) => (
                        <div 
                          key={u._id}
                          className="p-3 rounded-xl bg-stone-50 dark:bg-[#2A2321] border border-app-border flex items-center justify-between gap-3 hover:bg-stone-100/50 dark:hover:bg-stone-800/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img 
                              src={u.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${u.username}`} 
                              alt={u.fullName} 
                              className="w-10 h-10 rounded-full object-cover border border-app-border shrink-0" 
                            />
                            <div className="flex flex-col min-w-0 text-left">
                              <span className="text-xs font-bold truncate text-app-text-primary leading-tight">{u.fullName}</span>
                              <span className="text-[9px] text-app-text-secondary truncate font-medium">
                                @{u.username} {u.email ? `• ${u.email}` : ''}
                              </span>
                              {u.blockedAt && (
                                <span className="text-[8px] text-stone-400 dark:text-stone-500 font-semibold mt-0.5 leading-none">
                                  Blocked on {(() => {
                                    try {
                                      return new Date(u.blockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                                    } catch {
                                      return '';
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setUnblockConfirmUser(u)}
                            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-extrabold bg-[#FEEBC5] dark:bg-[#3B2E2B] hover:opacity-90 text-[#3B2E2B] dark:text-amber-100 rounded-xl transition-all cursor-pointer shrink-0 border border-amber-500/15"
                          >
                            Unblock
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer row */}
                  <button
                    onClick={() => {
                      setShowBlockedModal(false);
                      setBlockedSearchQuery('');
                    }}
                    className="w-full py-2.5 bg-stone-150/50 hover:bg-stone-200/50 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-app-text-primary rounded-xl text-xs font-bold shrink-0 cursor-pointer border border-app-border outline-none transition-all active:scale-[0.98]"
                  >
                    Close
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

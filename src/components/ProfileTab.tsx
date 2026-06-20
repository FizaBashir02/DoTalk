import React, { useState } from 'react';
import { Camera, Check, Edit2, ShieldAlert, Award, User, AtSign, AlignLeft, ShieldCheck, KeyRound } from 'lucide-react';

interface ProfileTabProps {
  user: any;
  onUpdateUser: (updatedUser: any) => void;
  theme: 'light' | 'dark';
}

export default function ProfileTab({ user, onUpdateUser, theme }: ProfileTabProps) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  
  // Checking states
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  const triggerSaveDetails = async (field: 'fullName' | 'bio') => {
    setSavedStatus(null);
    const token = localStorage.getItem('dotalk_token');
    const value = field === 'fullName' ? fullName : bio;

    if (field === 'fullName' && value.length > 50) {
      alert('Full name must be under 50 characters');
      return;
    }
    if (field === 'bio' && value.length > 150) {
      alert('Bio must be under 150 characters');
      return;
    }

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [field]: value })
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateUser(data.user);
        setSavedStatus(`${field === 'fullName' ? 'Full name' : 'Bio'} updated successfully!`);
        setTimeout(() => setSavedStatus(null), 3500);
      }
    } catch (e) {
      console.error('Update fail');
    }
  };

  const handleUpdateUsername = async () => {
    setUsernameCheck('checking');
    const token = localStorage.getItem('dotalk_token');
    const response = await fetch('/api/profile/username', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ username: username })
    });
    const data = await response.json();
    if (response.ok) {
      onUpdateUser(data.user);
      setUsernameCheck('available');
      setSavedStatus('Username updated!');
      setTimeout(() => {
        setSavedStatus(null);
        setUsernameCheck('idle');
      }, 3000);
    } else {
      setUsernameCheck('taken');
      alert(data.error || 'Username already in use');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }

    const token = localStorage.getItem('dotalk_token');
    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await response.json();
      if (response.ok) {
        setPassSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPassSuccess('');
        }, 1500);
      } else {
        setPassError(data.error || 'Incorrect current password');
      }
    } catch (e) {
      setPassError('Database update error');
    }
  };

  const triggerProfilePhotoChange = async () => {
    // Generate beautiful random avatars that correspond to profile uploads
    const seed = Math.random().toString(36).substring(2, 8);
    const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;

    const token = localStorage.getItem('dotalk_token');
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ profilePhoto: newAvatar })
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateUser(data.user);
        setSavedStatus('Profile photo updated instantly!');
        setTimeout(() => setSavedStatus(null), 3000);
      }
    } catch (e) {
      console.error('Photo update fail');
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-5 py-4 flex flex-col gap-5 scrollbar-none">
      
      {/* 1. TOP AVATAR PROFILE PIC CARD */}
      <div className="flex flex-col items-center gap-2 py-4 relative">
        <div className="relative group cursor-pointer" onClick={triggerProfilePhotoChange}>
          <img
            src={user?.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`}
            alt={user?.fullName || ''}
            className="w-24 h-24 rounded-full object-cover border-4 border-[#3B2E2B] shadow-sm bg-[#FAECE1]/40"
          />
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <button className="absolute bottom-0 right-0 p-1.5 bg-[#3B2E2B] text-[#FEEBC5] rounded-full shadow border-2 border-white">
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className="text-xl font-extrabold tracking-tight mt-1">{user?.fullName}</h3>
        <p className="text-xs opacity-70">@{user?.username}</p>
      </div>

      {savedStatus && (
        <div className="p-2.5 text-center text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
          ✓ {savedStatus}
        </div>
      )}

      {/* 2. FIELD DATA CARDS */}
      <div className="flex flex-col gap-4">
        
        {/* FULL NAME */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#4A3B36] p-3.5 rounded-2xl border border-[#8C6A4D]/10 relative shadow-xs">
          <label className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-[#8C6A4D]"/> Full Name
          </label>
          <div className="flex items-center justify-between gap-2 mt-1">
            <input
              type="text"
              value={fullName}
              maxLength={50}
              onChange={e => setFullName(e.target.value)}
              className="flex-1 bg-transparent border-none text-slate-800 dark:text-amber-50 outline-none text-sm font-semibold"
            />
            <button
              onClick={() => triggerSaveDetails('fullName')}
              className="text-xs font-bold text-[#8C6A4D] hover:underline"
            >
              Save
            </button>
          </div>
          <div className="text-[9px] text-right mt-1 opacity-60">
            {fullName.length} / 50 characters
          </div>
        </div>

        {/* UNIQUE USERNAME (Letters, Numbers, Underscores, Length 3-20) */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#4A3B36] p-3.5 rounded-2xl border border-[#8C6A4D]/10 relative shadow-xs">
          <label className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1">
            <AtSign className="w-3.5 h-3.5 text-[#8C6A4D]"/> Username
          </label>
          <div className="flex items-center justify-between gap-2 mt-1">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="flex-1 bg-transparent border-none text-slate-800 dark:text-amber-50 outline-none text-sm font-semibold"
            />
            <button
              onClick={handleUpdateUsername}
              disabled={usernameCheck === 'checking' || username === user.username}
              className="text-xs font-bold text-[#8C6A4D] hover:underline disabled:opacity-50"
            >
              {usernameCheck === 'checking' ? 'Validating...' : 'Check & Save'}
            </button>
          </div>
          <span className="text-[9px] opacity-70 mt-1">
            Min 3 characters, alphanumeric with underscores only.
          </span>
        </div>

        {/* BIO / ABOUT */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#4A3B36] p-3.5 rounded-2xl border border-[#8C6A4D]/10 relative shadow-xs">
          <label className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1">
            <AlignLeft className="w-3.5 h-3.5 text-[#8C6A4D]"/> About / Bio
          </label>
          <div className="flex items-center justify-between gap-2 mt-1">
            <input
              type="text"
              value={bio}
              maxLength={150}
              onChange={e => setBio(e.target.value)}
              className="flex-1 bg-transparent border-none text-slate-800 dark:text-amber-50 outline-none text-sm font-semibold"
            />
            <button
              onClick={() => triggerSaveDetails('bio')}
              className="text-xs font-bold text-[#8C6A4D] hover:underline"
            >
              Save
            </button>
          </div>
          <div className="text-[9px] text-right mt-1 opacity-60">
            {bio.length} / 150 characters
          </div>
        </div>

        {/* READ ONLY EMAIL + VERIFIED BADGE */}
        <div className="flex flex-col gap-1 bg-[#FAECE1]/30 dark:bg-[#4A3B36]/50 p-3.5 rounded-2xl border border-zinc-200 text-sm shadow-xs opacity-90">
          <span className="text-[10px] font-bold uppercase opacity-75">Account Email</span>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm font-semibold select-all text-slate-600 dark:text-zinc-200">{user.email}</span>
            <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 bg-emerald-100 rounded-full px-2.5 py-0.5">
              <ShieldCheck className="w-3.5 h-3.5"/> Verified
            </div>
          </div>
        </div>

      </div>

      {/* 3. CHANGE PASSWORD BUTTON TO MODAL */}
      <button
        onClick={() => setShowPasswordModal(true)}
        className="w-full h-11 border border-[#3B2E2B]/20 bg-transparent rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-3 cursor-pointer"
      >
        <KeyRound className="w-4 h-4"/> Change Security Password
      </button>

      {/* PASSWORD TRIGGER MODAL OVERLAY */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`p-6 rounded-3xl w-full max-w-sm shadow-lg ${
            theme === 'dark' ? 'bg-[#4A3B36] text-amber-50' : 'bg-white text-[#3B2E2B]'
          }`}>
            <h3 className="text-lg font-bold mb-2">Update Password</h3>
            <p className="text-xs opacity-75 mb-4">Enter passwords securely below to run bcrypt hash.</p>

            {passError && <div className="p-2 mb-3 text-xs bg-red-100 text-red-600 rounded-lg">{passError}</div>}
            {passSuccess && <div className="p-2 mb-3 text-xs bg-emerald-100 text-emerald-600 rounded-lg">{passSuccess}</div>}

            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Current Password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-100 dark:bg-[#3B2E2B]/50 border rounded-lg text-sm outline-none"
              />
              <input
                type="password"
                placeholder="New Password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-100 dark:bg-[#3B2E2B]/50 border rounded-lg text-sm outline-none"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full h-10 px-3 bg-zinc-100 dark:bg-[#3B2E2B]/50 border rounded-lg text-sm outline-none"
              />

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-xs font-bold hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3B2E2B] dark:bg-[#FEEBC5] dark:text-[#3B2E2B] text-amber-50 rounded-lg text-xs font-bold shadow"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

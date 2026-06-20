import React, { useState } from 'react';
import { Sun, Moon, Shield, Bell, HelpCircle, LogOut, HardDrive, Eye } from 'lucide-react';

interface SettingsTabProps {
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onLogout: () => void;
}

export default function SettingsTab({ theme, onChangeTheme, onLogout }: SettingsTabProps) {
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [privateReadReceipts, setPrivateReadReceipts] = useState(true);

  return (
    <div className="w-full h-full overflow-y-auto px-5 py-4 flex flex-col gap-5 scrollbar-none">
      
      {/* 1. THEME TOGGLE CONTROL */}
      <div className="flex flex-col gap-1.5 bg-white dark:bg-[#4A3B36] p-4 rounded-2xl border border-[#8C6A4D]/10 shadow-xs">
        <span className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1.5">
          {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-orange-300"/> : <Sun className="w-3.5 h-3.5 text-amber-500"/>} Appearance Mode
        </span>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm font-semibold">Active Dark Theme</span>
          <button
            onClick={() => onChangeTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
              theme === 'dark' ? 'bg-[#FEEBC5]' : 'bg-zinc-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-[#3B2E2B] transition-transform ${
              theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>
      </div>

      {/* 2. OTHER ACCORDION LIST CONTROLS */}
      <div className="flex flex-col gap-4">
        
        {/* PRIVACY */}
        <div className="flex flex-col gap-2.5 bg-white dark:bg-[#4A3B36] p-4 rounded-2xl border border-[#8C6A4D]/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1.5">
            <LockBadge className="w-3.5 h-3.5 text-[#8C6A4D]"/> Account Privacy
          </span>

          <div className="flex justify-between items-center mt-1">
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Read Receipts Seen Ticks</span>
              <span className="text-[9px] opacity-70">Allow others to view seen ticks</span>
            </div>
            <input
              type="checkbox"
              checked={privateReadReceipts}
              onChange={e => setPrivateReadReceipts(e.target.checked)}
              className="accent-[#3B2E2B] scale-110 cursor-pointer"
            />
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div className="flex flex-col gap-2.5 bg-white dark:bg-[#4A3B36] p-4 rounded-2xl border border-[#8C6A4D]/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-[#8C6A4D]"/> Notifications
          </span>

          <div className="flex justify-between items-center mt-1">
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Mute Group Notifications</span>
              <span className="text-[9px] opacity-70">Mute message notification sound effects</span>
            </div>
            <input
              type="checkbox"
              checked={notificationsMuted}
              onChange={e => setNotificationsMuted(e.target.checked)}
              className="accent-[#3B2E2B] scale-110 cursor-pointer"
            />
          </div>
        </div>

        {/* DIRECT STORAGE */}
        <div className="flex flex-col gap-2.5 bg-white dark:bg-[#4A3B36] p-4 rounded-2xl border border-[#8C6A4D]/10 shadow-xs">
          <span className="text-[10px] font-bold uppercase opacity-75 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#8C6A4D]"/> Storage Usage
          </span>
          <div className="flex justify-between items-center text-xs mt-1">
            <span className="font-semibold text-slate-700 dark:text-zinc-200">Local Upload cache size</span>
            <span className="font-bold">14.2 MB</span>
          </div>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
            <div className="w-[30%] h-full bg-[#8C6A4D]"></div>
          </div>
        </div>

        {/* CONTACT GUIDE HELP */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#4A3B36]/60 p-3.5 rounded-xl border border-[#8C6A4D]/10 text-xs">
          <HelpCircle className="w-4 h-4 opacity-75 text-[#8C6A4D]" />
          <div className="flex-1">
            <span className="font-bold block text-[#3B2E2B] dark:text-[#FEEBC5]">Help & Support guide</span>
            <span className="opacity-75 text-[10px]">Contact our server support at client@dotalk.app</span>
          </div>
        </div>

      </div>

      {/* 3. LOGOUT SYSTEM */}
      <button
        onClick={onLogout}
        className="w-full h-11 bg-[#F44336] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-4 cursor-pointer shadow hover:opacity-95"
      >
        <LogOut className="w-4 h-4"/> Sign Out of DoTalk
      </button>

    </div>
  );
}

function LockBadge(props: React.SVGProps<SVGSVGElement>) {
  return <Shield {...props} />;
}

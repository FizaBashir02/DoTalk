import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface PhoneFrameProps {
  children: React.ReactNode;
  theme: 'light' | 'dark';
}

export default function PhoneFrame({ children, theme }: PhoneFrameProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [isHandset, setIsHandset] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    const checkDevice = () => {
      const mobileProtocol = window.location.protocol.startsWith('capacitor:');
      const smallWidth = window.innerWidth <= 640;
      setIsHandset(mobileProtocol || smallWidth);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', checkDevice);
    };
  }, []);

  // If handset device size or Capacitor APK environment, bypass frames
  if (isHandset) {
    return (
      <div id="handset-viewport" className="w-full h-full flex flex-col overflow-hidden relative">
        {children}
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center py-6 px-4 bg-slate-950 min-h-screen text-slate-100 select-none font-sans transition-colors duration-300">
      {/* Decorative Outer Ambient Glow */}
      <div className="relative w-full max-w-[420px] aspect-[9/19] rounded-[52px] bg-neutral-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_45px_rgba(140,106,77,0.1)] border-4 border-neutral-800 flex flex-col overflow-hidden ring-12 ring-zinc-950/40">
        
        {/* Notch / Dynamic Island */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-7 w-36 bg-black rounded-b-2xl z-50 flex items-center justify-center gap-1.5 px-3">
          {/* Camera lens */}
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-805/80"></div>
          {/* Speaker slit */}
          <div className="w-12 h-1 bg-zinc-800/60 rounded-full"></div>
          {/* Sensor light indicator */}
          <div className="w-1 h-1 rounded-full bg-emerald-500/40"></div>
        </div>

        {/* Home Screen Status Bar */}
        <div className={`h-11 pt-7 px-6 flex justify-between items-center text-xs font-semibold z-40 relative ${
          theme === 'dark' ? 'bg-[#3B2E2B] text-[#FEEBC5] border-b border-[#5A4A45]' : 'bg-[#FEEBC5] text-[#3B2E2B] border-b border-[#E8D6B3]'
        }`}>
          <div>{currentTime}</div>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px]">98%</span>
              <Battery className="w-4 h-4 text-emerald-500 fill-emerald-500" />
            </div>
          </div>
        </div>

        {/* Screen Bezel Active Body */}
        <div className="flex-1 w-full relative flex flex-col overflow-hidden bg-slate-900">
          {children}
        </div>

        {/* Bottom Virtual Home Indicator Pill */}
        <div className={`h-6 flex justify-center items-center relative z-40 ${
          theme === 'dark' ? 'bg-[#3B2E2B] border-t border-[#5A4A45]' : 'bg-[#FEEBC5] border-t border-[#E8D6B3]'
        }`}>
          <div className="w-32 h-1 bg-neutral-400 rounded-full opacity-40 animate-pulse"></div>
        </div>

      </div>
    </div>
  );
}

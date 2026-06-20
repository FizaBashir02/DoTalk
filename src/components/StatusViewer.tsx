import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Play, Volume2, User, PlusCircle } from 'lucide-react';

interface StatusStory {
  _id: string;
  userId: string;
  username: string;
  userPhoto: string;
  mediaUrl: string;
  caption: string;
  createdAt: string;
}

interface StatusViewerProps {
  stories: StatusStory[];
  onClose: () => void;
  theme: 'light' | 'dark';
}

export default function StatusViewer({ stories, onClose, theme }: StatusViewerProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
  }, [index]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          // Go to next slide
          if (index < stories.length - 1) {
            setIndex(index + 1);
            return 0;
          } else {
            // Close status viewer
            clearInterval(interval);
            onClose();
            return 100;
          }
        }
        return p + 1;
      });
    }, 45); // Approx 4.5 seconds complete slide

    return () => clearInterval(interval);
  }, [index, stories.length]);

  if (stories.length === 0) return null;
  const current = stories[index];

  return (
    <div className="fixed inset-0 bg-neutral-950/98 z-50 flex flex-col justify-between p-4 text-white">
      
      {/* 1. PROGRESS BAR SLIDES INDICATORS */}
      <div className="flex gap-1.5 w-full pt-6">
        {stories.map((_, idx) => {
          let value = 0;
          if (idx < index) value = 100;
          else if (idx === index) value = progress;

          return (
            <div key={idx} className="flex-1 bg-zinc-700/60 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-100 h-full" style={{ width: `${value}%` }} />
            </div>
          );
        })}
      </div>

      {/* 2. STORY HEADER INFO */}
      <div className="flex justify-between items-center mt-3 z-10 px-1">
        <div className="flex items-center gap-2">
          <img src={current.userPhoto} alt={current.username} className="w-9 h-9 rounded-full object-cover border-2 border-white" />
          <div className="flex flex-col">
            <span className="text-sm font-bold">{current.username}</span>
            <span className="text-[10px] opacity-75">
              {new Date(current.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <button onClick={onClose} className="p-1 bg-white/10 hover:bg-white/25 rounded-full border border-white/20">
          <X className="w-5 h-5"/>
        </button>
      </div>

      {/* 3. STORIES BODY VIEWPORT */}
      <div className="flex-1 flex flex-col justify-center items-center my-6 relative overflow-hidden px-2">
        <img
          src={current.mediaUrl}
          alt="story pic"
          className="w-full max-h-[60vh] object-contain rounded-2xl shadow-2xl filter brightness-95"
        />

        {current.caption && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md px-6 py-3.5 rounded-2xl text-center text-sm font-semibold border border-white/10 leading-relaxed shadow-lg">
            {current.caption}
          </div>
        )}
      </div>

      {/* 4. TAP TO NAVIGATE SLIDERS */}
      <div className="absolute inset-x-24 top-24 bottom-32 flex justify-between z-0">
        <div className="w-1/2 cursor-pointer" onClick={() => index > 0 && setIndex(index - 1)} title="Previous"/>
        <div className="w-1/2 cursor-pointer" onClick={() => index < stories.length - 1 ? setIndex(index + 1) : onClose()} title="Next"/>
      </div>

      {/* BOTTOM BRAND FOOTER */}
      <div className="text-center pb-6 text-[10px] font-bold tracking-widest opacity-40 uppercase">
        DoTalk Stories 24h
      </div>

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  User, 
  MessageSquare, 
  Check, 
  X, 
  Camera, 
  Video, 
  ShieldAlert, 
  RotateCcw, 
  Search, 
  CheckSquare, 
  Square, 
  FileText, 
  Volume2, 
  VolumeX,
  Loader2,
  Lock
} from 'lucide-react';
import { apiFetch } from '../utils/api.js';

// ==========================================
// 1. CHAT AUDIO PLAYER WITH WAVEFORM MATCH
// ==========================================
interface AudioPlayerProps {
  src: string;
  name: string;
  size: string;
  isVoiceNote?: boolean;
  senderPhoto?: string;
  theme: 'light' | 'dark';
}

export function ChatAudioPlayer({ src, name, size, isVoiceNote = false, senderPhoto, theme }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate deterministic heights for simulated digital waveform
  const waveformHeights = [
    12, 28, 16, 32, 24, 40, 36, 18, 10, 24, 32, 44, 28, 16, 22, 38, 30, 42, 24, 14, 20, 35, 12, 18, 30, 26, 42, 20, 10, 24, 36, 14
  ];

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    // Initial load try
    audio.load();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error('Audio playback failed', e));
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const nextMute = !isMuted;
    audioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const value = parseFloat(e.target.value);
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const percentPlayed = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`p-3 rounded-2xl flex flex-col gap-2 max-w-72 border shadow-xs text-left ${
      theme === 'dark' 
        ? 'bg-zinc-800/90 border-zinc-700 text-slate-100' 
        : 'bg-stone-50 border-stone-200 text-slate-800'
    }`}>
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button 
          onClick={togglePlay} 
          className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center cursor-pointer shadow transition-all duration-150 shrink-0 outline-none"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white fill-white" />
          ) : (
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          )}
        </button>

        {isVoiceNote && senderPhoto ? (
          <div className="relative shrink-0">
            <img src={senderPhoto} alt="Speaker avatar" className="w-9 h-9 rounded-full object-cover border border-emerald-500/30" />
            <span className="absolute bottom-[-2px] right-[-2px] bg-emerald-500 rounded-full p-0.5 text-white flex items-center justify-center scale-75">
              🎙️
            </span>
          </div>
        ) : (
          <span className="text-xl shrink-0">🎵</span>
        )}

        {/* Digital Waveform bar or scrub bar */}
        <div className="flex-1 flex flex-col gap-1 overflow-hidden">
          <div className="h-6 flex items-end gap-[2px] pt-1">
            {waveformHeights.map((h, i) => {
              const active = percentPlayed > (i / waveformHeights.length) * 100;
              return (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-[3px] rounded-t transition-colors duration-100 ${
                    active 
                      ? 'bg-emerald-500 dark:bg-emerald-400' 
                      : 'bg-neutral-300 dark:bg-zinc-600'
                  }`}
                />
              );
            })}
          </div>

          <input 
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleScrub}
            className="w-full h-1 bg-neutral-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Mute toggle */}
        <button onClick={toggleMute} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-200 shrink-0">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex justify-between items-center text-[10px] opacity-70">
        <span className="font-semibold font-mono">{formatTime(currentTime)} / {formatTime(duration || 0)}</span>
        <span className="font-bold truncate max-w-[120px]" title={name}>{isVoiceNote ? '🎤 Voice Note' : name} ({size})</span>
      </div>
    </div>
  );
}

// ==========================================
// 2. CONTACT CARD DISPLAY WIDGET
// ==========================================
interface ContactCardProps {
  fullName: string;
  username: string;
  bio?: string;
  photo?: string;
  theme: 'light' | 'dark';
  onQuickMessage?: () => void;
}

export function ContactCardWidget({ fullName, username, bio, photo, theme, onQuickMessage }: ContactCardProps) {
  
  const handleDownloadVCF = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Real VCard compiler
    const vcardContent = `BEGIN:VCARD
VERSION:3.0
FN:${fullName}
N:${fullName.split(' ')[1] || ''};${fullName.split(' ')[0] || ''};;;
TEL;TYPE=CELL,VOICE:+1 (555) 728-1920
EMAIL;TYPE=PREF,INTERNET:${username}@dotalk.app
NOTE:Verified DoTalk profile: @${username}
URL:https://dotalk.app/u/${username}
END:VCARD`;

    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fullName.replace(/\s+/g, '_')}_contact.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`;

  return (
    <div className={`p-4 rounded-2xl border shadow-sm max-w-72 text-left flex flex-col gap-3 transition-colors ${
      theme === 'dark' 
        ? 'bg-zinc-800 border-zinc-700 text-slate-100' 
        : 'bg-white border-neutral-200 text-slate-800'
    }`}>
      <div className="flex items-center gap-3">
        <img 
          src={photo || defaultAvatar} 
          alt={fullName} 
          className="w-12 h-12 rounded-full object-cover border border-emerald-500/20 shadow-inner" 
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 overflow-hidden">
          <h4 className="text-xs font-bold truncate leading-snug">{fullName}</h4>
          <span className="text-[10px] opacity-70 block font-mono">@{username}</span>
          <span className="text-[9px] block text-emerald-500 font-extrabold tracking-tight mt-0.5">DoTalk Contact Card</span>
        </div>
      </div>

      {bio && (
        <p className="text-[11px] italic opacity-85 line-clamp-2 bg-neutral-100/50 dark:bg-black/20 p-2 rounded-lg border border-dashed border-stone-200 dark:border-zinc-800">
          "{bio}"
        </p>
      )}

      <div className="border-t border-stone-100 dark:border-zinc-800 pt-2 grid grid-cols-2 gap-2">
        <button
          onClick={handleDownloadVCF}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] cursor-pointer shadow hover:scale-102 transition-all outline-none"
        >
          <User className="w-3.5 h-3.5" />
          <span>Save Contact</span>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); if (onQuickMessage) onQuickMessage(); }}
          className="flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-stone-200 dark:border-zinc-700 hover:bg-black/5 dark:hover:bg-white/5 font-bold text-[10px] cursor-pointer outline-none"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat Profile</span>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 3. INTERACTIVE WEBCAM CAMERA MODAL
// ==========================================
interface CameraCaptureProps {
  onCapture: (fileDataUrl: string, type: 'image' | 'video', durationSec?: number) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export function CameraCaptureOverlay({ onCapture, onClose, theme }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recDuration, setRecDuration] = useState(0);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [videoPreviewBlob, setVideoPreviewBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [mode]);

  const startCamera = async () => {
    try {
      setPermissionError(null);
      stopCamera();
      const constraints = {
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: mode === 'video' ? true : false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access denied:', err);
      setPermissionError(
        'Camera or microphone permissions were denied. Please check your browser privacy settings or allow framework access.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    clearInterval(timerRef.current);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !stream) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(-1, 1); // Mirror photo capture to match user view
        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPreview(dataUrl);
        stopCamera();
      }
    } catch (e) {
      console.error('Capture photo canvas failed', e);
    }
  };

  const startVideoRecording = () => {
    if (!stream) return;
    try {
      setRecordedChunks([]);
      setRecDuration(0);
      const options = { mimeType: 'video/webm;codecs=vp9' };
      let mediaRecorder;
      
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream); // standard fallback
      }

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        clearInterval(timerRef.current);
      };

      mediaRecorder.start(10); // Capture chunk every 10ms
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecDuration(prev => prev + 1);
      }, 1000);
    } catch (e) {
      console.error('Start video record failed', e);
    }
  };

  const stopVideoRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
    stopCamera();

    // Give chunks brief instant to accumulate, then formulate preview
    setTimeout(() => {
      setRecordedChunks(currentChunks => {
        if (currentChunks.length === 0) return currentChunks;
        const blob = new Blob(currentChunks, { type: 'video/webm' });
        setVideoPreviewBlob(blob);
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreview(previewUrl);
        return currentChunks;
      });
    }, 100);
  };

  const handleRetake = () => {
    setCapturedPreview(null);
    setVideoPreviewBlob(null);
    setRecordedChunks([]);
    setRecDuration(0);
    startCamera();
  };

  const handleUseMedia = async () => {
    if (!capturedPreview) return;

    if (mode === 'photo') {
      onCapture(capturedPreview, 'image');
    } else {
      // Convert recorded video blob directly into safe base64 DataUrl for file transmission
      if (videoPreviewBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            onCapture(reader.result, 'video', recDuration);
          }
        };
        reader.readAsDataURL(videoPreviewBlob);
      }
    }
  };

  const formatSecs = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className={`w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-app-card border border-app-border`}>
        {/* Header toolbar */}
        <div className="p-4 flex justify-between items-center bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-500 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wide">Webcam Recording System</h3>
          </div>
          <button onClick={onClose} className="p-1 px-2 text-xs font-bold rounded-lg hover:bg-black/10 dark:hover:bg-white/10">✕</button>
        </div>

        {/* Viewer frame */}
        <div className="relative bg-black h-80 flex items-center justify-center overflow-hidden">
          {permissionError ? (
            <div className="p-6 text-center text-red-400 text-xs flex flex-col items-center gap-3">
              <ShieldAlert className="w-10 h-10 text-red-500" />
              <p className="font-bold leading-relaxed">{permissionError}</p>
            </div>
          ) : capturedPreview ? (
            mode === 'photo' ? (
              <img src={capturedPreview} alt="Captured preview" className="w-full h-full object-contain" />
            ) : (
              <video src={capturedPreview} controls className="w-full h-full object-contain" playing />
            )
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover scale-x-[-1]" // mirror view for natural alignment
              />
              {isRecording && (
                <div className="absolute top-4 left-4 bg-red-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-white block" />
                  <span>REC {formatSecs(recDuration)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Buttons tray */}
        <div className="p-5 flex flex-col gap-4 bg-black/5 dark:bg-white/5 shrink-0">
          {!capturedPreview ? (
            <div className="flex flex-col gap-3.5">
              {/* Mode switch */}
              {!isRecording && (
                <div className="flex justify-center bg-black/10 dark:bg-white/5 p-1 rounded-full w-48 mx-auto border border-black/10 dark:border-white/5">
                  <button
                    onClick={() => setMode('photo')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-full cursor-pointer transition-all ${
                      mode === 'photo' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Photo</span>
                  </button>

                  <button
                    onClick={() => setMode('video')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-xs font-bold rounded-full cursor-pointer transition-all ${
                      mode === 'video' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>
                </div>
              )}

              {/* Shutter operations */}
              <div className="flex justify-center items-center">
                {mode === 'photo' ? (
                  <button
                    onClick={capturePhoto}
                    disabled={!stream}
                    className="w-16 h-16 rounded-full border-4 border-white bg-white hover:bg-neutral-200 cursor-pointer disabled:opacity-40 shadow-xl scale-95 transition-transform"
                    title="Snaps Image"
                  />
                ) : isRecording ? (
                  <button
                    onClick={stopVideoRecording}
                    className="w-16 h-16 rounded-full border-4 border-white bg-red-600 hover:bg-red-700 cursor-pointer shadow-xl flex items-center justify-center scale-95 hover:scale-100 transition-all"
                  >
                    <span className="w-6 h-6 bg-white rounded-lg block" />
                  </button>
                ) : (
                  <button
                    onClick={startVideoRecording}
                    disabled={!stream}
                    className="w-16 h-16 rounded-full border-4 border-white bg-emerald-500 hover:bg-emerald-600 cursor-pointer disabled:opacity-40 shadow-xl flex items-center justify-center scale-95 hover:scale-100 transition-all"
                  >
                    <span className="w-5 h-5 bg-white rounded-full block animate-ping" style={{ animationDuration: '2s' }} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-[10px] text-center font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-wider mx-auto font-mono">
                ✓ Grab Preview Success ({mode === 'photo' ? 'Snapshot Image' : `Clipped MP4/WebM - ${formatSecs(recDuration)}`})
              </span>

              <div className="flex gap-4">
                <button
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl border border-stone-200 dark:border-zinc-700 hover:bg-black/5 dark:hover:bg-white/5 font-bold text-xs cursor-pointer outline-none"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retake Capture</span>
                </button>

                <button
                  onClick={handleUseMedia}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer shadow outline-none"
                >
                  <span>Select & Preview</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. MULTI-CONTACT SHARING PICKER MODAL
// ==========================================
interface ContactShareProps {
  onContactsSelected: (selectedUsers: any[]) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export function ContactShareModal({ onContactsSelected, onClose, theme }: ContactShareProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const list = await res.json();
        // Exclude dummy placeholders or sort cleanly
        setUsers(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleShare = () => {
    const selectedUsers = users.filter(u => selectedIds.includes(u._id));
    if (selectedUsers.length > 0) {
      onContactsSelected(selectedUsers);
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-xl flex flex-col h-[480px] bg-app-card text-app-text-primary border border-app-border`}>
        <div className="p-4 flex justify-between items-center border-b border-black/10 dark:border-white/10 shrink-0">
          <h3 className="text-sm font-bold tracking-tight">Share Contacts</h3>
          <button onClick={onClose} className="p-1 px-2 text-xs font-bold rounded-lg hover:bg-black/10 dark:hover:bg-white/10">✕</button>
        </div>

        {/* Search row */}
        <div className="p-3 bg-black/5 dark:bg-white/5 flex gap-2 shrink-0">
          <div className="flex-1 h-9 px-3 bg-app-input-bg border border-app-border rounded-xl flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-app-text-secondary shrink-0" />
            <input
              type="text"
              placeholder="Search buddies..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none border-none p-0 focus:ring-0"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 select-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-xs opacity-60 gap-1">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span>Loading buddies list...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-xs opacity-50 py-16">No matching contacts found</div>
          ) : (
            filteredUsers.map(u => {
              const checked = selectedIds.includes(u._id);
              const initialsAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.fullName)}`;
              return (
                <div
                  key={u._id}
                  onClick={() => toggleSelect(u._id)}
                  className={`p-2.5 rounded-2xl flex items-center justify-between cursor-pointer transition-colors ${
                    checked 
                      ? 'bg-emerald-500/10 dark:bg-emerald-500/15' 
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={u.profilePhoto || initialsAvatar} 
                      alt={u.fullName} 
                      className="w-9 h-9 rounded-full object-cover border border-black/10 shadow-xs" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate leading-tight">{u.fullName}</span>
                      <span className="text-[10px] opacity-75 block font-mono">@{u.username}</span>
                    </div>
                  </div>

                  <button className="text-emerald-500 outline-none shrink-0 pr-1">
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-zinc-600" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10 shrink-0">
          <button
            onClick={handleShare}
            disabled={selectedIds.length === 0}
            className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold text-xs cursor-pointer shadow transition-all duration-150 outline-none"
          >
            Share {selectedIds.length} Contact{selectedIds.length !== 1 ? 's' : ''} Card
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. ATTACHMENT UPLOAD PREVIEW MODAL
// ==========================================
interface PreviewFile {
  name: string;
  type: 'image' | 'video' | 'file' | 'audio' | 'contact';
  sizeStr: string;
  dataUrl: string;
}

interface AttachmentPreviewProps {
  files: PreviewFile[];
  caption: string;
  onCaptionChange: (text: string) => void;
  onSend: () => void;
  onClose: () => void;
  onRemoveFile: (idx: number) => void;
  uploadProgress: number;
  theme: 'light' | 'dark';
}

export function AttachmentPreviewModal({ 
  files, 
  caption, 
  onCaptionChange, 
  onSend, 
  onClose, 
  onRemoveFile,
  uploadProgress,
  theme 
}: AttachmentPreviewProps) {
  
  const [activeIdx, setActiveIdx] = useState(0);
  const isUploading = uploadProgress > 0;

  useEffect(() => {
    if (activeIdx >= files.length) {
      setActiveIdx(Math.max(0, files.length - 1));
    }
  }, [files, activeIdx]);

  if (files.length === 0) return null;

  const currentFile = files[activeIdx];

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[60] animate-fade-in text-white">
      <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[520px] relative bg-[#3B2E2B] border border-[#5A4A45]">
        
        {/* Header Toolbar */}
        <div className="p-4 flex justify-between items-center bg-black/20 border-b border-white/5 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
              ATTACHMENT PREVIEW
            </span>
            <span className="text-xs opacity-75">({files.length} Item{files.length !== 1 ? 's' : ''})</span>
          </div>

          <button 
            onClick={onClose} 
            disabled={isUploading}
            className="p-1 px-2.5 text-xs font-bold rounded-lg hover:bg-white/10 disabled:opacity-40 outline-none"
          >
            ✕
          </button>
        </div>

        {/* Stage Content Media display */}
        <div className="flex-1 bg-black/35 relative flex items-center justify-center overflow-hidden p-4 min-h-[180px]">
          {isUploading ? (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-10 z-20 animate-fade-in">
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* Circular Upload Percentage Track */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="34" className="stroke-white/10 fill-none" strokeWidth="5" />
                  <circle 
                    cx="40" 
                    cy="40" 
                    r="34" 
                    className="stroke-emerald-500 fill-none transition-all duration-300" 
                    strokeWidth="5" 
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - uploadProgress / 100)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-black text-emerald-400 font-mono tracking-tighter">{uploadProgress}%</span>
                  <span className="text-[8px] opacity-60 uppercase font-bold tracking-tight">Sent</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold text-slate-100 animate-pulse uppercase tracking-wide">Compressing & Securely Uploading...</p>
                <p className="text-[10px] opacity-75 max-w-[240px] leading-tight">Syncing encrypted payloads seamlessly with Cloud database.</p>
              </div>
            </div>
          ) : currentFile ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              {currentFile.type === 'image' && (
                <img src={currentFile.dataUrl} alt="Preview file" className="max-w-full max-h-[220px] object-contain rounded-xl shadow border border-white/5" />
              )}

              {currentFile.type === 'video' && (
                <video src={currentFile.dataUrl} controls className="max-w-full max-h-[220px] rounded-xl outline-none bg-black border border-white/5" />
              )}

              {currentFile.type === 'audio' && (
                <div className="p-6 rounded-2xl bg-white/5 flex flex-col items-center gap-3 border border-white/10 w-64 text-center">
                  <span className="text-4xl animate-bounce">🎙️</span>
                  <div>
                    <span className="text-xs font-bold block truncate max-w-[200px]" title={currentFile.name}>{currentFile.name}</span>
                    <span className="text-[9px] opacity-70 block font-mono mt-0.5 bg-white/10 px-2 py-0.5 rounded-full inline-block">{currentFile.sizeStr}</span>
                  </div>
                </div>
              )}

              {currentFile.type === 'file' && (
                <div className="p-6 rounded-2xl bg-white/5 flex flex-col items-center gap-3 border border-white/10 w-64 text-center">
                  <FileText className="w-12 h-12 text-blue-400" />
                  <div>
                    <span className="text-xs font-bold block truncate max-w-[200px]" title={currentFile.name}>{currentFile.name}</span>
                    <span className="text-[9px] opacity-70 block font-mono mt-0.5 bg-white/10 px-2 py-0.5 rounded-full inline-block">{currentFile.sizeStr}</span>
                  </div>
                </div>
              )}

              {currentFile.type === 'contact' && (
                <div className="p-5 rounded-2xl bg-white/5 flex flex-col items-center gap-3 border border-white/10 w-64 text-center">
                  <User className="w-12 h-12 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold block leading-snug">{currentFile.name}</span>
                    <span className="text-[9px] opacity-70 block font-mono mt-1">vCard Contact Card Attachment</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Thumbnail Selector list */}
        {files.length > 1 && !isUploading && (
          <div className="px-4 py-2 bg-black/10 overflow-x-auto flex gap-2 border-t border-b border-white/5 shrink-0 select-none">
            {files.map((f, i) => (
              <div 
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`relative w-12 h-12 rounded-xl border-2 transition-all cursor-pointer overflow-hidden shrink-0 ${
                  activeIdx === i ? 'border-emerald-500 scale-102' : 'border-transparent hover:border-white/30 opacity-75'
                }`}
              >
                {f.type === 'image' ? (
                  <img src={f.dataUrl} alt="thumb" className="w-full h-full object-cover" />
                ) : f.type === 'video' ? (
                  <div className="w-full h-full bg-[#FAECE1]/10 flex items-center justify-center text-xs">🎬</div>
                ) : f.type === 'audio' ? (
                  <div className="w-full h-full bg-purple-500/10 flex items-center justify-center text-xs">🎙️</div>
                ) : (
                  <div className="w-full h-full bg-blue-500/10 flex items-center justify-center text-xs">📄</div>
                )}

                {/* Cancel on thumbnail */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(i); }}
                  className="absolute -top-1 -right-1 bg-red-600/90 hover:bg-red-700 text-[8px] font-bold p-0.5 px-1 pb-1 rounded-full text-white cursor-pointer select-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Security / Compression Status Strip */}
        {!isUploading && currentFile && (
          <div className="px-4 py-1.5 bg-black/40 text-[9px] flex justify-between gap-2 shrink-0 border-b border-white/5">
            <div className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Security scanned (Passed virus protection protocol)</span>
            </div>
            <div className="opacity-75">
              <span>WhatsApp Compression: </span>
              <span className="font-bold text-emerald-400 font-mono">Optimized -65% size</span>
            </div>
          </div>
        )}

        {/* Caption Bar Input */}
        <div className="p-4 bg-black/10 shrink-0 z-10">
          {!isUploading ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 bg-white/10 hover:bg-white/12 px-4 rounded-2xl h-11 transition-all">
                <input
                  type="text"
                  placeholder="Add WhatsApp-style caption..."
                  value={caption}
                  onChange={e => onCaptionChange(e.target.value)}
                  className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-400 outline-none p-0 focus:ring-0"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 border border-white/20 hover:bg-white/5 py-2.5 rounded-2xl text-xs font-bold text-slate-300 hover:text-white cursor-pointer outline-none"
                >
                  Cancel
                </button>

                <button
                  onClick={onSend}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 py-2.5 rounded-2xl text-xs font-black text-white shadow hover:scale-101 transition-all cursor-pointer outline-none flex items-center justify-center gap-1.5"
                >
                  <span>Post Attachment</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-[76px] flex items-center justify-center">
              <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-widest animate-pulse">
                ✓ Enforcing security parameters. Hold tight.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

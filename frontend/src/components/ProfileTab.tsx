import React, { useState, useRef, useEffect } from 'react';
import { Camera, Check, Edit2, ShieldAlert, Award, User, AtSign, AlignLeft, ShieldCheck, X, Upload, RotateCcw, ZoomIn, Trash2, Eye, ChevronLeft } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

interface ProfileTabProps {
  user: any;
  onUpdateUser: (updatedUser: any) => void;
  theme: 'light' | 'dark';
  onBack?: () => void;
}

export default function ProfileTab({ user, onUpdateUser, theme, onBack }: ProfileTabProps) {
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  
  // Checking states
  const [usernameCheck, setUsernameCheck] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  // Profile photo states
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  
  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [streamObj, setStreamObj] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cropping states
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [isCropActive, setIsCropActive] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean stream on unmount
  useEffect(() => {
    return () => {
      if (streamObj) {
        streamObj.getTracks().forEach(track => track.stop());
      }
    };
  }, [streamObj]);

  const triggerSaveDetails = async (field: 'fullName' | 'bio') => {
    setSavedStatus(null);
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
      const response = await apiFetch('/api/profile/update', {
        method: 'PUT',
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
    try {
      const response = await apiFetch('/api/profile/username', {
        method: 'PUT',
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
    } catch (e) {
      setUsernameCheck('taken');
    }
  };

  // Profile photo API helper
  const saveProfilePhoto = async (photoUrl: string) => {
    try {
      const response = await apiFetch('/api/profile/update', {
        method: 'PUT',
        body: JSON.stringify({ profilePhoto: photoUrl })
      });
      const data = await response.json();
      if (response.ok) {
        onUpdateUser(data.user);
        setSavedStatus('Profile photo updated successfully!');
        setIsCropActive(false);
        setCropImage(null);
        setTimeout(() => setSavedStatus(null), 3500);
      } else {
        alert('Server error saving photo');
      }
    } catch (err) {
      console.error(err);
      alert('Network error saving photo');
    }
  };

  // Camera helpers
  const startCamera = async () => {
    setIsBottomSheetOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' }
      });
      setStreamObj(stream);
      setIsCameraActive(true);
      // Wait a frame for videoRef element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error(err);
      alert('Cannot access device camera. Please make sure permissions are granted.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current video frame on canvas
        ctx.scale(-1, 1); // Mirror effect correction
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        
        // Stop stream
        if (streamObj) {
          streamObj.getTracks().forEach(track => track.stop());
          setStreamObj(null);
        }
        setIsCameraActive(false);

        // Open crop modal
        setZoomScale(1.0);
        setPanOffset({ x: 0, y: 0 });
        setCropImage(dataUrl);
        setIsCropActive(true);
      }
    }
  };

  const closeCamera = () => {
    if (streamObj) {
      streamObj.getTracks().forEach(track => track.stop());
      setStreamObj(null);
    }
    setIsCameraActive(false);
  };

  // File gallery helpers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webkit', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Unsupported file format! Please upload JPG, JPEG, PNG, or WEBP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setIsBottomSheetOpen(false);
      setZoomScale(1.0);
      setPanOffset({ x: 0, y: 0 });
      setCropImage(result);
      setIsCropActive(true);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = async () => {
    setIsBottomSheetOpen(false);
    if (window.confirm('Are you sure you want to remove your profile picture?')) {
      const genericSeed = fullName || user.username || 'default';
      const initialAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(genericSeed)}`;
      await saveProfilePhoto(initialAvatar);
    }
  };

  // Crop interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const generateCrop = () => {
    if (!cropImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 250;
      canvas.height = 250;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Safe canvas crop translation draw
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 250, 250);
        
        ctx.beginPath();
        ctx.arc(125, 125, 125, 0, Math.PI * 2);
        ctx.clip();

        ctx.save();
        ctx.translate(125 + panOffset.x, 125 + panOffset.y);
        ctx.scale(zoomScale, zoomScale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();

        const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        saveProfilePhoto(croppedBase64);
      }
    };
    img.src = cropImage;
  };

  const defaultPhotoSrc = user?.profilePhoto || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username}`;

  return (
    <div className="w-full h-full overflow-y-auto px-5 py-4 flex flex-col gap-5 scrollbar-none bg-app-bg text-app-text-primary transition-colors duration-300 relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden" 
      />

      {onBack && (
        <div className="flex items-center gap-2 pb-2 border-b border-app-border shrink-0">
          <button 
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-black text-app-text-secondary hover:text-app-text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-app-text-secondary" />
            Back to Settings
          </button>
        </div>
      )}

      {/* 1. TOP AVATAR PROFILE PIC CARD */}
      <div className="flex flex-col items-center gap-2 py-4 relative">
        <div className="relative group cursor-pointer" onClick={() => setIsBottomSheetOpen(true)}>
          <img
            src={defaultPhotoSrc}
            alt={user?.fullName || ''}
            className="w-24 h-24 rounded-full object-cover border-4 border-app-border shadow-sm bg-stone-105"
          />
          <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <button className="absolute bottom-0 right-0 p-1.5 bg-app-btn-bg text-app-btn-text rounded-full shadow border-2 border-app-card transition-colors">
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
        <h3 className="text-xl font-extrabold tracking-tight mt-1 text-app-text-primary">{user?.fullName}</h3>
        <p className="text-xs text-app-text-secondary">@{user?.username}</p>
      </div>

      {savedStatus && (
        <div className="p-2.5 text-center text-xs font-semibold bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20">
          ✓ {savedStatus}
        </div>
      )}

      {/* 2. FIELD DATA CARDS */}
      <div className="flex flex-col gap-4">
        
        {/* FULL NAME */}
        <div className="flex flex-col gap-1 bg-app-card p-3.5 rounded-2xl border border-app-border relative shadow-xs transition-colors duration-300">
          <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-app-text-secondary">
            <User className="w-3.5 h-3.5 text-app-text-secondary"/> Full Name
          </label>
          <div className="flex items-center justify-between gap-2 mt-1">
            <input
              type="text"
              value={fullName}
              maxLength={50}
              onChange={e => setFullName(e.target.value)}
              className="flex-1 bg-transparent border-none text-app-text-primary outline-none text-sm font-semibold"
            />
            <button
              onClick={() => triggerSaveDetails('fullName')}
              className="text-xs font-bold text-app-text-primary hover:opacity-85 transition-opacity"
            >
              Save
            </button>
          </div>
          <div className="text-[9px] text-right mt-1 text-app-text-secondary/60">
            {fullName.length} / 50 characters
          </div>
        </div>

        {/* UNIQUE USERNAME Check */}
        <div className="flex flex-col gap-1 bg-app-card p-3.5 rounded-2xl border border-app-border relative shadow-xs transition-colors duration-300">
          <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-app-text-secondary">
            <AtSign className="w-3.5 h-3.5 text-app-text-secondary"/> Username
          </label>
          <div className="flex items-center justify-between gap-2 mt-1">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="flex-1 bg-transparent border-none text-app-text-primary outline-none text-sm font-semibold"
            />
            <button
              onClick={handleUpdateUsername}
              disabled={usernameCheck === 'checking' || username === user.username}
              className="text-xs font-bold text-app-text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {usernameCheck === 'checking' ? 'Validating...' : 'Check & Save'}
            </button>
          </div>
          <span className="text-[9px] text-app-text-secondary mt-1">
            Min 3 characters, alphanumeric with underscores only.
          </span>
        </div>

        {/* BIO / ABOUT */}
        <div className="flex flex-col gap-1 bg-app-card p-3.5 rounded-2xl border border-app-border relative shadow-xs transition-colors duration-300">
          <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-app-text-secondary">
            <AlignLeft className="w-3.5 h-3.5 text-app-text-secondary"/> About / Bio
          </label>
          <div className="flex items-center justify-between gap-2 mt-1">
            <input
              type="text"
              value={bio}
              maxLength={150}
              onChange={e => setBio(e.target.value)}
              className="flex-1 bg-transparent border-none text-app-text-primary outline-none text-sm font-semibold"
            />
            <button
              onClick={() => triggerSaveDetails('bio')}
              className="text-xs font-bold text-app-text-primary hover:opacity-85 transition-opacity"
            >
              Save
            </button>
          </div>
          <div className="text-[9px] text-right mt-1 text-app-text-secondary/60">
            {bio.length} / 150 characters
          </div>
        </div>

        {/* READ ONLY EMAIL */}
        <div className="flex flex-col gap-1 bg-stone-100 dark:bg-stone-900/30 p-3.5 rounded-2xl border border-app-border text-sm shadow-xs transition-colors duration-300">
          <span className="text-[10px] font-bold uppercase tracking-wider text-app-text-secondary">Account Email</span>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm font-semibold select-all text-app-text-primary">{user.email}</span>
            <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500"/> Verified
            </div>
          </div>
        </div>

      </div>

      {/* WHATSAPP-STYLE PROFILE PICTURE OPTIONS BOTTOM SHEET */}
      {isBottomSheetOpen && (
        <div 
          className="absolute inset-0 bg-transparent/40 backdrop-blur-xs flex items-end justify-center z-40 animate-fade-in"
          onClick={() => setIsBottomSheetOpen(false)}
        >
          <div 
            className="w-full bg-white dark:bg-[#1C1C1E] border-t border-stone-200 dark:border-zinc-800 rounded-t-3xl p-5 flex flex-col gap-4 animate-slide-up select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto" />
            <div className="flex justify-between items-center pr-1 mt-1">
              <span className="text-sm font-black text-app-text-primary">Profile Photo Options</span>
              <button 
                onClick={() => setIsBottomSheetOpen(false)}
                className="p-1 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-500 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 text-center py-2 mt-1">
              {/* Option 1: View Photo */}
              <button 
                onClick={() => { setIsBottomSheetOpen(false); setIsViewerOpen(true); }}
                className="flex flex-col items-center gap-2 group cursor-pointer outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:bg-sky-500/20 shadow-xs transition-all">
                  <Eye className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-app-text-secondary">View Photo</span>
              </button>

              {/* Option 2: Gallery */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 group cursor-pointer outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/20 shadow-xs transition-all">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-app-text-secondary">Gallery</span>
              </button>

              {/* Option 3: Camera */}
              <button 
                onClick={startCamera}
                className="flex flex-col items-center gap-2 group cursor-pointer outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-500/20 shadow-xs transition-all">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-app-text-secondary">Take Photo</span>
              </button>

              {/* Option 4: Remove Photo */}
              <button 
                onClick={removePhoto}
                className="flex flex-col items-center gap-2 group cursor-pointer outline-none"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-650 flex items-center justify-center group-hover:bg-red-500/20 shadow-xs transition-all">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-app-text-secondary">Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL PHOTO VIEWER DIALOG */}
      {isViewerOpen && (
        <div 
          className="absolute inset-0 bg-black/95 z-50 flex flex-col justify-between p-5 animate-fade-in text-white/90 select-none"
          onClick={() => setIsViewerOpen(false)}
        >
          <div className="flex justify-between items-center pr-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{user?.fullName}</span>
            <button 
              onClick={() => setIsViewerOpen(false)}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <img 
              src={defaultPhotoSrc} 
              alt={user?.fullName} 
              className="max-w-full max-h-[320px] rounded-full object-cover border-4 border-white/20 shadow-2xl bg-stone-900"
            />
          </div>

          <div className="pb-8 text-center text-[10px] text-stone-500">
            WhatsApp Profile Picture Viewer
          </div>
        </div>
      )}

      {/* TAKE PHOTO DEVICE CAMERA OVERLAY */}
      {isCameraActive && (
        <div className="absolute inset-0 bg-[#0C0C0E] z-50 flex flex-col justify-between p-5 animate-fade-in text-white">
          <div className="flex justify-between items-center pr-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Live Camera</span>
            <button 
              onClick={closeCamera}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-56 h-56 rounded-full border-4 border-amber-500 overflow-hidden shadow-2xl transform scale-x-[-1] relative">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover scale-105"
              />
            </div>
            {/* Camera focal circle overlay */}
            <div className="absolute w-60 h-60 border-2 border-white/30 border-dashed rounded-full pointer-events-none" />
          </div>

          <div className="flex flex-col gap-5 items-center pb-8 select-none">
            <button
              onClick={capturePhoto}
              className="w-14 h-14 rounded-full bg-white text-stone-900 flex items-center justify-center shadow-2xl hover:bg-stone-100 active:scale-95 transition-all border-4 border-transparent active:border-white/40"
              title="Snap Photo"
            >
              <Camera className="w-6 h-6" />
            </button>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide">Position your face inside the circle</p>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE CIRCULAR CROP OVERLAY */}
      {isCropActive && cropImage && (
        <div className="absolute inset-0 bg-[#0E0E10] z-50 flex flex-col justify-between p-5 animate-fade-in text-white select-none">
          <div className="flex justify-between items-center pr-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Crop Profile Photo</span>
            <button 
              onClick={() => { setIsCropActive(false); setCropImage(null); }}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Draggable Circle Cropper Visual Frame */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div 
              className="w-[230px] h-[230px] rounded-full border-4 border-emerald-500 overflow-hidden relative shadow-2xl bg-black flex items-center justify-center cursor-move touch-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <img
                src={cropImage}
                alt="Image to crop"
                draggable={false}
                className="pointer-events-none max-w-none select-none"
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
              />
            </div>
            
            <p className="text-[9px] text-stone-400 uppercase tracking-widest font-black">Drag to adjust center • Zoom below</p>
          </div>

          {/* Cropper controls */}
          <div className="flex flex-col gap-4 pb-8 items-center bg-stone-900/80 p-4 rounded-2xl border border-stone-800">
            {/* Zoom Slider */}
            <div className="w-full flex items-center gap-3 px-2">
              <ZoomIn className="w-4 h-4 text-emerald-400 shrink-0" />
              <input 
                type="range"
                min="0.5"
                max="3.0"
                step="0.05"
                value={zoomScale}
                onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 bg-stone-700 h-1.5 rounded-full outline-none"
              />
              <span className="text-[9px] font-mono leading-none font-bold text-stone-400 shrink-0 w-8 text-right">
                {Math.round(zoomScale * 100)}%
              </span>
            </div>

            <div className="flex justify-between w-full gap-3 mt-1.5">
              <button
                onClick={() => { setIsCropActive(false); setCropImage(null); }}
                className="flex-1 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 font-bold text-xs text-stone-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={generateCrop}
                className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-black text-xs text-white shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Mail, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../utils/api.js';

interface AuthScreensProps {
  onLoginSuccess: (token: string, user: any) => void;
  theme: 'light' | 'dark';
}

export default function AuthScreens({ onLoginSuccess, theme }: AuthScreensProps) {
  const [screen, setScreen] = useState<'splash' | 'onboarding' | 'login' | 'register' | 'otp'>('splash');
  const [onboardIndex, setOnboardIndex] = useState(0);

  // Form States
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);

  // OTP States
  const [otpCode, setOtpCode] = useState<string[]>(Array(6).fill(''));
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(60); // 60 seconds limit for resend
  const [expiryTimer, setExpiryTimer] = useState(300); // 5 minutes (300s) OTP validity

  // General Status Alerts
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [loading, setLoading] = useState(false);

  // Ref array for passcode auto-focus
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle splash transition & auto-login from localStorage if session valid
  useEffect(() => {
    if (screen === 'splash') {
      const timer = setTimeout(() => {
        const cached = localStorage.getItem('dotalk_user');
        const token = localStorage.getItem('dotalk_token');
        if (cached && token && cached !== 'undefined') {
          try {
            onLoginSuccess(token, JSON.parse(cached));
          } catch (e) {
            localStorage.removeItem('dotalk_token');
            localStorage.removeItem('dotalk_user');
            setScreen('onboarding');
          }
        } else {
          setScreen('onboarding');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Timers countdown
  useEffect(() => {
    if (screen === 'otp') {
      const interval = setInterval(() => {
        setResendTimer(prev => (prev > 0 ? prev - 1 : 0));
        setExpiryTimer(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [screen]);

  // Auto focus first OTP input when going to OTP screen
  useEffect(() => {
    if (screen === 'otp') {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 200);
    }
  }, [screen]);

  const resetMessages = () => {
    setErrorText('');
    setSuccessText('');
  };

  const handleNextOnboard = () => {
    if (onboardIndex < 2) {
      setOnboardIndex(prev => prev + 1);
    } else {
      setScreen('login');
    }
  };

  // WhatsApp-like registration (Full Name, Email Only)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessText('Verification code has been sent to your email.');
        setResendTimer(60);
        setExpiryTimer(300);
        setOtpCode(Array(6).fill(''));
        setTimeout(() => {
          setScreen('otp');
          resetMessages();
        }, 1200);
      } else {
        setErrorText(data.error || 'Registration failed');
      }
    } catch (e) {
      setErrorText('Server connectivity issues');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async (codeOverride?: string) => {
    resetMessages();
    setOtpError('');
    setLoading(true);

    const code = codeOverride || otpCode.join('');
    if (code.length < 6) {
      setOtpError('Please insert the entire 6 digit code');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otpCode: code })
      });

      const data = await response.json();
      if (response.ok) {
        if (rememberLogin) {
          localStorage.setItem('dotalk_token', data.accessToken);
          localStorage.setItem('dotalk_user', JSON.stringify(data.user));
        }
        onLoginSuccess(data.accessToken, data.user);
      } else {
        setOtpError(data.error || 'Incorrect OTP code');
      }
    } catch (e) {
      setOtpError('OTP validation offline');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler (60s timer lockdown)
  const handleResendOtp = async () => {
    resetMessages();
    setOtpError('');
    setLoading(true);
    try {
      const response = await apiFetch('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        setResendTimer(60);
        setExpiryTimer(300);
        setOtpCode(Array(6).fill(''));
        setSuccessText('New verification code sent! Check your email.');
        setTimeout(resetMessages, 3000);
      } else {
        setOtpError(data.error || 'Failed to send code');
      }
    } catch (e) {
      setOtpError('Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  // OTP Login Request
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessText('Verification code has been sent to your email.');
        setResendTimer(60);
        setExpiryTimer(300);
        setOtpCode(Array(6).fill(''));
        setTimeout(() => {
          setScreen('otp');
          resetMessages();
        }, 1200);
      } else {
        setErrorText(data.error || 'Email address not found');
      }
    } catch (e) {
      setErrorText('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const onboardingSlides = [
    {
      title: 'Seamless Sockets',
      desc: 'Experience lightning-fast instant messaging with real-time socket connections.',
      image: '🎛️'
    },
    {
      title: 'Secure Groups',
      desc: 'Collaborate with teammates or family by setting admin rights and demoting members.',
      image: '👥'
    },
    {
      title: 'Status Updates',
      desc: 'Post beautiful updates and life stories that self-expire automatically in 24 hours.',
      image: '📸'
    }
  ];

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (val: string, index: number) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    if (!cleanVal) {
      const nextArr = [...otpCode];
      nextArr[index] = '';
      setOtpCode(nextArr);
      return;
    }

    const singleDigit = cleanVal.slice(-1);
    const nextArr = [...otpCode];
    nextArr[index] = singleDigit;
    setOtpCode(nextArr);

    // Auto focus next box
    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (otpCode[index] === '' && index > 0) {
        const nextArr = [...otpCode];
        nextArr[index - 1] = '';
        setOtpCode(nextArr);
        otpRefs.current[index - 1]?.focus();
      } else {
        const nextArr = [...otpCode];
        nextArr[index] = '';
        setOtpCode(nextArr);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
    if (digits.length === 6) {
      setOtpCode(digits);
      otpRefs.current[5]?.focus();
      handleVerifyOtp(digits.join(''));
    }
  };

  return (
    <div className={`w-full h-full flex flex-col justify-between p-6 relative ${
      theme === 'dark' ? 'bg-[#3B2E2B] text-amber-50' : 'bg-[#FEEBC5] text-[#3B2E2B]'
    }`}>
      <AnimatePresence mode="wait">
        
        {/* 1. SPLASH SCREEN */}
        {screen === 'splash' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 py-16"
          >
            <motion.div
              animate={{ scale: [0.9, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-24 h-24 rounded-[32px] bg-[#3B2E2B] text-[#FEEBC5] flex items-center justify-center text-4xl shadow-lg border-2 border-neutral-800"
            >
              💬
            </motion.div>
            <h1 className="text-4xl font-extrabold tracking-wider mt-4">DoTalk</h1>
            <p className="text-sm font-medium opacity-70">Premium Real-Time Mobile Messaging</p>
          </motion.div>
        )}

        {/* 2. ONBOARDING SCREEN */}
        {screen === 'onboarding' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col justify-between py-6"
          >
            <div className="flex justify-end">
              <button onClick={() => setScreen('login')} className="text-sm font-bold opacity-75 hover:opacity-100 cursor-pointer">
                Skip
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center my-6">
              <span className="text-8xl mb-8 animate-bounce">{onboardingSlides[onboardIndex].image}</span>
              <h2 className="text-2xl font-extrabold mb-3 tracking-tight text-app-text-primary">
                {onboardingSlides[onboardIndex].title}
              </h2>
              <p className="text-sm leading-relaxed opacity-85 px-4 text-app-text-secondary">
                {onboardingSlides[onboardIndex].desc}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-center gap-2">
                {onboardingSlides.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                       idx === onboardIndex ? 'w-6 bg-app-btn-bg' : 'w-2.5 bg-stone-300/60'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNextOnboard}
                className="w-full h-12 bg-app-btn-bg text-app-btn-text rounded-xl font-bold flex items-center justify-center gap-2 shadow hover:opacity-90 cursor-pointer"
              >
                {onboardIndex === 2 ? 'Get Started' : 'Next'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. LOGIN SCREEN */}
        {screen === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between py-4"
          >
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-2 text-app-text-primary">Welcome back</h2>
              <p className="text-sm opacity-80 mb-6 text-app-text-secondary">Enter your registered email address. We will send you a 6-digit confirmation code. No passwords required.</p>

              {errorText && (
                <div className="p-3 mb-4 text-xs font-semibold bg-red-100 text-red-600 rounded-lg border border-red-200">
                  ⚠️ {errorText}
                </div>
              )}
              {successText && (
                <div className="p-2.5 mb-3 text-xs font-semibold bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200 flex items-center gap-1">
                  <Check className="w-4 h-4"/> {successText}
                </div>
              )}

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-85">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. natalie@gmail.com"
                      required
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-app-border bg-app-input-bg text-app-input-text placeholder-slate-400 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberLogin}
                    onChange={e => setRememberLogin(e.target.checked)}
                    className="accent-app-btn-bg scale-105 cursor-pointer"
                  />
                  <label htmlFor="remember" className="text-xs font-semibold cursor-pointer select-none opacity-80 text-app-text-primary">
                    Keep me signed in
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-4 bg-app-btn-bg text-app-btn-text rounded-xl font-bold text-sm shadow flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Sending code...' : 'Login'}
                </button>
              </form>
            </div>

            <div className="text-center mt-6">
              <span className="text-xs opacity-80">No account yet? </span>
              <button onClick={() => setScreen('register')} className="text-xs font-bold underline hover:opacity-80 cursor-pointer">
                Create Account
              </button>
            </div>
          </motion.div>
        )}

        {/* 4. REGISTER SCREEN */}
        {screen === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between py-4"
          >
            <div>
              <div className="flex items-center gap-1 mb-2">
                <button onClick={() => setScreen('login')} className="p-1 hover:bg-black/5 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
                <h2 className="text-2xl font-extrabold tracking-tight">Create Account</h2>
              </div>
              <p className="text-xs opacity-80 mb-4 text-app-text-secondary">Register securely with your Name and Email. There are no passwords to remember!</p>

              {errorText && (
                <div className="p-2.5 mb-3 text-xs font-semibold bg-red-100 text-red-600 rounded-lg border border-red-200">
                  ⚠️ {errorText}
                </div>
              )}
              {successText && (
                <div className="p-2.5 mb-3 text-xs font-semibold bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200 flex items-center gap-1">
                  <Check className="w-4 h-4"/> {successText}
                </div>
              )}

              <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase opacity-85">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Natalie Nora"
                      required
                      className="w-full h-10 pl-9 pr-4 rounded-xl border border-app-border bg-app-input-bg text-app-input-text text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase opacity-85 text-app-text-secondary">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                    <input
                      type="email"
                      value={email}
                      required
                      onChange={e => setEmail(e.target.value)}
                      placeholder="natalie@gmail.com"
                      className="w-full h-10 pl-9 pr-4 rounded-xl border border-app-border bg-app-input-bg text-app-input-text text-sm outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 mt-2 bg-app-btn-bg text-app-btn-text rounded-xl font-bold text-sm shadow disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Sending code...' : 'Sign Up'}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* 5. OTP BOX SCREEN */}
        {screen === 'otp' && (
          <motion.div
            key="otp"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex-1 flex flex-col justify-between py-4"
          >
            <div>
              <div className="flex items-center gap-1 mb-2">
                <button onClick={() => setScreen('login')} className="p-1 hover:bg-black/5 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
                <h2 className="text-2xl font-extrabold tracking-tight">Verify Email</h2>
              </div>
              <p className="text-xs opacity-85 leading-relaxed mb-4 text-app-text-secondary">
                Verification code has been sent to your email: <span className="font-bold underline text-app-text-primary">{email}</span>. Valid for 5 minutes.
              </p>

              {otpError && (
                <div className="p-2.5 mb-4 text-xs font-semibold bg-red-100 text-red-600 rounded-lg border border-red-200">
                  ⚠️ {otpError}
                </div>
              )}

              {/* 6 Grid layout with Auto-Focus and Paste Handlers */}
              <div className="flex justify-between gap-2.5 my-4">
                {otpCode.map((val, idx) => (
                  <input
                    key={idx}
                    ref={el => { otpRefs.current[idx] = el; }}
                    type="text"
                    maxLength={1}
                    value={val}
                    onChange={e => handleOtpChange(e.target.value, idx)}
                    onKeyDown={e => handleOtpKeyDown(e, idx)}
                    onPaste={handleOtpPaste}
                    className="w-11 h-12 text-center text-lg font-bold bg-app-input-bg border border-app-border rounded-lg outline-none focus:border-app-btn-bg text-app-input-text"
                  />
                ))}
              </div>

              <div className="text-center mt-6 flex flex-col gap-2">
                <span className="text-xs opacity-75 text-app-text-secondary">
                  Code expires in <span className="font-bold text-[#F44336]">{formatTimer(expiryTimer)}</span>
                </span>
                
                {resendTimer > 0 ? (
                  <span className="text-[11px] opacity-60 text-app-text-secondary">
                    Resend code in <span className="font-bold">{resendTimer}s</span>
                  </span>
                ) : (
                  <button onClick={handleResendOtp} disabled={loading} className="text-xs font-bold underline text-app-text-primary cursor-pointer bg-transparent border-none">
                    {loading ? 'Resending...' : 'Request New Verification Code'}
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => handleVerifyOtp()}
              disabled={loading}
              className="w-full h-11 bg-app-btn-bg text-app-btn-text rounded-xl font-bold text-sm shadow flex items-center justify-center disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

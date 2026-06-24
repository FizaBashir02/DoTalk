import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, 
  Terminal, ShieldAlert, Cpu, Network, Wifi, Play, HelpCircle, HardDrive
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { getBackendUrl, getSocketUrl, getDiagnostics, runConnectivityDiagnostics } from '../utils/api.js';

interface StartupDiagnosticsProps {
  onDiagnosticsPassed: () => void;
  theme?: 'light' | 'dark';
}

export default function StartupDiagnostics({ onDiagnosticsPassed, theme = 'light' }: StartupDiagnosticsProps) {
  const [loading, setLoading] = useState(true);
  const [diagnosingText, setDiagnosingText] = useState('Initializing diagnostics...');
  const [results, setResults] = useState<any>(null);
  
  // Developer options & hidden screen
  const [clickCount, setClickCount] = useState(0);
  const [isDevMode, setIsDevMode] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [showUrlEditor, setShowUrlEditor] = useState(false);

  // Status variables for granular visual feedback
  const [healthStatus, setHealthStatus] = useState<'pending' | 'checking' | 'success' | 'failed'>('pending');
  const [socketStatus, setSocketStatus] = useState<'pending' | 'checking' | 'success' | 'failed'>('pending');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
    console.log(`[DoTalk Startup] ${message}`);
  };

  const handleTitleClick = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount === 5) {
      setIsDevMode(true);
      addLog('Developer Mode Unlocked! Hidden diagnostics console is now visible.');
    }
  };

  const performTests = async () => {
    setLoading(true);
    setHealthStatus('checking');
    setSocketStatus('checking');
    setResults(null);
    setSystemLogs([]);
    
    addLog('Starting full-stack production diagnostics audit...');
    const url = getBackendUrl();
    const wsUrl = getSocketUrl();
    
    addLog(`Configured Backend API URL: "${url || 'EMPTY'}"`);
    addLog(`Configured WebSockets URL: "${wsUrl || 'EMPTY'}"`);
    addLog(`Capacitor Platform detected: "${Capacitor.getPlatform()}"`);
    addLog(`Vite Build Mode: "${import.meta.env.MODE || 'unknown'}"`);

    // Step 1: Base URL Validation
    if (!url || url.trim() === '') {
      addLog('Error: Backend URL is completely missing.');
      setHealthStatus('failed');
      setSocketStatus('failed');
      setResults({
        apiUrl: url,
        isUrlValid: false,
        errorClassification: 'API URL Missing',
        errorMessage: 'VITE_API_URL environment variable is not defined or is empty in the production build.',
        timestamp: new Date().toISOString()
      });
      setLoading(false);
      return;
    }

    const isValid = url.startsWith('http://') || url.startsWith('https://');
    if (!isValid) {
      addLog(`Error: Backend URL "${url}" has an invalid protocol format.`);
      setHealthStatus('failed');
      setSocketStatus('failed');
      setResults({
        apiUrl: url,
        isUrlValid: false,
        errorClassification: 'API URL Invalid',
        errorMessage: 'The loaded API URL lacks a valid protocol. It must start with http:// or https://.',
        timestamp: new Date().toISOString()
      });
      setLoading(false);
      return;
    }

    // Step 2: GET /health check
    addLog('Sending HTTP GET request to /health endpoint...');
    setDiagnosingText('Probing API health check...');
    
    let backendReachable = false;
    let backendHttpStatus: number | null = null;
    let errorClassification: string = 'OK';
    let errorMessage: string | null = null;
    let startHttp = Date.now();

    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      const latency = Date.now() - startHttp;
      backendHttpStatus = response.status;
      backendReachable = response.ok;
      addLog(`HTTP /health response received in ${latency}ms. Status code: ${response.status}`);
    } catch (err: any) {
      const latency = Date.now() - startHttp;
      addLog(`HTTP /health probe failed after ${latency}ms. Error details: ${err.message || err}`);
      
      // Let's check external internet reachability
      let externalInternetOk = false;
      try {
        const dnsTest = await fetch('https://dns.google/resolve?name=google.com', { method: 'GET' });
        externalInternetOk = dnsTest.ok;
        addLog('Device has internet connection (Public DNS query was successful).');
      } catch (dnsErr) {
        externalInternetOk = false;
        addLog('Device seems to have no internet access (Public DNS query failed).');
      }

      if (!externalInternetOk) {
        errorClassification = 'DNS Resolution Failed';
        errorMessage = 'Device DNS lookup failed completely. Please verify that your phone is connected to cellular data or Wifi.';
      } else if (latency > 6000) {
        errorClassification = 'Railway Timeout';
        errorMessage = 'The server did not respond within the timeframe. This usually indicates Railway cold starts, network routing congestion, or server overload.';
      } else if (err.message && (err.message.includes('CORS') || err.message.includes('cors') || err.message.includes('Allowed origins') || err.message.includes('Origin'))) {
        errorClassification = 'CORS Blocked';
        errorMessage = 'The Railway server is online, but its CORS configuration explicitly rejected the request origin from this Capacitor WebView app.';
      } else if (url.startsWith('http://') && Capacitor.getPlatform() === 'android') {
        errorClassification = 'SSL Certificate Error';
        errorMessage = 'Cleartext HTTP connection blocked. Android security policies prohibit plain http:// connections. Use secure, encrypted https://.';
      } else {
        errorClassification = 'Railway Server Offline';
        errorMessage = 'The Railway backend is unreachable or under maintenance. Check if the server is deployed and running on Railway.';
      }
    }

    if (backendReachable) {
      setHealthStatus('success');
      addLog('Backend API health check passed!');
    } else {
      setHealthStatus('failed');
      if (errorClassification === 'OK') {
        errorClassification = 'Railway Server Offline';
        errorMessage = `Server is online but returned unexpected HTTP Status: ${backendHttpStatus}. It might be misconfigured or starting up.`;
      }
    }

    // Step 3: Socket.IO check
    addLog(`Testing WebSockets connection over transports: ["websocket", "polling"] on ${wsUrl}...`);
    setDiagnosingText('Testing active Socket.IO connection...');
    
    let socketReachable = false;
    let socketErrorDetail: string | null = null;

    if (backendReachable) {
      try {
        // We'll import socket.io-client dynamically to test
        const { io } = await import('socket.io-client');
        const testSocket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          timeout: 6000,
          reconnection: false
        });

        const socketConnectPromise = new Promise<boolean>((resolve) => {
          testSocket.on('connect', () => {
            resolve(true);
          });
          testSocket.on('connect_error', (err) => {
            socketErrorDetail = err.message;
            addLog(`Socket.IO connect_error: ${err.message}`);
            resolve(false);
          });
        });

        socketReachable = await socketConnectPromise;
        testSocket.disconnect();
      } catch (sockErr: any) {
        socketReachable = false;
        socketErrorDetail = sockErr.message || String(sockErr);
        addLog(`Socket test library failure: ${socketErrorDetail}`);
      }
    }

    if (socketReachable) {
      setSocketStatus('success');
      addLog('WebSockets connection established successfully!');
    } else {
      setSocketStatus('failed');
      addLog('WebSockets connection failed to establish.');
      if (backendReachable) {
        errorClassification = 'Socket Connection Failed';
        errorMessage = `The HTTP API is responsive, but the WebSocket handshake was rejected. Reason: ${socketErrorDetail || 'Connection timeout'}. Verify CORS and WebSocket transport configurations on Railway.`;
      }
    }

    // Wrap-up diagnostics report
    const finalReport = {
      apiUrl: url,
      apiUrlSource: import.meta.env.VITE_API_URL ? 'import.meta.env.VITE_API_URL' : 'process.env.VITE_API_URL',
      isUrlValid: isValid,
      errorClassification: errorClassification,
      errorMessage: errorMessage,
      backendHttpStatus,
      socketReachable,
      timestamp: new Date().toISOString()
    };

    setResults(finalReport);
    setLoading(false);

    if (finalReport.errorClassification === 'OK' && socketReachable) {
      addLog('All diagnostics passed perfectly! Proceeding to application...');
      // Brief delay for visual polish before entering the app
      setTimeout(() => {
        onDiagnosticsPassed();
      }, 1000);
    } else {
      addLog(`Diagnostics finished with ERROR classification: "${errorClassification}"`);
    }
  };

  useEffect(() => {
    performTests();
  }, []);

  const handleUpdateEnvUrl = () => {
    if (customUrl.trim() !== '') {
      localStorage.setItem('dotalk_custom_api_url', customUrl.trim());
      addLog(`Updated local override API URL to: "${customUrl.trim()}"`);
      setShowUrlEditor(false);
      // Reload page to apply changes
      window.location.reload();
    }
  };

  const handleClearUrlOverride = () => {
    localStorage.removeItem('dotalk_custom_api_url');
    addLog('Removed custom API URL override.');
    setCustomUrl('');
    setShowUrlEditor(false);
    window.location.reload();
  };

  const isDarkMode = theme === 'dark';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      <div className={`w-full max-w-lg rounded-2xl shadow-2xl p-6 border flex flex-col gap-5 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        
        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center select-none" onClick={handleTitleClick}>
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
            <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">DoTalk Server Check</h2>
            <p className="text-xs opacity-65 font-medium mt-0.5">Automated Full-Stack Connection Audit</p>
          </div>
        </div>

        {/* Step List progress */}
        <div className={`p-4 rounded-xl border flex flex-col gap-3 ${
          isDarkMode ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50/60 border-slate-100'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold border-b pb-2 opacity-80">
            <span>DIAGNOSTIC TEST</span>
            <span>STATUS</span>
          </div>

          {/* Test 1: Config & Health */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-sky-500" />
              <span className="font-semibold">HTTP API Reachability (/health)</span>
            </div>
            <span>
              {healthStatus === 'pending' && <span className="text-xs opacity-55">Waiting...</span>}
              {healthStatus === 'checking' && <RefreshCw className="w-4 h-4 text-sky-500 animate-spin" />}
              {healthStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />}
              {healthStatus === 'failed' && <AlertTriangle className="w-5 h-5 text-red-500 fill-red-500/10" />}
            </span>
          </div>

          {/* Test 2: Sockets */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2.5">
              <Network className="w-4 h-4 text-purple-500" />
              <span className="font-semibold">Socket.IO WebSockets Handshake</span>
            </div>
            <span>
              {socketStatus === 'pending' && <span className="text-xs opacity-55">Waiting...</span>}
              {socketStatus === 'checking' && <RefreshCw className="w-4 h-4 text-purple-500 animate-spin" />}
              {socketStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10" />}
              {socketStatus === 'failed' && <AlertTriangle className="w-5 h-5 text-red-500 fill-red-500/10" />}
            </span>
          </div>
        </div>

        {/* Diagnostic analysis summary */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex flex-col items-center justify-center py-6 gap-2"
            >
              <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
              <span className="text-xs font-semibold tracking-wide opacity-80">{diagnosingText}</span>
            </motion.div>
          ) : results ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-4"
            >
              {/* Outcome Alert Panel */}
              <div className={`p-4 rounded-xl border flex gap-3.5 ${
                results.errorClassification === 'OK'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 animate-bounce" />
                <div className="flex-1 text-xs">
                  <h4 className="font-extrabold uppercase tracking-widest text-[11px]">
                    Diagnosis: {results.errorClassification}
                  </h4>
                  <p className="mt-1 leading-relaxed font-medium">
                    {results.errorMessage || 'All backend connection tests successfully validated. The application is completely ready.'}
                  </p>
                </div>
              </div>

              {/* URL currently active display */}
              <div className="flex flex-col gap-1 text-left bg-neutral-500/5 border border-neutral-500/10 p-3 rounded-lg">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Connected API URL Path</span>
                <span className="text-xs font-mono break-all font-semibold select-all">
                  {results.apiUrl || <span className="text-red-500">Unconfigured (VITE_API_URL is empty)</span>}
                </span>
              </div>

              {/* Recommended Action Advice depending on results */}
              {results.errorClassification !== 'OK' && (
                <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 text-xs ${
                  isDarkMode ? 'bg-amber-500/5 border-amber-500/15 text-amber-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-800'
                }`}>
                  <span className="font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <HelpCircle className="w-4 h-4" /> Recommended Solution
                  </span>
                  {results.errorClassification === 'API URL Missing' && (
                    <p className="leading-relaxed">
                      Your production build lacks a specified endpoint. Ensure <code className="bg-black/10 px-1 rounded font-mono">VITE_API_URL</code> is defined in your root <code className="bg-black/10 px-1 rounded font-mono">.env</code> file, then run a fresh build with <code className="bg-black/10 px-1 rounded font-mono">npm run build</code>.
                    </p>
                  )}
                  {results.errorClassification === 'API URL Invalid' && (
                    <p className="leading-relaxed">
                      The loaded environment variable URL is improperly structured. Ensure it starts with <code className="bg-black/10 px-1 rounded font-mono">https://</code> or <code className="bg-black/10 px-1 rounded font-mono">http://</code>.
                    </p>
                  )}
                  {results.errorClassification === 'Railway Server Offline' && (
                    <p className="leading-relaxed">
                      The server is unresponsive. Check your Railway service dashboard to make sure your backend is fully deployed, starts without errors, and has properly bound to port <code className="bg-black/10 px-1 rounded font-mono">3000</code>.
                    </p>
                  )}
                  {results.errorClassification === 'Railway Timeout' && (
                    <p className="leading-relaxed">
                      The request timed out. This is highly typical when serverless containers or shared databases are cold-starting on Railway. Please wait about 30 seconds and click the "Retry connection" button below.
                    </p>
                  )}
                  {results.errorClassification === 'CORS Blocked' && (
                    <p className="leading-relaxed">
                      The backend received the call but blocked it via CORS policies. Verify that the server allows the Capacitor app origin (such as <code className="bg-black/10 px-1 rounded font-mono">capacitor://localhost</code> or <code className="bg-black/10 px-1 rounded font-mono">http://localhost</code>) in its server-side CORS config.
                    </p>
                  )}
                  {results.errorClassification === 'SSL Certificate Error' && (
                    <p className="leading-relaxed">
                      Android actively blocks unsecured cleartext HTTP traffic in production. Update your backend URL protocol to secure <code className="bg-black/10 px-1 rounded font-mono">https://</code> with a valid SSL certificate.
                    </p>
                  )}
                  {results.errorClassification === 'DNS Resolution Failed' && (
                    <p className="leading-relaxed">
                      The domain name lookup failed. Check your device's network configuration, verify cell coverage, and ensure the domain is correct.
                    </p>
                  )}
                  {results.errorClassification === 'Socket Connection Failed' && (
                    <p className="leading-relaxed">
                      The REST API works but the WebSocket connection failed. Verify that WebSocket support and headers proxy are fully configured and functional on your Railway hosting container.
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Custom URL Override Editor (Very helpful for live mobile testing!) */}
        {showUrlEditor && (
          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col gap-2.5 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" /> API URL Override console
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://my-custom-endpoint.railway.app"
                className="flex-1 h-9 px-3 text-xs font-mono rounded bg-black/10 border border-neutral-500/20 outline-none focus:border-amber-500 text-white"
              />
              <button
                onClick={handleUpdateEnvUrl}
                className="px-3 h-9 bg-amber-500 text-slate-950 font-bold rounded text-xs hover:bg-amber-400 cursor-pointer flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Save
              </button>
            </div>
            <div className="flex justify-between items-center text-[10px] opacity-65">
              <span>Enter a fully qualified HTTP/HTTPS url endpoint.</span>
              <button onClick={handleClearUrlOverride} className="underline hover:text-amber-400 cursor-pointer">
                Reset to Built-in env
              </button>
            </div>
          </div>
        )}

        {/* Button controls */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex gap-2">
            <button
              onClick={performTests}
              disabled={loading}
              className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow transition-all duration-150"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
              {loading ? 'Analyzing...' : 'Retry Connection'}
            </button>

            {results && results.errorClassification !== 'OK' && (
              <button
                onClick={onDiagnosticsPassed}
                className="px-5 h-11 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-150"
                title="Proceed to app login screen anyway without validating"
              >
                <Play className="w-3.5 h-3.5" /> Continue
              </button>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] opacity-60 px-1 mt-1">
            <span>Scan timestamp: {results ? new Date(results.timestamp).toLocaleTimeString() : 'scanning...'}</span>
            <button 
              onClick={() => setShowUrlEditor(!showUrlEditor)}
              className="underline hover:text-emerald-500 cursor-pointer"
            >
              {showUrlEditor ? 'Hide Override Console' : 'Override API URL'}
            </button>
          </div>
        </div>

        {/* Developer / Hidden Diagnostics Console */}
        {isDevMode && (
          <div className="border-t pt-4 mt-2 flex flex-col gap-3 text-left">
            <h3 className="font-bold text-xs uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 animate-spin" /> Hidden Diagnostics Screen
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-black/15 rounded flex flex-col gap-0.5">
                <span className="opacity-60 uppercase font-bold text-[9px] tracking-wider">Capacitor Platform</span>
                <span className="font-semibold font-mono">{Capacitor.getPlatform()}</span>
              </div>
              <div className="p-2 bg-black/15 rounded flex flex-col gap-0.5">
                <span className="opacity-60 uppercase font-bold text-[9px] tracking-wider">Vite Build Mode</span>
                <span className="font-semibold font-mono">{import.meta.env.MODE}</span>
              </div>
              <div className="p-2 bg-black/15 rounded flex flex-col gap-0.5 col-span-2">
                <span className="opacity-60 uppercase font-bold text-[9px] tracking-wider">Environment Variables Loaded</span>
                <div className="flex flex-col gap-1 font-mono text-[10px] mt-1 bg-black/10 p-1.5 rounded">
                  <div>VITE_API_URL: "{import.meta.env.VITE_API_URL || 'undefined'}"</div>
                  <div>VITE_BACKEND_URL: "{import.meta.env.VITE_BACKEND_URL || 'undefined'}"</div>
                  <div>VITE_WS_URL: "{import.meta.env.VITE_WS_URL || 'undefined'}"</div>
                </div>
              </div>
              <div className="p-2 bg-black/15 rounded flex flex-col gap-0.5 col-span-2">
                <span className="opacity-60 uppercase font-bold text-[9px] tracking-wider">Backend Health Check Response</span>
                <span className="font-semibold font-mono truncate">
                  Status Code: {results?.backendHttpStatus !== null ? results.backendHttpStatus : 'N/A'} (Reachable: {results?.backendHttpStatus === 200 ? 'YES' : 'NO'})
                </span>
              </div>
              <div className="p-2 bg-black/15 rounded flex flex-col gap-0.5 col-span-2">
                <span className="opacity-60 uppercase font-bold text-[9px] tracking-wider">Socket Connection Status</span>
                <span className="font-semibold font-mono truncate">
                  Handshake Ok: {results?.socketReachable ? 'YES' : 'NO'}
                </span>
              </div>
            </div>

            {/* Logs console */}
            <div className="flex flex-col gap-1.5">
              <span className="font-bold text-[10px] uppercase tracking-wider opacity-60">System Log Terminal</span>
              <div className="h-36 overflow-y-auto bg-black p-2.5 rounded-lg text-[9px] font-mono leading-relaxed text-emerald-400 flex flex-col gap-1 select-all border border-emerald-500/10">
                {systemLogs.map((log, index) => (
                  <div key={index} className="break-all whitespace-pre-wrap">{log}</div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

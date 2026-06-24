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
    
    addLog('Starting automated production diagnostics check...');
    try {
      const report = await runConnectivityDiagnostics();
      
      addLog(`Configured Backend API URL: "${report.apiUrl || 'EMPTY'}"`);
      addLog(`Source: "${report.apiUrlSource}"`);
      addLog(`Vite Build Mode: "${report.buildMode || 'unknown'}"`);
      addLog(`Capacitor Platform: "${report.capacitorPlatform || 'web'}"`);
      addLog(`Internet state: ${report.isOnline ? 'Online' : 'Offline'}`);
      addLog(`External internet reachability: ${report.externalInternetOk ? 'YES' : 'NO'}`);
      addLog(`Tested Fetch URL: "${report.fetchUrl}"`);
      addLog(`HTTP Status: ${report.backendHttpStatus !== null ? report.backendHttpStatus : 'No Response'}`);
      
      if (report.responseBody) {
        addLog(`Response Body: "${report.responseBody.substring(0, 200)}"`);
      }
      if (report.exceptionMessage) {
        addLog(`Exception: "${report.exceptionMessage}"`);
      }
      if (report.exceptionStack) {
        addLog(`Exception stack: "${report.exceptionStack.substring(0, 200)}..."`);
      }

      setHealthStatus(report.backendReachable ? 'success' : 'failed');
      setSocketStatus(report.socketReachable ? 'success' : 'failed');
      
      setResults(report);
      setLoading(false);

      if (report.errorClassification === 'OK' && report.socketReachable) {
        addLog('All diagnostics passed! Proceeding to application...');
        setTimeout(() => {
          onDiagnosticsPassed();
        }, 1200);
      } else {
        addLog(`Diagnostics finished with Error category: "${report.errorClassification}"`);
      }
    } catch (err: any) {
      addLog(`Diagnostics crashed with fatal exception: ${err.message}`);
      setHealthStatus('failed');
      setSocketStatus('failed');
      setResults({
        apiUrl: getBackendUrl(),
        isUrlValid: false,
        errorClassification: 'UNKNOWN',
        errorMessage: `Diagnostics system error: ${err.message}`,
        timestamp: new Date().toISOString(),
        exceptionMessage: err.message
      });
      setLoading(false);
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

              {/* Detailed Technical Specs for Verification */}
              <div className="flex flex-col gap-2 text-left bg-neutral-500/5 border border-neutral-500/10 p-3 rounded-lg">
                <div className="flex flex-col gap-0.5 border-b border-neutral-500/10 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Connected API URL Path</span>
                  <span className="text-xs font-mono break-all font-semibold select-all">
                    {results.apiUrl || <span className="text-red-500">Unconfigured (VITE_API_URL is empty)</span>}
                  </span>
                </div>

                {results.fetchUrl && (
                  <div className="flex flex-col gap-0.5 border-b border-neutral-500/10 pb-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Tested Fetch URL</span>
                    <span className="text-xs font-mono break-all font-semibold select-all">
                      {results.fetchUrl}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 border-b border-neutral-500/10 pb-2 pt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">HTTP Status Code</span>
                    <span className="text-xs font-mono font-semibold">
                      {results.backendHttpStatus !== null ? results.backendHttpStatus : 'None (HTTP Failed)'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Socket.IO State</span>
                    <span className="text-xs font-mono font-semibold">
                      {results.socketReachable ? 'Connected' : results.backendReachable ? 'Handshake Failed' : 'N/A'}
                    </span>
                  </div>
                </div>

                {results.responseBody && (
                  <div className="flex flex-col gap-0.5 border-b border-neutral-500/10 pb-2 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Response Body</span>
                    <pre className="text-[10px] font-mono leading-tight bg-black/25 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap select-all">
                      {results.responseBody}
                    </pre>
                  </div>
                )}

                {results.exceptionMessage && (
                  <div className="flex flex-col gap-0.5 pt-1 text-red-500 dark:text-red-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">JavaScript Exception</span>
                    <pre className="text-[10px] font-mono leading-normal bg-red-500/5 p-2 rounded border border-red-500/10 max-h-24 overflow-y-auto whitespace-pre-wrap select-all">
                      {results.exceptionMessage}
                    </pre>
                  </div>
                )}

                {results.errorName && (
                  <div className="flex flex-col gap-2 border-t border-neutral-500/10 pt-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
                      Real Fetch Exception Breakdown
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono leading-relaxed">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase opacity-50">error.name</span>
                        <span className="font-semibold text-red-600 dark:text-red-300">{results.errorName}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase opacity-50">error.message</span>
                        <span className="font-semibold text-red-600 dark:text-red-300">{results.realErrorMessage || results.errorMessage}</span>
                      </div>
                      <div className="flex flex-col md:col-span-2">
                        <span className="text-[9px] font-bold uppercase opacity-50">requested URL</span>
                        <span className="break-all text-neutral-600 dark:text-neutral-300">{results.realRequestedUrl || results.fetchUrl}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase opacity-50">HTTP Status</span>
                        <span className="font-semibold text-neutral-600 dark:text-neutral-300">{results.realHttpStatus !== undefined ? String(results.realHttpStatus) : 'N/A'}</span>
                      </div>
                      <div className="flex flex-col md:col-span-2">
                        <span className="text-[9px] font-bold uppercase opacity-50">response body</span>
                        <pre className="text-[10px] bg-black/25 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">
                          {results.realResponseBody || results.responseBody || 'None'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
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

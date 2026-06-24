import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Globe, 
  Heart, 
  ShieldAlert, 
  RefreshCw, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Terminal,
  Database,
  Wifi,
  Server
} from 'lucide-react';
import { getDebugInfo, runConnectivityDiagnostics, DebugInfo } from '../utils/api';

interface DebugPageProps {
  onBack: () => void;
  isDarkMode?: boolean;
}

export function DebugPage({ onBack, isDarkMode = true }: DebugPageProps) {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isRunningProbes, setIsRunningProbes] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const refreshDebugInfo = () => {
    setDebugInfo(getDebugInfo());
  };

  useEffect(() => {
    refreshDebugInfo();
  }, []);

  const handleRunProbes = async () => {
    setIsRunningProbes(true);
    try {
      await runConnectivityDiagnostics();
      refreshDebugInfo();
      setToastMessage('Diagnostics completed successfully.');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err: any) {
      setToastMessage(`Diagnostics failed: ${err.message}`);
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setIsRunningProbes(false);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col ${
      isDarkMode ? 'bg-[#2B2321] text-[#FEEBC5]' : 'bg-[#FFF9EE] text-[#3B2E2B]'
    } transition-colors duration-300`}>
      
      {/* HEADER BAR */}
      <div className={`h-14 px-4 flex items-center justify-between border-b shrink-0 ${
        isDarkMode ? 'border-[#5A4A45] bg-[#3B2E2B]' : 'border-[#E8D6B3] bg-[#FEEBC5]'
      }`}>
        <button 
          onClick={onBack}
          className="p-1 rounded-lg hover:bg-neutral-500/10 cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-amber-500" /> DoTalk Core Debug
        </span>
        <button 
          onClick={refreshDebugInfo}
          disabled={isRunningProbes}
          className="p-1 rounded-lg hover:bg-neutral-500/10 cursor-pointer disabled:opacity-50"
          title="Refresh Display Info"
        >
          <RefreshCw className={`w-4 h-4 ${isRunningProbes ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* BODY CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-none pb-8">
        
        {toastMessage && (
          <div className="bg-amber-500 text-slate-950 font-bold p-3 rounded-xl text-xs flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* CORE ACTION MODULE */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-3 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider">Diagnostic Controller</h3>
              <p className="text-[10px] text-neutral-400 mt-0.5">Force a full-stack connection and backend diagnostics trace</p>
            </div>
            <button
              onClick={handleRunProbes}
              disabled={isRunningProbes}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningProbes ? 'animate-spin' : ''}`} />
              {isRunningProbes ? 'Probing...' : 'Run Diagnostics'}
            </button>
          </div>
        </div>

        {/* 1. CURRENT API URL */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-65 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> API Server Base Endpoint
          </span>
          <div className="text-xs font-mono bg-black/20 p-3 rounded-lg break-all select-all leading-relaxed font-semibold">
            {debugInfo?.currentApiUrl || <span className="text-red-500 italic">Unconfigured (empty env URL)</span>}
          </div>
        </div>

        {/* 2. GET /HEALTH ENDPOINT PROBE */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-65 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> GET /health Endpoint Result
            </span>
            {debugInfo?.healthResult?.status === 200 ? (
              <span className="text-emerald-500 font-extrabold uppercase tracking-widest text-[9px]">Healthy</span>
            ) : (
              <span className="text-red-500 font-extrabold uppercase tracking-widest text-[9px]">Unreachable</span>
            )}
          </span>

          {debugInfo?.healthResult ? (
            <div className="flex flex-col gap-2 text-xs font-mono bg-black/10 p-3 rounded-lg">
              <div className="flex justify-between border-b border-white/5 pb-1 text-[11px]">
                <span className="text-neutral-400">HTTP Status:</span>
                <span className={`font-bold ${debugInfo.healthResult.status === 200 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {debugInfo.healthResult.status !== null ? debugInfo.healthResult.status : 'No Response'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-neutral-400 text-[10px] uppercase font-bold">Response Body:</span>
                <pre className="p-2 bg-black/35 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight text-neutral-300">
                  {debugInfo.healthResult.body || <span className="italic text-neutral-500">Empty response body</span>}
                </pre>
              </div>
              {debugInfo.healthResult.error && (
                <div className="flex flex-col gap-0.5 mt-1 text-red-400">
                  <span className="text-[10px] uppercase font-bold">JavaScript Exception:</span>
                  <pre className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight">
                    {debugInfo.healthResult.error}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-neutral-500 pl-1">No health probe logs. Please run a diagnostic test.</p>
          )}
        </div>

        {/* 3. GET / ROOT ENDPOINT PROBE */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-65 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" /> GET / Root Endpoint Result
            </span>
            {debugInfo?.rootResult?.status === 200 ? (
              <span className="text-emerald-500 font-extrabold uppercase tracking-widest text-[9px]">Healthy</span>
            ) : (
              <span className="text-red-500 font-extrabold uppercase tracking-widest text-[9px]">Unreachable</span>
            )}
          </span>

          {debugInfo?.rootResult ? (
            <div className="flex flex-col gap-2 text-xs font-mono bg-black/10 p-3 rounded-lg">
              <div className="flex justify-between border-b border-white/5 pb-1 text-[11px]">
                <span className="text-neutral-400">HTTP Status:</span>
                <span className={`font-bold ${debugInfo.rootResult.status === 200 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {debugInfo.rootResult.status !== null ? debugInfo.rootResult.status : 'No Response'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="text-neutral-400 text-[10px] uppercase font-bold">Response Body:</span>
                <pre className="p-2 bg-black/35 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight text-neutral-300">
                  {debugInfo.rootResult.body || <span className="italic text-neutral-500">Empty response body</span>}
                </pre>
              </div>
              {debugInfo.rootResult.error && (
                <div className="flex flex-col gap-0.5 mt-1 text-red-400">
                  <span className="text-[10px] uppercase font-bold">JavaScript Exception:</span>
                  <pre className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight">
                    {debugInfo.rootResult.error}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-neutral-500 pl-1">No root probe logs. Please run a diagnostic test.</p>
          )}
        </div>

        {/* 4. SOCKET STATUS */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-65 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" /> Active Socket.IO Handshake Status
            </span>
            <span className={`font-extrabold uppercase tracking-widest text-[9px] ${
              debugInfo?.socketStatus?.state === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-red-500'
            }`}>
              {debugInfo?.socketStatus?.state || 'Disconnected'}
            </span>
          </span>

          {debugInfo?.socketStatus ? (
            <div className="flex flex-col gap-2 text-xs font-mono bg-black/10 p-3 rounded-lg">
              <div className="flex justify-between border-b border-white/5 pb-1 text-[11px]">
                <span className="text-neutral-400">Socket Server URL:</span>
                <span className="text-neutral-300 font-semibold truncate max-w-[180px] text-right">{debugInfo.socketStatus.url}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1 pt-1 text-[11px]">
                <span className="text-neutral-400">Connection State:</span>
                <span className={`font-extrabold uppercase ${debugInfo.socketStatus.state === 'connected' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {debugInfo.socketStatus.state}
                </span>
              </div>
              {debugInfo.socketStatus.error && (
                <div className="flex flex-col gap-0.5 mt-1 text-red-400">
                  <span className="text-[10px] uppercase font-bold">Handshake Error:</span>
                  <pre className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight">
                    {debugInfo.socketStatus.error}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-neutral-500 pl-1">No socket probe logs. Please run a diagnostic test.</p>
          )}
        </div>

        {/* 5. LAST FETCH ERROR */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Last Fetch Error Record
          </span>

          {debugInfo?.lastFetchError ? (
            <div className="flex flex-col gap-2 text-xs font-mono bg-black/10 p-3 rounded-lg">
              <div className="flex justify-between border-b border-white/5 pb-1 text-[11px]">
                <span className="text-neutral-400">Requested URL:</span>
                <span className="text-neutral-300 truncate max-w-[180px] text-right" title={debugInfo.lastFetchError.url}>
                  {debugInfo.lastFetchError.url}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1 pt-1 text-[11px]">
                <span className="text-neutral-400">HTTP Method:</span>
                <span className="text-neutral-300 font-extrabold">{debugInfo.lastFetchError.method}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1 pt-1 text-[11px]">
                <span className="text-neutral-400">HTTP Status:</span>
                <span className="text-neutral-300 font-bold">
                  {debugInfo.lastFetchError.statusCode !== null ? debugInfo.lastFetchError.statusCode : 'Failed/No Status'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1 pt-1 text-[11px]">
                <span className="text-neutral-400">Timestamp:</span>
                <span className="text-neutral-400 text-[10px]">
                  {new Date(debugInfo.lastFetchError.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1 text-red-400">
                <span className="text-[10px] uppercase font-bold">Actual Exception:</span>
                <pre className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight select-all">
                  {debugInfo.lastFetchError.exceptionMessage}
                </pre>
              </div>
              {debugInfo.lastFetchError.exceptionStack && (
                <div className="flex flex-col gap-0.5 mt-1 text-neutral-400">
                  <span className="text-[10px] uppercase font-bold opacity-60">Stack Trace:</span>
                  <pre className="p-2 bg-black/30 rounded text-[9px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight select-all">
                    {debugInfo.lastFetchError.exceptionStack}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-neutral-500 pl-1">No recorded fetch errors yet.</p>
          )}
        </div>

        {/* 6. LAST SOCKET ERROR */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
          isDarkMode ? 'bg-stone-900/40 border-[#5A4A45]' : 'bg-stone-50 border-[#E8D6B3]'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Last Socket Error Record
          </span>

          {debugInfo?.lastSocketError ? (
            <div className="flex flex-col gap-2 text-xs font-mono bg-black/10 p-3 rounded-lg">
              <div className="flex justify-between border-b border-white/5 pb-1 text-[11px]">
                <span className="text-neutral-400">Socket URL:</span>
                <span className="text-neutral-300 truncate max-w-[180px] text-right" title={debugInfo.lastSocketError.url}>
                  {debugInfo.lastSocketError.url}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1 pt-1 text-[11px]">
                <span className="text-neutral-400">Timestamp:</span>
                <span className="text-neutral-400 text-[10px]">
                  {new Date(debugInfo.lastSocketError.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-1 text-red-400">
                <span className="text-[10px] uppercase font-bold">Error Message:</span>
                <pre className="p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight select-all">
                  {debugInfo.lastSocketError.error}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-xs italic text-neutral-500 pl-1">No recorded socket errors yet.</p>
          )}
        </div>

      </div>
    </div>
  );
}

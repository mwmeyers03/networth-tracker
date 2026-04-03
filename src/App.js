import React, { useState, useEffect, useCallback } from 'react';
import { DataProvider } from './contexts/DataContext';
import Dashboard from './components/Dashboard';
import DataLedger from './components/DataLedger';
import Retirement from './components/Retirement';
import Budget from './components/Budget';
import AIWorkbench from './components/AIWorkbench';
import Controls from './components/Controls';
import { Settings, X, LayoutDashboard, Table2, TrendingUp, Wallet, Cpu, WifiOff, Bot, MessageSquare } from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ledger', label: 'Ledger', icon: Table2 },
  { id: 'retirement', label: 'Retirement', icon: TrendingUp },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'ai', label: 'AI', icon: Bot },
];

// ── Ollama connectivity probe ─────────────────────────────────────────────────
const OLLAMA_BASE_URL = process.env.REACT_APP_OLLAMA_BASE_URL || 'http://localhost:11434/api/generate';
const OLLAMA_HEALTH_URL = OLLAMA_BASE_URL.replace('/api/generate', '/api/tags');
const ENABLE_FREE_WEB_LLM =
  String(process.env.REACT_APP_ENABLE_FREE_WEB_LLM ?? 'true').toLowerCase() !== 'false';
const HAS_CLOUD_ENDPOINT = Boolean(process.env.REACT_APP_CLOUD_LLM_URL);

const isElectronRuntime =
  typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const isBrowserMixedContentRisk = () => {
  if (typeof window === 'undefined') return false;
  if (isElectronRuntime) return false;
  if (window.location.protocol !== 'https:') return false;
  return /^http:\/\//i.test(OLLAMA_BASE_URL);
};

const hasWebFallback = HAS_CLOUD_ENDPOINT || ENABLE_FREE_WEB_LLM;

function useOllamaStatus() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'starting' | 'online' | 'offline' | 'cloud'

  const check = useCallback(async () => {
    if (isBrowserMixedContentRisk()) {
      setStatus(hasWebFallback ? 'cloud' : 'offline');
      return;
    }

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(OLLAMA_HEALTH_URL, { signal: controller.signal });
      setStatus(res.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    } finally {
      clearTimeout(timerId);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootAndCheck = async () => {
      if (window.electronAPI?.ensureOllamaRunning) {
        if (mounted) setStatus('starting');
        await window.electronAPI.ensureOllamaRunning().catch(() => null);
      }
      if (mounted) check();
    };

    bootAndCheck();
    const id = setInterval(check, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [check]);

  return status;
}

function OllamaStatusBadge({ status }) {
  if (status === 'checking') return null;
  if (status === 'starting') {
    return (
      <div
        title="Starting Ollama local server"
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-sky-500/10 border-sky-500/30 text-sky-300"
      >
        <Cpu size={10} />
        Starting AI
      </div>
    );
  }

  if (status === 'cloud') {
    return (
      <div
        title="Using HTTPS web AI fallback"
        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
      >
        <Bot size={10} />
        Web AI
      </div>
    );
  }

  const online = status === 'online';
  return (
    <div
      title={online ? 'Ollama is running locally' : 'Ollama not detected – AI features unavailable'}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        online
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-slate-800 border-slate-700 text-slate-500'
      }`}
    >
      {online ? <Cpu size={10} /> : <WifiOff size={10} />}
      {online ? 'Ollama' : 'No AI'}
    </div>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const ollamaStatus = useOllamaStatus();

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>

      {/* ── Top Header ── */}
      <header className="sticky top-0 z-20 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Net Worth Tracker</h1>
              <p className="text-[10px] text-slate-400 leading-tight mt-0.5">FIRE Calculator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OllamaStatusBadge status={ollamaStatus} />
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open settings"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Settings size={18} className="text-slate-300" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-t border-slate-800 overflow-x-auto scrollbar-none">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === id
                  ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'ledger' && <DataLedger />}
        {activeTab === 'retirement' && <Retirement />}
        {activeTab === 'budget' && <Budget />}
        {activeTab === 'ai' && <AIWorkbench />}
      </main>

      {/* ── Settings Drawer (right side on desktop, full-screen on mobile) ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-slate-900 border-l border-slate-800 overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-sky-400" />
                <h2 className="text-sm font-bold text-white">Assumptions & Controls</h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
                aria-label="Close settings"
                title="Close (Esc)"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Controls onClose={() => setDrawerOpen(false)} />
            </div>
          </div>
        </>
      )}

      {/* ── Floating AI Dock ── */}
      {!assistantOpen && (
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-sky-600 hover:bg-sky-500 border border-sky-400/30 shadow-lg flex items-center justify-center"
          title="Open AI Copilot"
          aria-label="Open AI Copilot"
        >
          <MessageSquare size={18} className="text-white" />
        </button>
      )}

      {assistantOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[430px] max-w-[calc(100vw-1.5rem)] h-[72vh] max-h-[760px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
              <Bot size={15} className="text-sky-400" />
              AI Copilot Window
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="w-7 h-7 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center"
              title="Close AI window"
              aria-label="Close AI window"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <AIWorkbench compact />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
import React from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  Archive, 
  Settings, 
  Sun, 
  Moon, 
  Plus, 
  Menu, 
  Radio
} from 'lucide-react';
import { ViewMode, WebhookSettings } from '../types';

interface NavbarProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSettings: () => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  settings: WebhookSettings | null;
  syncConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  viewMode,
  onViewChange,
  darkMode,
  onToggleDarkMode,
  onOpenSettings,
  onNewChat,
  onToggleSidebar,
  settings,
  syncConnected,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full px-3 py-2.5 md:px-6 md:py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between glass-panel rounded-2xl px-3 py-2 md:px-5 md:py-2.5 shadow-lg">
        
        {/* Left: Brand & Mobile Menu */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            id="mobile-menu-btn"
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl glass-pill text-slate-700 dark:text-slate-200 hover:text-cyan-500 transition-colors"
            aria-label="Toggle navigation drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onViewChange('chat')}>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md text-white">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm md:text-base tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent font-['Outfit']">
                  Glass AI
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-400/30">
                  Activepieces
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">
                iOS 26 Frosted Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Center: View Switcher (Chat vs. Dashboard) */}
        <div className="flex items-center p-1 rounded-xl glass-pill border border-white/20 dark:border-white/10 shadow-inner">
          <button
            id="nav-chat-btn"
            onClick={() => onViewChange('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
              viewMode === 'chat'
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 shadow-sm border border-cyan-400/30 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            id="nav-dashboard-btn"
            onClick={() => onViewChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 ${
              viewMode === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 shadow-sm border border-cyan-400/30 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Archived</span> Logs
          </button>
        </div>

        {/* Right: Actions & Indicators */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Realtime Sync & Webhook status indicator */}
          <button
            id="sync-status-indicator"
            onClick={onOpenSettings}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium glass-pill hover:border-cyan-500/40 transition-colors"
            title="Activepieces Webhook & Real-time Sync Status"
          >
            <Radio className={`w-3 h-3 ${syncConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="text-slate-600 dark:text-slate-300">
              {syncConnected ? 'Live Sync' : 'Connecting'}
            </span>
            {settings?.lastStatus && (
              <span className={`px-1.5 py-0.2 text-[9px] rounded-full font-mono ${
                settings.lastStatus < 400 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-rose-500/20 text-rose-400'
              }`}>
                {settings.lastStatus}
              </span>
            )}
          </button>

          {/* New Chat button */}
          <button
            id="nav-new-chat-btn"
            onClick={onNewChat}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>

          {/* Settings button */}
          <button
            id="nav-settings-btn"
            onClick={onOpenSettings}
            className="p-2 rounded-xl glass-pill text-slate-600 dark:text-slate-300 hover:text-cyan-500 transition-colors"
            title="Webhook & DB Configuration"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            id="theme-toggle-btn"
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl glass-pill text-slate-600 dark:text-slate-300 hover:text-amber-400 dark:hover:text-amber-300 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>

      </div>
    </header>
  );
};

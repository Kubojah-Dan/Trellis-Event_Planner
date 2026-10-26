import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Calendar, ChevronDown, LogOut, User, Plus, RefreshCw } from 'lucide-react';

interface NavbarProps {
  currentEventTitle?: string;
  syncStatus?: 'synced' | 'syncing' | 'offline';
}

export const Navbar: React.FC<NavbarProps> = ({ currentEventTitle, syncStatus = 'synced' }) => {
  const { user, signOut, switchDemoUser, signInWithGoogle } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-warmgray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-6">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-evergreen-900 flex items-center justify-center text-white shadow-sm group-hover:bg-evergreen-800 transition-colors">
              <Sparkles className="w-5 h-5 text-coral-500" />
            </div>
            <div>
              <span className="font-editorial text-xl font-bold text-evergreen-900 tracking-tight">
                Trellis
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-evergreen-50 text-evergreen-800 border border-evergreen-100">
                Celebration Studio
              </span>
            </div>
          </Link>

          {/* Active Event Indicator */}
          {currentEventTitle && (
            <div className="hidden md:flex items-center space-x-2 border-l border-warmgray-200 pl-6">
              <Calendar className="w-4 h-4 text-ink-muted" />
              <span className="text-sm font-semibold text-ink truncate max-w-[220px]">
                {currentEventTitle}
              </span>
            </div>
          )}
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center space-x-4">
          {/* Sync indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-ink-muted bg-paper px-2.5 py-1 rounded-md border border-warmgray-200">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced'
                  ? 'bg-emerald-500'
                  : syncStatus === 'syncing'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-warmgray-400'
              }`}
            />
            <span className="capitalize">{syncStatus}</span>
          </div>

          {/* New Event Button */}
          <button
            onClick={() => navigate('/events/new')}
            className="btn-primary text-xs py-2 px-3 sm:px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">New Celebration</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* User Profile & Demo Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-1.5 rounded-lg border border-warmgray-200 bg-surface hover:bg-warmgray-100 transition-colors focus-ring"
              aria-label="User Account Menu"
            >
              <div className="w-7 h-7 rounded-full bg-evergreen-100 text-evergreen-800 flex items-center justify-center font-bold text-xs">
                {user?.displayName ? user.displayName.charAt(0) : <User className="w-4 h-4" />}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-ink max-w-[100px] truncate">
                {user?.displayName || 'Sign in'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-surface rounded-xl shadow-warm-lg border border-warmgray-200 py-2 z-50 text-xs">
                <div className="px-4 py-2 border-b border-warmgray-200">
                  <p className="font-semibold text-ink">{user?.displayName || 'Guest'}</p>
                  <p className="text-ink-muted truncate">{user?.email || 'No email associated'}</p>
                  {user?.isDemoUser && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                      Local Development Profile
                    </span>
                  )}
                </div>

                {/* Local Demo Account Switcher */}
                <div className="px-4 py-2 border-b border-warmgray-200 bg-paper/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                    Switch Test Account (ACL Isolation)
                  </p>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        switchDemoUser('user-maya', 'Maya Lin (Organizer)', 'maya@example.com');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-surface text-ink flex items-center justify-between"
                    >
                      <span>Maya Lin (Organizer)</span>
                      {user?.uid === 'user-maya' && <span className="text-emerald-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => {
                        switchDemoUser('user-leo', 'Leo Rivera (Co-host)', 'leo@example.com');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-surface text-ink flex items-center justify-between"
                    >
                      <span>Leo Rivera (Co-host)</span>
                      {user?.uid === 'user-leo' && <span className="text-emerald-600 font-bold">✓</span>}
                    </button>
                    <button
                      onClick={() => {
                        switchDemoUser('user-alex', 'Alex Chen (Guest)', 'alex@example.com');
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-surface text-ink flex items-center justify-between"
                    >
                      <span>Alex Chen (Guest)</span>
                      {user?.uid === 'user-alex' && <span className="text-emerald-600 font-bold">✓</span>}
                    </button>
                  </div>
                </div>

                <div className="px-2 pt-1">
                  {!user?.isDemoUser && user ? (
                    <button
                      onClick={() => {
                        signOut();
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-coral-600 hover:bg-coral-50 flex items-center space-x-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        signInWithGoogle().catch(() => {});
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-evergreen-800 hover:bg-evergreen-50 flex items-center space-x-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

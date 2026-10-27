import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChevronDown, LogOut, User, Plus, Calendar } from 'lucide-react';

interface NavbarProps {
  currentEventTitle?: string;
  syncStatus?: 'synced' | 'syncing' | 'offline';
}

export const Navbar: React.FC<NavbarProps> = ({ currentEventTitle, syncStatus = 'synced' }) => {
  const { user, signOut, openAuthModal } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="relative z-30 w-full px-6 sm:px-10 py-5 grid grid-cols-[auto_1fr_auto] items-center text-sm border-b border-bark/8 bg-cream/80 backdrop-blur-md">
      {/* Brand Logo matching template design */}
      <div className="flex items-center space-x-6">
        <Link to="/" className="flex items-center gap-2.5 font-serif text-2xl tracking-wide text-bark group">
          <img
            src="/assets/img/logo.png"
            alt="Trellis"
            className="w-8 h-8 object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-serif">
            T<em className="text-terra italic font-serif">rellis</em>
          </span>
        </Link>

        {/* Active Celebration Badge */}
        {currentEventTitle && (
          <div className="hidden lg:flex items-center gap-2 pl-6 border-l border-bark/10 text-xs font-medium text-ink-muted">
            <Calendar className="w-3.5 h-3.5 text-moss" />
            <span className="text-ink font-semibold truncate max-w-[200px]">{currentEventTitle}</span>
          </div>
        )}
      </div>

      {/* Centered Editorial Navigation Links */}
      <ul className="hidden md:flex gap-8 justify-self-center list-none text-[15px] font-medium text-bark">
        <li>
          <Link to="/" className="hover:text-terra transition-colors">
            Overview
          </Link>
        </li>
        <li>
          <Link to="/events/new" className="hover:text-terra transition-colors">
            Discovery
          </Link>
        </li>
        <li>
          <a href="#how-it-works" className="hover:text-terra transition-colors">
            How It Works
          </a>
        </li>
        <li>
          <a href="#guarantees" className="hover:text-terra transition-colors">
            Guarantees
          </a>
        </li>
      </ul>

      {/* Right Action Bar */}
      <div className="flex items-center gap-3 justify-self-end">
        {/* Pulsing Sync Status Pill */}
        <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-bark/10 text-xs font-medium text-bark">
          <span
            className={`w-2 h-2 rounded-full ${
              syncStatus === 'synced'
                ? 'bg-moss animate-pulse-ring'
                : syncStatus === 'syncing'
                ? 'bg-terra animate-pulse'
                : 'bg-bark/40'
            }`}
          />
          <span className="capitalize">{syncStatus}</span>
        </div>

        {/* New Celebration Pill CTA */}
        <button
          id="btn-new-celebration"
          onClick={() => navigate('/events/new')}
          className="btn-pill-primary text-xs py-2 px-4 sm:px-5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Celebration</span>
          <span className="sm:hidden">New</span>
        </button>

        {/* User Account / Authentication Buttons */}
        {user ? (
          <div className="relative">
            <button
              id="btn-user-menu"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-full border border-bark/10 bg-white/70 backdrop-blur-md hover:bg-white transition-all text-xs font-medium text-bark"
              aria-label="User Account Menu"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-moss/20 text-moss flex items-center justify-center font-bold text-xs">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
              )}
              <span className="hidden sm:inline max-w-[100px] truncate">
                {user.displayName || user.email?.split('@')[0] || 'My Account'}
              </span>
              <ChevronDown className="w-3 h-3 text-ink-subtle" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-cream/95 backdrop-blur-xl rounded-2xl shadow-card-float border border-bark/10 py-3 z-50 text-xs animate-scale-in">
                <div className="px-4 py-2 border-b border-bark/10">
                  <p className="font-bold text-ink truncate">{user.displayName || 'Celebration Host'}</p>
                  <p className="text-ink-subtle truncate text-[11px]">{user.email || 'Signed in'}</p>
                </div>

                <div className="px-2 pt-2">
                  <button
                    id="btn-sign-out"
                    onClick={() => {
                      signOut();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-terra hover:bg-terra/10 flex items-center space-x-2 font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              id="btn-sign-in"
              onClick={() => openAuthModal('login')}
              className="px-3.5 py-2 rounded-full border border-bark/12 bg-white/70 backdrop-blur-md hover:bg-white text-xs font-semibold text-bark transition-all"
            >
              Sign In
            </button>
            <button
              id="btn-sign-up"
              onClick={() => openAuthModal('signup')}
              className="hidden sm:inline-flex px-3.5 py-2 rounded-full bg-moss hover:bg-moss/90 text-cream text-xs font-semibold shadow-sm transition-all"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

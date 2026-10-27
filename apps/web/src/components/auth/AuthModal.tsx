import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset state when modal opens or mode changes
  useEffect(() => {
    if (isAuthModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setPassword('');
    }
  }, [isAuthModalOpen, authModalMode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const getHumanErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please verify and try again.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completion.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
      case 'auth/network-request-failed':
        return 'Network connection issue. Please check your internet connection.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled yet in your Firebase console.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(getHumanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (authModalMode === 'forgot') {
      setLoading(true);
      try {
        await sendPasswordReset(email);
        setSuccessMsg(`We've sent a password reset link to ${email.trim()}. Please check your inbox.`);
      } catch (err: any) {
        setErrorMsg(getHumanErrorMessage(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (authModalMode === 'signup' && !displayName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      if (authModalMode === 'signup') {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setErrorMsg(getHumanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div id="auth-modal-card" className="relative w-full max-w-md bg-cream/95 backdrop-blur-xl rounded-3xl border border-bark/12 shadow-card-float overflow-hidden p-6 sm:p-8 animate-scale-in">
        {/* Close Button */}
        <button
          id="btn-auth-close"
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-2 rounded-full text-bark/60 hover:text-bark hover:bg-black/5 transition-colors"
          aria-label="Close authentication modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-2">
            <img
              src="/assets/img/logo.png"
              alt="Trellis Logo"
              className="w-10 h-10 object-contain drop-shadow-sm"
            />
          </div>
          <h2 className="font-serif text-3xl text-bark tracking-wide">
            T<em className="text-terra italic font-serif">rellis</em>
          </h2>
          <p className="text-xs text-ink-muted mt-1">
            {authModalMode === 'login' && 'Sign in to access your curated celebrations'}
            {authModalMode === 'signup' && 'Create your account to start planning celebrations'}
            {authModalMode === 'forgot' && 'Reset your account password'}
          </p>
        </div>

        {/* Tab Switcher (Login vs Sign Up) */}
        {authModalMode !== 'forgot' && (
          <div className="flex p-1 mb-6 rounded-xl bg-bark/5 border border-bark/8 text-xs font-semibold">
            <button
              id="auth-tab-login"
              type="button"
              onClick={() => openAuthModal('login')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                authModalMode === 'login'
                  ? 'bg-white text-bark shadow-sm'
                  : 'text-ink-muted hover:text-bark'
              }`}
            >
              Sign In
            </button>
            <button
              id="auth-tab-signup"
              type="button"
              onClick={() => openAuthModal('signup')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                authModalMode === 'signup'
                  ? 'bg-white text-bark shadow-sm'
                  : 'text-ink-muted hover:text-bark'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-terra/15 border border-terra/30 text-xs text-terra font-medium">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-moss/15 border border-moss/30 text-xs text-moss font-medium">
            {successMsg}
          </div>
        )}

        {/* Google Authentication Button */}
        {authModalMode !== 'forgot' && (
          <>
            <button
              id="btn-google-auth"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-full border border-bark/15 bg-white hover:bg-cream/50 hover:border-bark/30 text-xs font-semibold text-bark transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{authModalMode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
            </button>

            {/* Quiet Divider */}
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-bark/10" />
              </div>
              <span className="relative px-3 bg-cream text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                or with email
              </span>
            </div>
          </>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Full Name for Signup */}
          {authModalMode === 'signup' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-bark mb-1">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                <input
                  id="input-auth-name"
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-bark/15 text-xs text-bark placeholder:text-ink-subtle focus:outline-none focus:border-terra focus:ring-1 focus:ring-terra"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-bark mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
              <input
                id="input-auth-email"
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-bark/15 text-xs text-bark placeholder:text-ink-subtle focus:outline-none focus:border-terra focus:ring-1 focus:ring-terra"
              />
            </div>
          </div>

          {/* Password Field */}
          {authModalMode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-bark">
                  Password
                </label>
                {authModalMode === 'login' && (
                  <button
                    id="btn-forgot-password"
                    type="button"
                    onClick={() => openAuthModal('forgot')}
                    className="text-[11px] font-medium text-terra hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
                <input
                  id="input-auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border border-bark/15 text-xs text-bark placeholder:text-ink-subtle focus:outline-none focus:border-terra focus:ring-1 focus:ring-terra"
                />
                <button
                  id="btn-toggle-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-subtle hover:text-bark"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="btn-auth-submit"
            type="submit"
            disabled={loading}
            className="w-full btn-pill-primary py-3 text-xs font-semibold justify-center mt-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>
                  {authModalMode === 'login' && 'Sign In'}
                  {authModalMode === 'signup' && 'Create Account'}
                  {authModalMode === 'forgot' && 'Send Reset Link'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="mt-5 text-center text-xs text-ink-muted">
          {authModalMode === 'login' && (
            <p>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="font-bold text-terra hover:underline"
              >
                Sign up free
              </button>
            </p>
          )}
          {authModalMode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="font-bold text-terra hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
          {authModalMode === 'forgot' && (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="font-bold text-terra hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

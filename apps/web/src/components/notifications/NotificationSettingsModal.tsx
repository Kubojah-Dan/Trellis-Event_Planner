import React, { useState, useEffect } from 'react';
import { X, Bell, Mail, Send, CheckCircle2, ShieldCheck, Calendar, CheckSquare, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createApiClient } from '../../infrastructure/api-client';
import { NotificationPreferences } from '@trellis/contracts';
import { toast } from 'sonner';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, getIdToken } = useAuth();
  const api = createApiClient(getIdToken);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isEmailConfigured, setIsEmailConfigured] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailNotificationsEnabled: true,
    recipientEmail: user?.email || '',
    notifyOnPlanCreated: true,
    notifyOnTaskCompleted: true,
    notifyOnEventDayReminder: true,
    notifyOnRevisions: true,
  });

  useEffect(() => {
    if (!isOpen || !user) return;

    let isMounted = true;
    setLoading(true);

    api
      .getNotificationPreferences()
      .then((res) => {
        if (isMounted) {
          setPrefs({
            ...res.preferences,
            recipientEmail: res.preferences.recipientEmail || user.email || '',
          });
          setIsEmailConfigured(res.emailServiceConfigured);
        }
      })
      .catch((err) => {
        console.warn('Could not load notification preferences:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // Prevent background page scrolling when modal is open and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateNotificationPreferences(prefs);
      toast.success('Notification preferences updated successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    const targetEmail = prefs.recipientEmail?.trim() || user?.email;
    if (!targetEmail) {
      toast.error('Please enter a valid email address first');
      return;
    }

    setTesting(true);
    try {
      const res = await api.sendTestNotificationEmail(targetEmail);
      if (res.simulated) {
        toast.info(`Test alert logged to server console for ${targetEmail} (RESEND_API_KEY not yet set on server).`, {
          duration: 6000,
        });
      } else {
        toast.success(`Test email sent to ${targetEmail}! Check your inbox (or spam).`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-bark/40 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-cream rounded-3xl border border-bark/15 shadow-card-float flex flex-col max-h-[min(90vh,760px)] relative overflow-hidden text-ink animate-scale-in my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-5 sm:p-6 pb-4 border-b border-bark/10 bg-cream relative pr-14">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full hover:bg-bark/10 text-ink-subtle hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-moss/30"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold uppercase tracking-wider">
              <Bell className="w-3.5 h-3.5 text-terra" />
              <span>Alerts & Notifications</span>
            </div>
            <h2 id="notification-settings-title" className="font-serif text-2xl font-normal text-bark leading-tight">
              Email Notification Preferences
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
              Stay grounded and on schedule. Receive timely celebration alerts without inbox clutter.
            </p>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
          {/* Server Status Pill */}
          <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-2xl bg-white/70 border border-bark/10">
            <div className="flex items-center space-x-2">
              <ShieldCheck className={`w-4 h-4 ${isEmailConfigured ? 'text-moss' : 'text-terra'}`} />
              <span className="font-medium text-bark">
                {isEmailConfigured ? 'Email Delivery Service Active' : 'Email Simulation Active (Dev)'}
              </span>
            </div>
            <span className="text-[11px] text-ink-muted">
              {isEmailConfigured ? 'Live via Resend' : 'Set RESEND_API_KEY in env'}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-ink-muted text-xs flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-moss border-t-transparent rounded-full animate-spin" />
              <span>Loading preferences...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Master Toggle */}
              <div className="p-4 rounded-2xl bg-white/80 border border-bark/10 flex items-center justify-between transition-all">
                <div className="space-y-0.5 pr-4">
                  <label htmlFor="master-email-toggle" className="font-semibold text-sm text-bark cursor-pointer">
                    Allow Email Notifications
                  </label>
                  <p className="text-xs text-ink-muted">
                    Master switch to receive celebration countdowns, to-do milestones, and plan updates.
                  </p>
                </div>
                <input
                  id="master-email-toggle"
                  type="checkbox"
                  checked={prefs.emailNotificationsEnabled}
                  onChange={(e) => setPrefs({ ...prefs, emailNotificationsEnabled: e.target.checked })}
                  className="w-5 h-5 accent-moss rounded cursor-pointer"
                />
              </div>

              {/* Recipient Email Address Input */}
              <div className="space-y-1.5">
                <label htmlFor="recipient-email" className="block text-xs font-semibold text-bark uppercase tracking-wider">
                  Recipient Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="recipient-email"
                    type="email"
                    value={prefs.recipientEmail || ''}
                    onChange={(e) => setPrefs({ ...prefs, recipientEmail: e.target.value })}
                    placeholder="name@example.com"
                    disabled={!prefs.emailNotificationsEnabled}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-bark/15 bg-white text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-moss/30 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Granular Notification Channels */}
              <div
                className={`space-y-2.5 pt-1 transition-opacity ${
                  prefs.emailNotificationsEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
                }`}
              >
                <p className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">Milestone Alert Types</p>

                {/* Day of Event / Countdown */}
                <label className="flex items-start justify-between p-3 rounded-xl bg-white/50 border border-bark/8 hover:bg-white cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3 pr-2">
                    <Calendar className="w-4 h-4 text-moss mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-bark block">Event Day & Countdown Alerts</span>
                      <span className="text-[11px] text-ink-muted">
                        Day-of morning briefing and countdown notices as the date draws near.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifyOnEventDayReminder}
                    onChange={(e) => setPrefs({ ...prefs, notifyOnEventDayReminder: e.target.checked })}
                    className="w-4 h-4 accent-moss rounded mt-1 cursor-pointer"
                  />
                </label>

                {/* Task Completions */}
                <label className="flex items-start justify-between p-3 rounded-xl bg-white/50 border border-bark/8 hover:bg-white cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3 pr-2">
                    <CheckSquare className="w-4 h-4 text-moss mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-bark block">Completed To-Dos & Milestones</span>
                      <span className="text-[11px] text-ink-muted">
                        Celebrate task milestones and keep track of checklist progress.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifyOnTaskCompleted}
                    onChange={(e) => setPrefs({ ...prefs, notifyOnTaskCompleted: e.target.checked })}
                    className="w-4 h-4 accent-moss rounded mt-1 cursor-pointer"
                  />
                </label>

                {/* Plans Created & Revisions */}
                <label className="flex items-start justify-between p-3 rounded-xl bg-white/50 border border-bark/8 hover:bg-white cursor-pointer transition-colors">
                  <div className="flex items-start space-x-3 pr-2">
                    <Sparkles className="w-4 h-4 text-terra mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-bark block">Plan Creation & Revisions</span>
                      <span className="text-[11px] text-ink-muted">
                        Receive your calibrated operational briefing whenever a new plan or patch is generated.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.notifyOnPlanCreated}
                    onChange={(e) => setPrefs({ ...prefs, notifyOnPlanCreated: e.target.checked })}
                    className="w-4 h-4 accent-moss rounded mt-1 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Action Footer */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-t border-bark/10 bg-cream/95 backdrop-blur-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing || !prefs.emailNotificationsEnabled}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-bark/20 bg-white hover:bg-sand/40 text-xs font-semibold text-bark flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
          >
            {testing ? (
              <div className="w-3.5 h-3.5 border-2 border-bark border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-terra" />
            )}
            <span>Send Test Email</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-bark/15 hover:bg-bark/5 text-xs font-semibold text-ink-muted transition-colors text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-moss hover:bg-moss/90 text-cream text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-sm"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-cream border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Save Preferences</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

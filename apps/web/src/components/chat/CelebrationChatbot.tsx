import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createApiClient } from '../../infrastructure/api-client';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  X,
  Minimize2,
  Maximize2,
  Bot,
  User,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const CelebrationChatbot: React.FC = () => {
  const { user, getIdToken, openAuthModal } = useAuth();
  const { eventId } = useParams<{ eventId?: string }>();
  const api = createApiClient(getIdToken);

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepAuditMode, setDeepAuditMode] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your Trellis Celebration Concierge. I have live access to your event plans, timelines, and budget ledgers. Ask me anything—like *"What did I plan for the birthday?"*, *"What tasks are due this week?"*, or *"Give me a budget breakdown."*',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Voice recognition integration
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onResult: (text) => {
      setInputMessage(text);
    },
  });

  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || loading) return;

    if (!user) {
      toast.info('Please sign in so I can access your celebration plans.');
      openAuthModal('login');
      return;
    }

    if (isListening) {
      stopListening();
    }

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    resetTranscript();
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const queryPrompt = deepAuditMode
        ? `[DEEP LEDGER AUDIT REQUEST] ${textToSend.trim()}`
        : textToSend.trim();

      const res = await api.postAI<{ reply: string }>('assistant/chat', {
        message: queryPrompt,
        eventId: eventId || undefined,
        history,
      });

      const assistantMsg: Message = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'I inspected your workspace. How else can I assist with your celebration?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to contact celebration concierge');
      const errorReply: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue accessing the planning engine: ${err.message || 'Please check connection.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  // Quick suggestion chips tailored to celebrations
  const suggestionPills = [
    { label: 'Upcoming Milestones', query: 'What is planned for my upcoming celebration?' },
    { label: 'Budget Status', query: 'What is our current budget breakdown and planned spending?' },
    { label: 'Blocked / Urgent Tasks', query: 'Are there any blocked or urgent tasks I need to unblock?' },
    { label: 'Birthday Plan Details', query: 'What did I plan for the birthday celebration?' },
  ];

  return (
    <>
      {/* ------------------------------------------------------------------- */}
      {/* 1. Closed State: Floating Glassmorphic Orb Bubble                     */}
      {/* ------------------------------------------------------------------- */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 animate-fade-in">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 rounded-full transition-transform duration-300 hover:scale-105 active:scale-95 focus:outline-none"
            aria-label="Open Trellis Celebration Assistant"
          >
            {/* Ambient iridescent glass glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-terra/30 via-moss/20 to-sky/40 blur-md group-hover:blur-lg transition-all" />

            {/* Glassmorphic 3D Sphere styling matching user's reference */}
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-white/80 via-sand/60 to-cream/90 backdrop-blur-xl border border-white/60 shadow-hero-img flex items-center justify-center overflow-hidden">
              {/* Highlight refraction */}
              <div className="absolute top-1 left-2 w-7 h-4 rounded-full bg-white/70 blur-[1px] transform -rotate-12" />
              {/* Organic internal gradient orb */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-terra via-moss to-sand opacity-80 flex items-center justify-center text-white shadow-inner">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
            </div>

            {/* Notification Badge */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terra opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-terra border-2 border-cream" />
            </span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. Open State: Context-Aware Celebration Assistant Window            */}
      {/* ------------------------------------------------------------------- */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed z-50 transition-all duration-300 ${
            isExpanded
              ? 'inset-4 sm:inset-10'
              : 'bottom-4 sm:bottom-6 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[460px] h-[640px] max-h-[90vh]'
          }`}
        >
          <div className="w-full h-full flex flex-col bg-cream/95 backdrop-blur-2xl rounded-3xl border border-bark/15 shadow-card-float overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-bark/10 bg-white/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mini Glass Orb */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-terra via-moss to-sky flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-bark leading-tight flex items-center gap-1.5">
                    <span>Trellis Concierge</span>
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-moss/15 text-moss">
                      Context-Aware
                    </span>
                  </h3>
                  <p className="text-[11px] text-ink-subtle">
                    {eventId ? 'Active Workspace Synced' : 'Cross-Celebration Intelligence'}
                  </p>
                </div>
              </div>

              {/* Window Controls */}
              <div className="flex items-center gap-1 text-bark/60">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 rounded-lg hover:bg-black/5 hover:text-bark transition-colors"
                  aria-label={isExpanded ? 'Restore window size' : 'Expand window'}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-black/5 hover:text-bark transition-colors"
                  aria-label="Close assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Suggestion Pills */}
            <div className="px-4 py-2.5 border-b border-bark/8 bg-sand/20 flex gap-2 overflow-x-auto no-scrollbar text-xs">
              {suggestionPills.map((pill, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(pill.query)}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-bark/10 text-[11px] font-medium text-bark transition-colors shadow-2xs"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Conversation Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs ${
                      isAssistant ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {isAssistant && (
                      <div className="w-7 h-7 rounded-full bg-moss/20 text-moss flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl p-3.5 space-y-1.5 ${
                        isAssistant
                          ? 'bg-white/80 border border-bark/10 text-ink shadow-2xs'
                          : 'bg-bark text-cream rounded-tr-xs shadow-sm'
                      }`}
                    >
                      <div className="leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                      <div
                        className={`text-[10px] text-right ${
                          isAssistant ? 'text-ink-subtle' : 'text-cream/60'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {!isAssistant && (
                      <div className="w-7 h-7 rounded-full bg-terra/20 text-terra flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                        {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3 items-center text-xs text-ink-muted">
                  <div className="w-7 h-7 rounded-full bg-moss/20 text-moss flex items-center justify-center shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-3 rounded-2xl bg-white/60 border border-bark/10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-moss animate-ping" />
                    <span>Consulting your celebration ledger & plans...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Listening Banner if Voice Active */}
            {isListening && (
              <div className="px-4 py-2 bg-terra/10 border-t border-terra/20 flex items-center justify-between text-xs text-terra">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-terra animate-ping" />
                  <span>Listening live... speak your question</span>
                </span>
                <button
                  type="button"
                  onClick={stopListening}
                  className="font-bold underline text-[11px]"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Bottom Input Area matching the user's reference design */}
            <div className="p-3 sm:p-4 border-t border-bark/10 bg-white/60">
              <div className="rounded-2xl border border-bark/15 bg-white p-2.5 shadow-sm space-y-2 focus-within:border-terra focus-within:ring-1 focus-within:ring-terra transition-all">
                {/* Input text */}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isListening
                      ? 'Listening to your voice...'
                      : 'Ask me anything about your celebration...'
                  }
                  className="w-full px-2 py-1 bg-transparent text-xs text-bark placeholder:text-ink-subtle focus:outline-none"
                />

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    {/* Deep Think / Ledger Audit Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => setDeepAuditMode(!deepAuditMode)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        deepAuditMode
                          ? 'bg-moss text-white shadow-2xs'
                          : 'bg-sand/40 hover:bg-sand/70 text-bark'
                      }`}
                      title="Inspects full dependency graph and minor-unit budget ledgers"
                    >
                      <Lightbulb className="w-3 h-3" />
                      <span>{deepAuditMode ? 'Deep Audit On' : 'Deep Audit'}</span>
                    </button>

                    {/* Voice Dictation Button */}
                    <button
                      type="button"
                      onClick={toggleVoice}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        isListening
                          ? 'bg-terra text-white animate-pulse'
                          : 'bg-sand/40 hover:bg-sand/70 text-bark'
                      }`}
                      title="Speak using voice input"
                    >
                      {isListening ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                      <span>Voice</span>
                    </button>
                  </div>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!inputMessage.trim() || loading}
                    className="btn-pill-primary py-1.5 px-3.5 text-xs font-semibold disabled:opacity-40"
                  >
                    <span>Send</span>
                    <Send className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

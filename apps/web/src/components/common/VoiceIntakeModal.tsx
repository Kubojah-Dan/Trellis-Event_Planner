import React, { useEffect } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { Mic, MicOff, Check, X, RotateCcw, Sparkles } from 'lucide-react';

interface VoiceIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (spokenText: string) => void;
  title?: string;
  subtitle?: string;
}

export const VoiceIntakeModal: React.FC<VoiceIntakeModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  title = 'Speak Your Celebration Vision',
  subtitle = 'Describe your dates, guest count, atmosphere, or ideas naturally. Trellis will transcribe it for your approval.',
}) => {
  const {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  } = useSpeechRecognition();

  useEffect(() => {
    if (isOpen) {
      resetTranscript();
      startListening();
    } else {
      stopListening();
    }
  }, [isOpen, startListening, stopListening, resetTranscript]);

  if (!isOpen) return null;

  const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  const handleApprove = () => {
    if (fullText) {
      stopListening();
      onApprove(fullText);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-intake-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bark/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopListening();
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg bg-cream/95 backdrop-blur-xl rounded-3xl border border-bark/12 shadow-card-float overflow-hidden p-6 sm:p-8 animate-scale-in">
        {/* Close button */}
        <button
          onClick={() => {
            stopListening();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-full text-bark/60 hover:text-bark hover:bg-black/5 transition-colors"
          aria-label="Close voice intake"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sand/60 border border-sand text-moss text-xs font-semibold tracking-wider uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-terra" />
            <span>Voice-Powered Intake</span>
          </div>
          <h3 id="voice-intake-title" className="font-serif text-3xl text-bark">{title}</h3>
          <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto leading-relaxed">{subtitle}</p>
        </div>

        {/* Central Audio Wave / Listening Sphere */}
        <div className="flex flex-col items-center justify-center my-6" aria-live="polite">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating wave rings */}
            {isListening && (
              <>
                <div className="absolute w-28 h-28 rounded-full bg-terra/20 animate-ping opacity-60" />
                <div className="absolute w-24 h-24 rounded-full bg-moss/20 animate-pulse" />
              </>
            )}

            {/* Mic Toggle Orb */}
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                isListening
                  ? 'bg-terra text-white shadow-terra/30 hover:scale-105'
                  : 'bg-sand text-bark hover:bg-sand/80'
              }`}
            >
              {isListening ? (
                <Mic className="w-8 h-8 animate-pulse" />
              ) : (
                <MicOff className="w-8 h-8 text-bark/60" />
              )}
            </button>
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-bark mt-4">
            {isListening ? (
              <span className="flex items-center gap-1.5 text-terra">
                <span className="w-2 h-2 rounded-full bg-terra animate-ping" />
                <span>Listening... speak freely</span>
              </span>
            ) : (
              <span className="text-ink-muted">Click microphone to resume speaking</span>
            )}
          </span>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-terra/15 border border-terra/30 text-xs text-terra font-medium text-center">
            {error}
          </div>
        )}

        {!isSupported && (
          <div className="mb-4 p-3 rounded-xl bg-terra/15 border border-terra/30 text-xs text-terra font-medium text-center">
            Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
          </div>
        )}

        {/* Real-time Transcribed Text Card */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-bark mb-1.5 flex items-center justify-between">
            <span>Transcribed Voice Brief</span>
            {fullText && (
              <button
                type="button"
                onClick={resetTranscript}
                className="text-[11px] font-medium text-ink-muted hover:text-terra flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </label>
          <div className="relative">
            <textarea
              rows={4}
              value={fullText}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your spoken words will appear here in real-time as you speak..."
              className="w-full p-3.5 rounded-2xl bg-white border border-bark/15 text-xs text-bark placeholder:text-ink-subtle focus:outline-none focus:border-terra focus:ring-1 focus:ring-terra resize-none leading-relaxed"
            />
          </div>
          <p className="text-[11px] text-ink-subtle mt-1 italic">
            You can edit the text directly above before approving.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              stopListening();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-full border border-bark/15 bg-white hover:bg-black/5 text-xs font-semibold text-bark transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!fullText.trim()}
            onClick={handleApprove}
            className="flex-1 btn-pill-primary py-3 text-xs font-semibold justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 mr-1.5" />
            <span>Approve & Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};

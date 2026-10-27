import React from 'react';
import { useParams } from 'react-router-dom';

export const WorkspacePlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="glass-card text-center py-16 rounded-3xl border border-glass-border/70 backdrop-blur-md">
      <h2 className="font-serif text-3xl font-normal text-bark mb-2">{title}</h2>
      <p className="text-sm text-ink-muted max-w-md mx-auto mb-6">{subtitle}</p>
      <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-sand/50 text-bark border border-sand/70">
        Event ID: {eventId}
      </span>
    </div>
  );
};

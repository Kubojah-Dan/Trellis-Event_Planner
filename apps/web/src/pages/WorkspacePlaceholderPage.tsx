import React from 'react';
import { useParams } from 'react-router-dom';

export const WorkspacePlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="editorial-card text-center py-16">
      <h2 className="font-editorial text-2xl font-bold text-evergreen-900 mb-2">{title}</h2>
      <p className="text-sm text-ink-muted max-w-md mx-auto mb-6">{subtitle}</p>
      <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-paper text-ink-muted border border-warmgray-200">
        Event ID: {eventId}
      </span>
    </div>
  );
};

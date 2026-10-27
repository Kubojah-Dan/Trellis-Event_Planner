import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';
import { AuthModal } from '../auth/AuthModal';
import { CelebrationChatbot } from '../chat/CelebrationChatbot';

interface AppLayoutProps {
  currentEventTitle?: string;
  syncStatus?: 'synced' | 'syncing' | 'offline';
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentEventTitle, syncStatus }) => {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink relative overflow-x-hidden">
      {/* Organic atmospheric background drift blobs */}
      <div className="blobs" aria-hidden="true">
        <i></i>
        <i></i>
        <i></i>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar currentEventTitle={currentEventTitle} syncStatus={syncStatus} />
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          {eventId && <Sidebar />}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
      <CelebrationChatbot />
      <AuthModal />
      <Toaster position="bottom-right" richColors />
    </div>
  );
};

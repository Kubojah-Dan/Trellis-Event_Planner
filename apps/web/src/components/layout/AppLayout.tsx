import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';

interface AppLayoutProps {
  currentEventTitle?: string;
  syncStatus?: 'synced' | 'syncing' | 'offline';
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentEventTitle, syncStatus }) => {
  const { eventId } = useParams<{ eventId: string }>();

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <Navbar currentEventTitle={currentEventTitle} syncStatus={syncStatus} />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {eventId && <Sidebar />}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
};

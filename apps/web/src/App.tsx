import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { DiscoveryPage } from './pages/DiscoveryPage';

import { EventOverviewPage } from './pages/EventOverviewPage';
import { BudgetPage } from './pages/BudgetPage';
import { TasksPage } from './pages/TasksPage';
import { TimelinePage } from './pages/TimelinePage';
import { VendorsPage } from './pages/VendorsPage';
import { IdeasPage } from './pages/IdeasPage';

import { RevisionsPage } from './pages/RevisionsPage';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="events/new" element={<DiscoveryPage />} />
              <Route path="events/:eventId" element={<EventOverviewPage />} />
              <Route path="events/:eventId/concepts" element={<IdeasPage />} />
              <Route path="events/:eventId/budget" element={<BudgetPage />} />
              <Route path="events/:eventId/tasks" element={<TasksPage />} />
              <Route path="events/:eventId/timeline" element={<TimelinePage />} />
              <Route path="events/:eventId/vendors" element={<VendorsPage />} />
              <Route path="events/:eventId/ideas" element={<IdeasPage />} />
              <Route path="events/:eventId/revisions" element={<RevisionsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

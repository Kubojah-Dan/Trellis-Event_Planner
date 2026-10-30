import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// Configured QueryClient with optimal stale & cache times to prevent network churn and memory thrashing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000, // 1 minute fresh cache
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
    },
  },
});

// Route-based lazy loading for optimal bundle size, faster initial load, and reduced memory usage
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const DiscoveryPage = lazy(() =>
  import('./pages/DiscoveryPage').then((m) => ({ default: m.DiscoveryPage }))
);
const EventOverviewPage = lazy(() =>
  import('./pages/EventOverviewPage').then((m) => ({ default: m.EventOverviewPage }))
);
const BudgetPage = lazy(() =>
  import('./pages/BudgetPage').then((m) => ({ default: m.BudgetPage }))
);
const TasksPage = lazy(() =>
  import('./pages/TasksPage').then((m) => ({ default: m.TasksPage }))
);
const TimelinePage = lazy(() =>
  import('./pages/TimelinePage').then((m) => ({ default: m.TimelinePage }))
);
const VendorsPage = lazy(() =>
  import('./pages/VendorsPage').then((m) => ({ default: m.VendorsPage }))
);
const IdeasPage = lazy(() =>
  import('./pages/IdeasPage').then((m) => ({ default: m.IdeasPage }))
);
const RevisionsPage = lazy(() =>
  import('./pages/RevisionsPage').then((m) => ({ default: m.RevisionsPage }))
);

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center animate-fade-in" aria-live="polite" aria-busy="true">
    <div className="w-8 h-8 border-3 border-moss border-t-transparent rounded-full animate-spin mb-3" />
    <span className="text-xs font-serif text-ink-muted">Loading workspace...</span>
  </div>
);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoadingFallback />}>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

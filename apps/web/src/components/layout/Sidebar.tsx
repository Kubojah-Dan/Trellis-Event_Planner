import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  DollarSign,
  CheckSquare,
  Calendar,
  Store,
  Lightbulb,
  History,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();

  if (!eventId) return null;

  const navItems = [
    { label: 'Overview', to: `/events/${eventId}`, icon: LayoutDashboard, end: true },
    { label: 'Concept Studio', to: `/events/${eventId}/concepts`, icon: Sparkles },
    { label: 'Budget & Ledger', to: `/events/${eventId}/budget`, icon: DollarSign },
    { label: 'Checklist & Tasks', to: `/events/${eventId}/tasks`, icon: CheckSquare },
    { label: 'Timeline & Runsheet', to: `/events/${eventId}/timeline`, icon: Calendar },
    { label: 'Vendors Pipeline', to: `/events/${eventId}/vendors`, icon: Store },
    { label: 'Ideas & Drafting', to: `/events/${eventId}/ideas`, icon: Lightbulb },
    { label: 'Revisions & Diff', to: `/events/${eventId}/revisions`, icon: History },
  ];

  return (
    <>
      {/* Desktop Left Navigation */}
      <aside className="hidden md:flex flex-col w-64 py-8 px-4 shrink-0">
        <div className="px-3 mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-moss">
            Event Workspace
          </p>
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-full text-xs font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-bark text-cream shadow-sm font-semibold translate-x-1'
                      : 'text-ink-muted hover:text-terra hover:bg-white/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Horizontal Sub-Navigation Bar */}
      <div className="md:hidden sticky top-16 z-30 bg-cream/90 backdrop-blur-md border-b border-bark/10 overflow-x-auto py-2.5 px-4 flex space-x-2 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-bark text-cream font-medium shadow-xs'
                    : 'bg-white/60 text-ink-muted border border-bark/10 hover:bg-white'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </>
  );
};

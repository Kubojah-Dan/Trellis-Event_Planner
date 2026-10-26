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
    { label: 'Budget & Spend', to: `/events/${eventId}/budget`, icon: DollarSign },
    { label: 'Checklist & Tasks', to: `/events/${eventId}/tasks`, icon: CheckSquare },
    { label: 'Timeline & Runsheet', to: `/events/${eventId}/timeline`, icon: Calendar },
    { label: 'Vendors & Sourcing', to: `/events/${eventId}/vendors`, icon: Store },
    { label: 'Ideas & Notes', to: `/events/${eventId}/ideas`, icon: Lightbulb },
    { label: 'Revisions & Diff', to: `/events/${eventId}/revisions`, icon: History },
  ];

  return (
    <>
      {/* Desktop Left Navigation */}
      <aside className="hidden md:flex flex-col w-64 bg-surface border-r border-warmgray-200 py-6 px-3 shrink-0">
        <div className="px-3 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Event Workspace
          </p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-evergreen-50 text-evergreen-900 border border-evergreen-100 font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink hover:bg-warmgray-100'
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
      <div className="md:hidden sticky top-16 z-30 bg-surface border-b border-warmgray-200 overflow-x-auto py-2 px-4 flex space-x-2 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-evergreen-900 text-white font-medium shadow-xs'
                    : 'bg-paper text-ink-muted border border-warmgray-200 hover:bg-warmgray-100'
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

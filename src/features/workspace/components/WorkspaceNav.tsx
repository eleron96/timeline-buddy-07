import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/classNames';

export const WorkspaceNav: React.FC = () => (
  <nav className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
    <NavLink
      to="/"
      end
      className={({ isActive }) => cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      Timeline
    </NavLink>
    <NavLink
      to="/dashboard"
      className={({ isActive }) => cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      Dashboard
    </NavLink>
  </nav>
);

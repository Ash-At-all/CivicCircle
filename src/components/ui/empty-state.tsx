"use client";

import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/05 mb-4">
          {icon}
        </div>
      )}
      <h2 className="text-white font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

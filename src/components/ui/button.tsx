"use client";

import * as React from "react";

const buttonVariants = (props: { variant?: string; size?: string; className?: string } = {}) => {
  const { variant = "default", size = "default", className } = props;
  const base = "inline-flex items-center justify-center rounded-button px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "bg-gradient-to-r from-purple to-[#9B5CF6] text-white shadow-lg",
    yellow: "bg-yellow text-black hover:opacity-95",
    ghost: "bg-white/05 text-white hover:bg-white/10",
    danger: "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4",
    sm: "h-9 px-3",
    lg: "h-11 px-6",
    icon: "h-10 w-10",
  };
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(" ");
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "yellow" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { buttonVariants, Button };

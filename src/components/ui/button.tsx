"use client";

import * as React from "react";

const buttonVariants = (props: { variant?: string; size?: string; className?: string } = {}) => {
  const { variant = "default", size = "default", className } = props;
  const base = "btn";
  const variants: Record<string, string> = {
    default: "btn-primary",
    primary: "btn-primary",
    yellow: "btn-primary",
    ghost: "btn-secondary",
    secondary: "btn-tertiary",
    outline: "btn-outline",
    danger: "btn-danger",
  };
  const sizes: Record<string, string> = {
    default: "",
    sm: "btn-sm",
    lg: "btn-lg",
    icon: "btn-icon",
  };
  return [base, variants[variant], sizes[size], className].filter(Boolean).join(" ");
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "yellow" | "ghost" | "secondary" | "outline" | "danger";
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

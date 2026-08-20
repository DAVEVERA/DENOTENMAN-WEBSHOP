import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

const variantClasses: Record<"primary" | "secondary" | "ghost", string> = {
  primary:
    "bg-accent text-contrast border border-accent shadow-button hover:bg-accent-hover hover:border-accent-hover active:shadow-none",
  secondary:
    "bg-surface text-text border border-border hover:border-border-hover active:bg-background",
  ghost:
    "bg-transparent text-text border border-transparent hover:bg-background active:bg-border",
};

const sizeClasses: Record<"sm" | "md" | "lg", string> = {
  sm: "px-3 py-1.5 text-body-sm",
  md: "px-4 py-2 text-body-md",
  lg: "px-6 py-3 text-body-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  busy = false,
  disabled = false,
  className,
  children,
  ...props
}: {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-button font-heading tracking-heading transition-colors duration-hover-fast ease-hover disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {busy ? (
        <LoadingIndicator size="sm" decorative />
      ) : null}
      {children}
    </button>
  );
}

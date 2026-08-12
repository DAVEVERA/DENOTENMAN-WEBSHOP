import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: {
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-hover ease-hover hover:-translate-y-1 hover:border-border-hover hover:shadow-card-hover",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

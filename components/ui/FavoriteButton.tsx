"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";

export function FavoriteButton({
  active: activeProp,
  onToggle,
  label,
  className,
}: {
  active?: boolean;
  onToggle?: (next: boolean) => void;
  label: { on: string; off: string };
  className?: string;
}) {
  const [internalActive, setInternalActive] = useState(false);
  const active = activeProp ?? internalActive;

  function handleClick() {
    const next = !active;
    if (onToggle) {
      onToggle(next);
    } else {
      setInternalActive(next);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? label.on : label.off}
      onClick={handleClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-hover-fast hover:text-red-600",
        active && "text-red-600",
        className
      )}
    >
      <Heart className="h-5 w-5" fill={active ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

import { cn } from "@/lib/cn";

const wordmarkSrc: Record<"light" | "dark", string> = {
  light: "/brand/logo-wordmark.svg",
  dark: "/brand/logo-wordmark.svg",
};

const wordmarkSizeClasses: Record<"sm" | "lg" | "responsive", string> = {
  sm: "h-8",
  lg: "h-12",
  responsive: "h-7 sm:h-12",
};

const markSizeClasses: Record<"sm" | "lg" | "responsive", string> = {
  sm: "h-8 w-8",
  lg: "h-12 w-12",
  responsive: "h-9 w-9 sm:h-12 sm:w-12",
};

export function Logo({
  alt,
  variant = "light",
  parts = "full",
  size = "sm",
  className,
}: {
  alt: { mark: string; wordmark: string };
  variant?: "light" | "dark";
  parts?: "mark" | "wordmark" | "full";
  size?: "sm" | "lg" | "responsive";
  className?: string;
}) {
  const showMark = parts === "mark" || parts === "full";
  const showWordmark = parts === "wordmark" || parts === "full";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showMark ? (
        <img src="/brand/logo-mark.svg" alt={alt.mark} className={markSizeClasses[size]} />
      ) : null}
      {showWordmark ? (
        <img src={wordmarkSrc[variant]} alt={alt.wordmark} className={wordmarkSizeClasses[size]} />
      ) : null}
    </span>
  );
}

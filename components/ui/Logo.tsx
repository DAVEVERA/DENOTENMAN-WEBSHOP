import { cn } from "@/lib/cn";

const wordmarkSrc: Record<"light" | "dark", string> = {
  light: "/brand/logo-wordmark.svg",
  dark: "/brand/logo-wordmark.svg",
};

const wordmarkSizeClasses: Record<"sm" | "lg" | "responsive", string> = {
  sm: "h-8",
  lg: "h-12",
  responsive: "h-10 sm:h-14 lg:h-16",
};

const wordmarkColorClasses: Record<"light" | "dark", string> = {
  light: "bg-[#333333]",
  dark: "bg-[#e0b200]",
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
        <span
          role="img"
          aria-label={alt.wordmark}
          className={cn(
            "block shrink-0 bg-center bg-no-repeat [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
            wordmarkSizeClasses[size],
            wordmarkColorClasses[variant]
          )}
          style={{
            aspectRatio: "208.93 / 54.695",
            maskImage: `url(${wordmarkSrc[variant]})`,
            WebkitMaskImage: `url(${wordmarkSrc[variant]})`,
          }}
        />
      ) : null}
    </span>
  );
}

import { cn } from "@/lib/cn";

const wordmarkSrc: Record<"light" | "dark", string> = {
  light: "/brand/logo-wordmark.svg",
  dark: "/brand/logo-wordmark.svg",
};

type LogoSize = "sm" | "lg" | "responsive" | "nav";

const wordmarkSizeClasses: Record<LogoSize, string> = {
  sm: "h-8",
  lg: "h-12",
  responsive: "h-14 sm:h-16 lg:h-20",
  nav: "h-12 min-[400px]:h-14 sm:h-16",
};

const wordmarkColorClasses: Record<"light" | "dark", string> = {
  light: "bg-[#333333]",
  dark: "bg-[#e0b200]",
};

const markSizeClasses: Record<LogoSize, string> = {
  sm: "h-8 w-8",
  lg: "h-12 w-12",
  responsive: "h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16",
  nav: "h-12 w-12 min-[400px]:h-14 min-[400px]:w-14 sm:h-16 sm:w-16",
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
  size?: LogoSize;
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

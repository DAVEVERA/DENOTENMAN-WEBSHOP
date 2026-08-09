import { cn } from "@/lib/cn";

const wordmarkSrc: Record<"light" | "dark", string> = {
  light: "/brand/logo-wordmark.svg",
  dark: "/brand/logo-wordmark.svg",
};

export function Logo({
  alt,
  variant = "light",
  parts = "full",
  className,
}: {
  alt: { mark: string; wordmark: string };
  variant?: "light" | "dark";
  parts?: "mark" | "wordmark" | "full";
  className?: string;
}) {
  const showMark = parts === "mark" || parts === "full";
  const showWordmark = parts === "wordmark" || parts === "full";

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showMark ? (
        <img src="/brand/logo-mark.svg" alt={alt.mark} className="h-8 w-8" />
      ) : null}
      {showWordmark ? (
        <img src={wordmarkSrc[variant]} alt={alt.wordmark} className="h-6" />
      ) : null}
    </span>
  );
}

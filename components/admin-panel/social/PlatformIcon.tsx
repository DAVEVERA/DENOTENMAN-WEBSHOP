import type { SocialPlatformName } from "@/lib/social/platforms";

// Simple letter marks instead of brand logos: recognisable, no trademark artwork.
const marks: Record<SocialPlatformName, { letter: string; className: string; label: string }> = {
  FACEBOOK: { letter: "f", className: "bg-[#1877F2] text-white", label: "Facebook" },
  INSTAGRAM: { letter: "IG", className: "bg-[#C13584] text-white", label: "Instagram" },
  TIKTOK: { letter: "TT", className: "bg-[#111111] text-white", label: "TikTok" },
  YOUTUBE: { letter: "YT", className: "bg-[#CC0000] text-white", label: "YouTube" },
};

export function PlatformIcon({ platform, size = "sm" }: { platform: SocialPlatformName; size?: "sm" | "xs" }) {
  const mark = marks[platform];
  return (
    <span
      title={mark.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-heading font-bold leading-none ${mark.className} ${size === "xs" ? "h-4 min-w-4 px-1 text-[9px]" : "h-6 min-w-6 px-1.5 text-[11px]"}`}
    >
      <span aria-hidden="true">{mark.letter}</span>
      <span className="sr-only">{mark.label}</span>
    </span>
  );
}

export function platformTone(platform: SocialPlatformName): string {
  return {
    FACEBOOK: "bg-blue-50 text-blue-900",
    INSTAGRAM: "bg-pink-50 text-pink-900",
    TIKTOK: "bg-neutral-100 text-neutral-900",
    YOUTUBE: "bg-red-50 text-red-900",
  }[platform];
}

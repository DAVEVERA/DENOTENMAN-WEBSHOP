import Image from "next/image";
import { cn } from "@/lib/cn";

export function LoadingIndicator({
  label = "Laden…",
  size = "md",
  showLabel = false,
  decorative = false,
  className,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("dn-cashew-status", showLabel && "dn-cashew-status--labelled", className)}
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={!decorative && !showLabel ? label : undefined}
      aria-hidden={decorative || undefined}
    >
      <span className={`dn-cashew-loader dn-cashew-loader--${size}`} aria-hidden="true">
        <Image
          className="dn-cashew-loader__nut"
          src="/brand/loader/cashew-loader/cashew-transparent.png"
          alt=""
          width={1239}
          height={1270}
          sizes={size === "lg" ? "94px" : size === "md" ? "52px" : "22px"}
          loading="eager"
          draggable={false}
        />
        <span className="dn-cashew-loader__shadow" />
      </span>
      {showLabel ? <span className="dn-cashew-status__label">{label}</span> : null}
    </span>
  );
}

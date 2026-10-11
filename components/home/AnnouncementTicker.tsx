import Image from "next/image";
import type { AnnouncementTickerCopy } from "@/lib/customer-service-content";
import { cn } from "@/lib/cn";

export function AnnouncementTicker({ copy }: { copy: AnnouncementTickerCopy }) {
  if (!copy.items.length) return null;

  return (
    <aside
      aria-label={copy.ariaLabel}
      className="relative z-[55] bg-black text-white"
    >
      <ul className="mx-auto grid max-w-[96rem] grid-cols-2 lg:grid-cols-4">
        {copy.items.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "flex min-h-13 items-center justify-center gap-2.5 px-3 py-2.5 text-center sm:px-4 lg:min-h-11 lg:py-2",
              index < 2 && "border-b border-white/15 lg:border-b-0",
              index % 2 === 0 && "border-r border-white/15",
              index === 1 && "lg:border-r lg:border-white/15",
              index === 2 && "lg:border-r lg:border-white/15"
            )}
          >
            <Image
              src="/brand/favicon.png"
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4"
              aria-hidden="true"
            />
            <span className="max-w-[17rem] font-heading text-sm font-bold uppercase leading-[1.3] tracking-[0.035em] lg:text-[0.95rem]">
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

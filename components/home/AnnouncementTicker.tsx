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
              "flex min-h-11 items-center justify-center gap-2.5 px-3 py-2 text-center sm:px-4 lg:min-h-10 lg:py-1.5",
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
            <span className="max-w-[15rem] font-heading text-[0.68rem] font-bold uppercase leading-[1.25] tracking-[0.045em] sm:text-[0.72rem] lg:text-[0.76rem]">
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

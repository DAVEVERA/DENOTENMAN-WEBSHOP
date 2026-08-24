import Image from "next/image";
import type { AnnouncementTickerCopy } from "@/lib/customer-service-content";

function TickerGroup({
  copy,
  duplicate = false,
}: {
  copy: AnnouncementTickerCopy;
  duplicate?: boolean;
}) {
  return (
    <div className="announcement-ticker__group" aria-hidden={duplicate || undefined}>
      {copy.items.map((item) => (
        <span key={item.id} className="announcement-ticker__usp">
          <Image
            src="/brand/favicon.png"
            alt=""
            width={18}
            height={18}
            className="h-4 w-4 shrink-0 object-contain sm:h-[1.125rem] sm:w-[1.125rem]"
            aria-hidden="true"
          />
          <span>{item.text}</span>
        </span>
      ))}
    </div>
  );
}

export function AnnouncementTicker({ copy }: { copy: AnnouncementTickerCopy }) {
  if (!copy.items.length) return null;

  return (
    <aside
      aria-label={copy.ariaLabel}
      className="relative z-[55] min-h-11 overflow-hidden bg-black text-white"
    >
      <p className="sr-only">{copy.items.map((item) => item.text).join(". ")}</p>
      <div className="announcement-ticker__viewport" aria-hidden="true">
        <div className="announcement-ticker__track">
          <TickerGroup copy={copy} />
          <TickerGroup copy={copy} duplicate />
        </div>
      </div>
    </aside>
  );
}

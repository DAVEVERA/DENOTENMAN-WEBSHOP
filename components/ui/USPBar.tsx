import { Flame, MessageCircleHeart, CalendarClock, type LucideIcon } from "lucide-react";
import type nl from "@/dictionaries/nl.json";

type UspItem = { icon: LucideIcon; label: string };

export function USPBar({
  dictionary,
  shipping,
}: {
  dictionary: typeof nl;
  shipping?: string;
}) {
  const items: UspItem[] = [
    { icon: Flame, label: dictionary.usp.freshRoasted },
    { icon: MessageCircleHeart, label: dictionary.usp.personalAdvice },
    { icon: CalendarClock, label: dictionary.usp.experience },
  ];

  if (shipping) {
    items.push({ icon: CalendarClock, label: shipping });
  }

  return (
    <ul
      data-home-section="usp"
      className="flex flex-wrap justify-center gap-gap-lg bg-transparent py-gap-md text-body-sm text-text"
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-gap-sm">
          <item.icon className="h-5 w-5 text-accent-hover" aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

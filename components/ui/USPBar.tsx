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
      className="grid grid-cols-1 gap-3 bg-transparent px-5 py-5 text-base leading-6 text-text min-[420px]:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:text-body-md"
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-gap-sm sm:justify-center">
          <item.icon className="h-5 w-5 text-accent-hover" aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

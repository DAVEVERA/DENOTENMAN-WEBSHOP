import type { OrderTimelineEvent } from "@/lib/order-timeline";
import { formatAmsterdamDateTime } from "@/lib/amsterdam-calendar";

export function OrderTimeline({ events }: { events: OrderTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-body-sm text-muted">Nog geen gebeurtenissen.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map((event, index) => (
        <li key={`${event.kind}-${event.at.getTime()}-${index}`} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <div>
            <p className="text-body-sm font-semibold text-text">{event.label}</p>
            <p className="text-xs text-muted">
              {formatAmsterdamDateTime(event.at, "nl-NL", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

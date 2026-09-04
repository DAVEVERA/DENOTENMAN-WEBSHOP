"use client";

import { useRef, useState, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export function Tabs({
  tabs,
  defaultTabId,
}: {
  tabs: { id: string; label: string; content: ReactNode }[];
  defaultTabId?: string;
}) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusAndActivate(id: string) {
    setActiveId(id);
    tabRefs.current[id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = tabs[(index + 1) % tabs.length];
      focusAndActivate(next.id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = tabs[(index - 1 + tabs.length) % tabs.length];
      focusAndActivate(prev.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAndActivate(tabs[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAndActivate(tabs[tabs.length - 1].id);
    }
  }

  return (
    <div>
      <div
        role="tablist"
        className="flex w-full max-w-full gap-2 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeId === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeId === tab.id ? 0 : -1}
            onClick={() => setActiveId(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-h-11 shrink-0 border-b-2 px-4 py-2 font-heading text-body-md transition-colors duration-hover-fast",
              activeId === tab.id
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tabpanel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeId !== tab.id}
          className="py-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Quote, RemoveFormatting } from "lucide-react";

const actions: Array<{
  command: string;
  value?: string;
  label: string;
  icon: typeof Bold;
}> = [
  { command: "bold", label: "Vet", icon: Bold },
  { command: "italic", label: "Cursief", icon: Italic },
  { command: "insertUnorderedList", label: "Opsomming", icon: List },
  { command: "insertOrderedList", label: "Genummerde lijst", icon: ListOrdered },
  { command: "formatBlock", value: "blockquote", label: "Citaat", icon: Quote },
  { command: "removeFormat", label: "Opmaak verwijderen", icon: RemoveFormatting },
];

export function FaqRichTextEditor({
  id,
  value,
  onChange,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  function command(name: string, commandValue?: string) {
    ref.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const href = window.prompt("Plak een volledige of interne URL");
    if (href?.trim()) command("createLink", href.trim());
  }

  return (
    <div className="mt-1 overflow-hidden rounded-button border border-border bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      <div role="toolbar" aria-label={`${label} opmaak`} className="flex flex-wrap gap-1 border-b border-border bg-background p-2">
        {actions.map(({ command: name, value: commandValue, label: actionLabel, icon: Icon }) => (
          <button
            key={`${name}-${commandValue ?? ""}`}
            type="button"
            title={actionLabel}
            aria-label={actionLabel}
            onMouseDown={(event) => {
              event.preventDefault();
              command(name, commandValue);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              command(name, commandValue);
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button text-text hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          title="Link invoegen"
          aria-label="Link invoegen"
          onMouseDown={(event) => {
            event.preventDefault();
            addLink();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            addLink();
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button text-text hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="product-rich-text min-h-40 px-3 py-3 text-body-sm text-text outline-none"
      />
    </div>
  );
}

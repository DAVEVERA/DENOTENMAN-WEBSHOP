"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
} from "lucide-react";

type RichTextEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
};

const toolbarButtons: Array<{
  command: string;
  value?: string;
  label: string;
  icon: typeof Bold;
}> = [
  { command: "bold", label: "Vet", icon: Bold },
  { command: "italic", label: "Cursief", icon: Italic },
  { command: "formatBlock", value: "h2", label: "Kop 2", icon: Heading2 },
  { command: "formatBlock", value: "h3", label: "Kop 3", icon: Heading3 },
  { command: "insertUnorderedList", label: "Opsomming", icon: List },
  { command: "insertOrderedList", label: "Genummerde lijst", icon: ListOrdered },
  { command: "formatBlock", value: "blockquote", label: "Citaat", icon: Quote },
  { command: "removeFormat", label: "Opmaak verwijderen", icon: RemoveFormatting },
];

export function RichTextEditor({ id, value, onChange, ariaLabel }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function addLink() {
    const href = window.prompt("Plak een volledige of interne URL");
    if (!href?.trim()) return;
    runCommand("createLink", href.trim());
  }

  return (
    <div className="mt-1 overflow-hidden rounded-button border border-border bg-white focus-within:border-accent">
      <div
        role="toolbar"
        aria-label={`${ariaLabel} opmaak`}
        className="flex flex-wrap gap-1 border-b border-border bg-background p-2"
      >
        {toolbarButtons.map(({ command, value: commandValue, label, icon: Icon }) => (
          <button
            key={`${command}-${commandValue ?? ""}`}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand(command, commandValue);
            }}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-button border border-transparent text-text hover:border-border hover:bg-white"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          aria-label="Link invoegen"
          title="Link invoegen"
          onMouseDown={(event) => {
            event.preventDefault();
            addLink();
          }}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-button border border-transparent text-text hover:border-border hover:bg-white"
        >
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="prose prose-sm min-h-48 max-w-none px-3 py-3 text-body-sm text-text outline-none"
      />
    </div>
  );
}

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
  Pilcrow,
  Quote,
  RemoveFormatting,
} from "lucide-react";

type RichTextEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  profile?: "short" | "full";
  maxPlainTextLength?: number;
};

const toolbarButtons: Array<{
  command: string;
  value?: string;
  label: string;
  icon: typeof Bold;
}> = [
  { command: "formatBlock", value: "p", label: "Alinea", icon: Pilcrow },
  { command: "bold", label: "Vet", icon: Bold },
  { command: "italic", label: "Cursief", icon: Italic },
  { command: "formatBlock", value: "h2", label: "Kop 2", icon: Heading2 },
  { command: "formatBlock", value: "h3", label: "Kop 3", icon: Heading3 },
  { command: "insertUnorderedList", label: "Opsomming", icon: List },
  { command: "insertOrderedList", label: "Genummerde lijst", icon: ListOrdered },
  { command: "formatBlock", value: "blockquote", label: "Citaat", icon: Quote },
  { command: "removeFormat", label: "Opmaak verwijderen", icon: RemoveFormatting },
];

const shortToolbarCommands = new Set(["formatBlock-p", "bold-", "italic-", "removeFormat-"]);

function normalizeEditorMarkup(editor: HTMLDivElement) {
  const sizeTokens: Record<string, string> = { "2": "sm", "3": "md", "4": "lg" };
  for (const font of Array.from(editor.querySelectorAll("font"))) {
    const span = document.createElement("span");
    const face = font.getAttribute("face")?.toLowerCase();
    const size = font.getAttribute("size") ?? "";
    if (face === "product-body" || face === "product-heading") {
      span.dataset.rtFont = face === "product-heading" ? "heading" : "body";
    }
    if (sizeTokens[size]) span.dataset.rtSize = sizeTokens[size];
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
  }
}

export function RichTextEditor({
  id,
  value,
  onChange,
  ariaLabel,
  profile = "full",
  maxPlainTextLength,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValidHtmlRef = useRef(value);
  const selectionRef = useRef<Range | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
    lastValidHtmlRef.current = value;
  }, [value]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) return;
    normalizeEditorMarkup(editor);
    const plainLength = (editor.textContent ?? "").replace(/\u200b/g, "").length;
    if (maxPlainTextLength !== undefined && plainLength > maxPlainTextLength) {
      editor.innerHTML = lastValidHtmlRef.current;
      editor.focus();
      document.execCommand("selectAll", false);
      document.getSelection()?.collapseToEnd();
      return;
    }
    lastValidHtmlRef.current = editor.innerHTML;
    onChange(editor.innerHTML);
  }

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = document.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const range = selectionRef.current;
    if (!range) return;
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
    emitChange();
    rememberSelection();
  }

  function applyFont(value: string) {
    if (!value) return runCommand("removeFormat");
    runCommand("fontName", value === "heading" ? "product-heading" : "product-body");
  }

  function applySize(value: string) {
    if (!value) return runCommand("removeFormat");
    runCommand("fontSize", value === "sm" ? "2" : value === "lg" ? "4" : "3");
  }

  function addLink() {
    const href = window.prompt("Plak een volledige of interne URL");
    if (!href?.trim()) return;
    const normalized = href.trim();
    if (!/^(?:https?:\/\/|mailto:|\/)/i.test(normalized)) {
      window.alert("Gebruik een volledige https-link, mailto-link of interne link die met / begint.");
      return;
    }
    runCommand("createLink", normalized);
  }

  return (
    <div className="mt-1 overflow-hidden rounded-button border border-border bg-white focus-within:border-accent">
      <div
        role="toolbar"
        aria-label={`${ariaLabel} opmaak`}
        className="flex flex-wrap gap-1 border-b border-border bg-background p-2"
      >
        {toolbarButtons
          .filter(({ command, value: commandValue }) =>
            profile === "full" || shortToolbarCommands.has(`${command}-${commandValue ?? ""}`)
          )
          .map(({ command, value: commandValue, label, icon: Icon }) => (
          <button
            key={`${command}-${commandValue ?? ""}`}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand(command, commandValue);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              runCommand(command, commandValue);
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-transparent text-text hover:border-border hover:bg-white"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
        {profile === "full" ? <button
          type="button"
          aria-label="Link invoegen"
          title="Link invoegen"
          onMouseDown={(event) => {
            event.preventDefault();
            addLink();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            addLink();
          }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button border border-transparent text-text hover:border-border hover:bg-white"
        >
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
        </button> : null}
        <label className="sr-only" htmlFor={`${id}-font`}>Lettertype</label>
        <select
          id={`${id}-font`}
          aria-label="Lettertype"
          defaultValue=""
          onChange={(event) => {
            applyFont(event.target.value);
            event.target.value = "";
          }}
          className="min-h-11 rounded-button border border-border bg-white px-2 text-body-sm"
        >
          <option value="">Lettertype</option>
          <option value="body">Merktekst</option>
          <option value="heading">Merkkop</option>
        </select>
        <label className="sr-only" htmlFor={`${id}-size`}>Tekstgrootte</label>
        <select
          id={`${id}-size`}
          aria-label="Tekstgrootte"
          defaultValue=""
          onChange={(event) => {
            applySize(event.target.value);
            event.target.value = "";
          }}
          className="min-h-11 rounded-button border border-border bg-white px-2 text-body-sm"
        >
          <option value="">Tekstgrootte</option>
          <option value="sm">Klein</option>
          <option value="md">Normaal</option>
          <option value="lg">Groot</option>
        </select>
      </div>
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          emitChange();
        }}
        className={`product-rich-text max-w-none px-3 py-3 text-body-sm text-text outline-none ${profile === "short" ? "min-h-28" : "min-h-48"}`}
      />
    </div>
  );
}

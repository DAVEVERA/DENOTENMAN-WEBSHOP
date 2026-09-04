"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// Mirrors lib/aftersales/schema.ts's MAX_TABLE_COLUMNS / MAX_TABLE_ROWS /
// aftersalesTableRowSchema limits, which aren't exported from that module
// (it's a DB-bound schema, not a shared constants file) — kept in sync
// manually.
const MAX_TABLE_COLUMNS = 6;
const MAX_TABLE_ROWS = 20;
const HEADER_MAX_LENGTH = 80;
const CELL_MAX_LENGTH = 200;

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (headers: string[], rows: string[][]) => void;
};

export function InsertTableDialog({ open, onClose, onInsert }: Props) {
  const [headers, setHeaders] = useState<string[]>([""]);
  const [rows, setRows] = useState<string[][]>([[""]]);

  if (!open) return null;

  function reset() {
    setHeaders([""]);
    setRows([[""]]);
  }

  function close() {
    reset();
    onClose();
  }

  function confirm() {
    onInsert(
      headers.map((header) => header.trim()),
      rows.map((cells) => cells.map((cell) => cell.trim()))
    );
    reset();
  }

  function addColumn() {
    if (headers.length >= MAX_TABLE_COLUMNS) return;
    setHeaders((current) => [...current, ""]);
    setRows((current) => current.map((cells) => [...cells, ""]));
  }

  function removeColumn(colIndex: number) {
    setHeaders((current) => current.filter((_, i) => i !== colIndex));
    setRows((current) => current.map((cells) => cells.filter((_, i) => i !== colIndex)));
  }

  function updateHeader(colIndex: number, value: string) {
    setHeaders((current) => current.map((header, i) => (i === colIndex ? value : header)));
  }

  function addRow() {
    if (rows.length >= MAX_TABLE_ROWS) return;
    const columnCount = Math.max(headers.length, 1);
    setRows((current) => [...current, Array.from({ length: columnCount }, () => "")]);
  }

  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((_, i) => i !== rowIndex));
  }

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    setRows((current) =>
      current.map((cells, i) => (i === rowIndex ? cells.map((cell, j) => (j === colIndex ? value : cell)) : cells))
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Tabel invoegen">
      <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-panel bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-heading-md">Tabel invoegen</h2>
          <button type="button" onClick={close} aria-label="Sluiten" className="flex h-9 w-9 items-center justify-center rounded-button border border-border">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-heading text-body-sm font-semibold">Tabel (max {MAX_TABLE_COLUMNS} kolommen, {MAX_TABLE_ROWS} rijen)</p>
          <div className="flex gap-2">
            <button type="button" onClick={addColumn} disabled={headers.length >= MAX_TABLE_COLUMNS} className="inline-flex min-h-9 items-center gap-1 rounded-button border border-border bg-white px-3 text-xs font-semibold disabled:opacity-40">
              <Plus size={14} />
              Kolom
            </button>
            <button type="button" onClick={addRow} disabled={rows.length >= MAX_TABLE_ROWS} className="inline-flex min-h-9 items-center gap-1 rounded-button border border-border bg-white px-3 text-xs font-semibold disabled:opacity-40">
              <Plus size={14} />
              Rij
            </button>
          </div>
        </div>

        {headers.length === 0 ? (
          <p className="mt-2 text-body-sm text-muted">Voeg eerst een kolom toe.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-body-sm">
              <thead>
                <tr>
                  {headers.map((header, colIndex) => (
                    <th key={colIndex} className="px-1 pb-2 text-left">
                      <div className="flex items-center gap-1">
                        <input
                          value={header}
                          maxLength={HEADER_MAX_LENGTH}
                          onChange={(event) => updateHeader(colIndex, event.target.value)}
                          placeholder={`Kolom ${colIndex + 1}`}
                          className="min-h-9 w-full rounded-button border border-border bg-white px-2 text-xs font-bold"
                        />
                        <button type="button" onClick={() => removeColumn(colIndex)} aria-label="Verwijder kolom" className="shrink-0 text-red-700">
                          <X size={14} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((cells, rowIndex) => (
                  <tr key={rowIndex}>
                    {headers.map((_, colIndex) => (
                      <td key={colIndex} className="px-1 py-1">
                        <input
                          value={cells[colIndex] ?? ""}
                          maxLength={CELL_MAX_LENGTH}
                          onChange={(event) => updateCell(rowIndex, colIndex, event.target.value)}
                          className="min-h-9 w-full rounded-button border border-border bg-white px-2 text-xs"
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => removeRow(rowIndex)} aria-label="Verwijder rij" className="text-red-700">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={close} className="min-h-11 rounded-button border border-border px-4 font-heading text-body-sm font-semibold">Annuleren</button>
          <button type="button" onClick={confirm} className="min-h-11 rounded-button bg-accent px-5 font-heading text-body-sm font-bold text-contrast shadow-button">Invoegen</button>
        </div>
      </div>
    </div>
  );
}

function flatten(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const beforeObj = flatten(before);
  const afterObj = flatten(after);
  const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])).sort();
  const changedKeys = keys.filter((key) => formatValue(beforeObj[key]) !== formatValue(afterObj[key]));

  if (changedKeys.length === 0) {
    return <p className="text-body-sm text-muted">Geen veldwijzigingen.</p>;
  }

  return (
    <table className="w-full text-body-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="py-1 pr-4 font-heading">Veld</th>
          <th className="py-1 pr-4 font-heading">Was</th>
          <th className="py-1 font-heading">Werd</th>
        </tr>
      </thead>
      <tbody>
        {changedKeys.map((key) => (
          <tr key={key} className="border-t border-border">
            <td className="py-1.5 pr-4 font-mono text-text">{key}</td>
            <td className="py-1.5 pr-4 text-muted">{formatValue(beforeObj[key])}</td>
            <td className="py-1.5 text-text">{formatValue(afterObj[key])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

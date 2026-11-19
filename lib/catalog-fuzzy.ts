function words(value: string): string[] {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/gu, " ").trim().split(/\s+/u).filter(Boolean);
}

function distance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + Number(left[row - 1] !== right[column - 1]),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function typoMatchScore(query: string, name: string): number | null {
  const requested = words(query);
  const available = words(name);
  if (requested.length === 0 || available.length === 0) return null;
  let score = 0;
  for (const term of requested) {
    const allowed = term.length <= 2 ? 0 : term.length <= 5 ? 1 : 2;
    const best = Math.min(...available.map((word) =>
      word.includes(term) ? 0 : distance(term, word)));
    if (best > allowed) return null;
    score += best;
  }
  return score;
}

export function rankTypoMatches<T extends { id: string; names: string[] }>(query: string, products: T[]): Array<T & { score: number }> {
  return products.flatMap((product) => {
    const scores = product.names.map((name) => typoMatchScore(query, name)).filter((score): score is number => score !== null);
    return scores.length ? [{ ...product, score: Math.min(...scores) }] : [];
  }).sort((left, right) => left.score - right.score || left.id.localeCompare(right.id));
}

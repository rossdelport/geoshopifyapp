// Turn "Q: ... / A: ..." text back into FAQ items. Pure (tested).

export function parseFaq(text: string): { q: string; a: string }[] | null {
  const items = text
    .split(/\n\s*\n/)
    .map((block) => {
      const q = block.match(/Q:\s*([\s\S]*?)\nA:/)?.[1]?.trim();
      const a = block.match(/A:\s*([\s\S]*)$/)?.[1]?.trim();
      return q && a ? { q, a } : null;
    })
    .filter((x): x is { q: string; a: string } => Boolean(x));
  return items.length ? items : null;
}

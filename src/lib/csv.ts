/** Parse CSV with quoted fields and doubled-quote escapes (RFC 4180-style). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;

  const flushCell = () => {
    row.push(cur);
    cur = "";
  };
  const flushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      flushCell();
      i += 1;
      continue;
    }
    if (c === "\n") {
      flushCell();
      flushRow();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  flushCell();
  rows.push(row);
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

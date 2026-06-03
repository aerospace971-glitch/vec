function escapeCsvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCSV(rows = [], columns = null) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const keys = columns || Array.from(
    safeRows.reduce((set, row) => {
      Object.keys(row || {}).forEach(key => set.add(key));
      return set;
    }, new Set())
  );

  const header = keys.map(escapeCsvCell).join(",");
  const body = safeRows.map(row =>
    keys.map(key => escapeCsvCell(row?.[key])).join(",")
  );

  return [header, ...body].filter(Boolean).join("\n");
}

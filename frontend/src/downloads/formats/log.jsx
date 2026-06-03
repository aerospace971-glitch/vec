export function buildLOG(entries = []) {
  if (typeof entries === "string") return entries;
  return (entries || [])
    .map(entry => {
      if (typeof entry === "string") return entry;
      const label = entry?.label || entry?.phase || entry?.level || "log";
      const message = entry?.message || entry?.code || JSON.stringify(entry);
      return `[${label}] ${message}`;
    })
    .join("\n");
}

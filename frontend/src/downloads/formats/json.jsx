export function buildJSON(data, space = 2) {
  return JSON.stringify(data ?? null, null, space);
}

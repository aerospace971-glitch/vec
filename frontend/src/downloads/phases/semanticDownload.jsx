import { buildCSV } from "../formats/csv";
import { buildJSON } from "../formats/json";
import { makeFilename, downloadContent } from "../downloadUtils";

export function shapeSymbols(symbols = []) {
  const rows = Array.isArray(symbols) ? symbols : Object.values(symbols || {});
  return rows.map((symbol, index) => ({
    index,
    name: symbol.name || symbol.identifier || "",
    type: symbol.type || symbol.dataType || "",
    kind: symbol.kind || "",
    scope: symbol.scope || "",
    line: symbol.line ?? "",
  }));
}

export function downloadSymbols_JSON(symbols, filename = makeFilename("semantic-symbols", "json")) {
  downloadContent(buildJSON(shapeSymbols(symbols)), filename, "json");
}

export function downloadSymbols_CSV(symbols, filename = makeFilename("semantic-symbols", "csv")) {
  downloadContent(buildCSV(shapeSymbols(symbols)), filename, "csv");
}

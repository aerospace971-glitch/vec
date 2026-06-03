import { buildCSV } from "../formats/csv";
import { buildJSON } from "../formats/json";
import { makeFilename, downloadContent } from "../downloadUtils";

export function shapeTokens(tokens = []) {
  return (tokens || []).map((token, index) => ({
    index,
    type: token.type || token.kind || "",
    value: token.value || token.lexeme || "",
    line: token.line ?? "",
    col: token.col ?? token.column ?? "",
  }));
}

export function downloadTokens_JSON(tokens, filename = makeFilename("lexer-tokens", "json")) {
  downloadContent(buildJSON(shapeTokens(tokens)), filename, "json");
}

export function downloadTokens_CSV(tokens, filename = makeFilename("lexer-tokens", "csv")) {
  downloadContent(buildCSV(shapeTokens(tokens)), filename, "csv");
}

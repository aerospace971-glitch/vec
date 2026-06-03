import { buildCSV } from "../formats/csv";
import { buildJSON } from "../formats/json";
import { makeFilename, downloadContent } from "../downloadUtils";

export function shapeTAC(tac = []) {
  return (tac || []).map(instr => ({
    id: instr.id ?? "",
    op: instr.op || "",
    result: instr.result || "",
    arg1: instr.arg1 || "",
    arg2: instr.arg2 || "",
    code: instr.code || "",
    comment: instr.comment || "",
    line: instr.line ?? "",
  }));
}

export function downloadTAC_JSON(tac, filename = makeFilename("ir-tac", "json")) {
  downloadContent(buildJSON(shapeTAC(tac)), filename, "json");
}

export function downloadTAC_CSV(tac, filename = makeFilename("ir-tac", "csv")) {
  downloadContent(buildCSV(shapeTAC(tac)), filename, "csv");
}

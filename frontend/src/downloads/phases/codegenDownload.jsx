import { buildASM } from "../formats/asm";
import { buildCSV } from "../formats/csv";
import { buildJSON } from "../formats/json";
import { makeFilename, downloadContent } from "../downloadUtils";

export function shapeAssembly(assembly = []) {
  return (assembly || []).map(instr => typeof instr === "string" ? { code: instr } : ({
    id: instr.id ?? "",
    op: instr.op || "",
    dst: instr.dst || "",
    src1: instr.src1 || "",
    src2: instr.src2 || "",
    code: instr.code || "",
    comment: instr.comment || "",
    tacId: instr.tacId ?? "",
  }));
}

export function downloadAssembly_ASM(assembly, filename = makeFilename("codegen-assembly", "asm")) {
  downloadContent(buildASM(assembly), filename, "asm");
}

export function downloadAssembly_JSON(assembly, filename = makeFilename("codegen-assembly", "json")) {
  downloadContent(buildJSON(shapeAssembly(assembly)), filename, "json");
}

export function downloadAssembly_CSV(assembly, filename = makeFilename("codegen-assembly", "csv")) {
  downloadContent(buildCSV(shapeAssembly(assembly)), filename, "csv");
}

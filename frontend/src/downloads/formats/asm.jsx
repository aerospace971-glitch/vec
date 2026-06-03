export function buildASM(instructions = []) {
  if (typeof instructions === "string") return instructions;
  return (instructions || [])
    .map(instr => typeof instr === "string" ? instr : (instr?.code || ""))
    .filter(Boolean)
    .join("\n");
}

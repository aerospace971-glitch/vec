// VRM Assembly Instruction Reference
// StepExecutor imports this to show live instruction explanations

const instructionDocs = {

  // ── Data Movement ──────────────────────────────────────────────
  MOV: {
    category: "Data Movement",
    syntax:   "MOV dst, src",
    what:     "Copies the value of src into register dst.",
    how:      "dst ← src",
    example:  "MOV R0, R1       ; R0 = R1\nMOV R2, #42      ; R2 = 42",
  },
  LOAD: {
    category: "Data Movement",
    syntax:   "LOAD dst, [mem]",
    what:     "Reads a value from a memory address into dst.",
    how:      "dst ← MEM[addr]",
    example:  "LOAD R0, [MEM[4]]  ; R0 = memory slot 4",
  },
  STORE: {
    category: "Data Movement",
    syntax:   "STORE [mem], src",
    what:     "Writes the value of src into a memory address.",
    how:      "MEM[addr] ← src",
    example:  "STORE [MEM[4]], R0  ; memory slot 4 = R0",
  },
  PUSH: {
    category: "Data Movement",
    syntax:   "PUSH reg",
    what:     "Pushes a value onto the top of the stack.",
    how:      "stack.push(reg)",
    example:  "PUSH R0   ; saves R0 on stack",
  },
  POP: {
    category: "Data Movement",
    syntax:   "POP dst",
    what:     "Pops the top value from the stack into dst.",
    how:      "dst ← stack.pop()",
    example:  "POP R0    ; restores R0 from stack",
  },

  // ── Arithmetic ─────────────────────────────────────────────────
  ADD: {
    category: "Arithmetic",
    syntax:   "ADD dst, src1, src2",
    what:     "Adds src1 and src2, stores result in dst.",
    how:      "dst ← src1 + src2",
    example:  "ADD R0, R1, R2   ; R0 = R1 + R2",
  },
  SUB: {
    category: "Arithmetic",
    syntax:   "SUB dst, src1, src2",
    what:     "Subtracts src2 from src1, stores result in dst.",
    how:      "dst ← src1 − src2",
    example:  "SUB R0, R1, R2   ; R0 = R1 - R2",
  },
  MUL: {
    category: "Arithmetic",
    syntax:   "MUL dst, src1, src2",
    what:     "Multiplies src1 by src2, stores result in dst.",
    how:      "dst ← src1 × src2",
    example:  "MUL R0, R1, R2   ; R0 = R1 * R2",
  },
  DIV: {
    category: "Arithmetic",
    syntax:   "DIV dst, src1, src2",
    what:     "Divides src1 by src2 (integer division), stores in dst.",
    how:      "dst ← floor(src1 / src2)",
    example:  "DIV R0, R1, R2   ; R0 = R1 / R2",
  },
  MOD: {
    category: "Arithmetic",
    syntax:   "MOD dst, src1, src2",
    what:     "Divides src1 by src2 and stores the remainder in dst.",
    how:      "dst ← src1 % src2",
    example:  "MOD R0, R1, #3   ; R0 = R1 mod 3",
  },
  NEG: {
    category: "Arithmetic",
    syntax:   "NEG dst, src",
    what:     "Negates src and stores result in dst.",
    how:      "dst ← −src",
    example:  "NEG R0, R1       ; R0 = -R1",
  },

  // ── Comparison ─────────────────────────────────────────────────
  CMP: {
    category: "Comparison",
    syntax:   "CMP src1, src2",
    what:     "Compares src1 and src2 by subtracting. Sets internal flag used by SET* and jump instructions.",
    how:      "flag ← src1 − src2",
    example:  "CMP R0, #10      ; compare R0 with 10",
  },
  SETE: {
    category: "Comparison",
    syntax:   "SETE dst",
    what:     "Sets dst = 1 if last CMP result was equal (flag == 0), else 0.",
    how:      "dst ← (flag == 0) ? 1 : 0",
    example:  "CMP R0, R1\nSETE R2     ; R2 = 1 if R0 == R1",
  },
  SETNE: {
    category: "Comparison",
    syntax:   "SETNE dst",
    what:     "Sets dst = 1 if last CMP result was NOT equal.",
    how:      "dst ← (flag != 0) ? 1 : 0",
    example:  "CMP R0, R1\nSETNE R2    ; R2 = 1 if R0 != R1",
  },
  SETL: {
    category: "Comparison",
    syntax:   "SETL dst",
    what:     "Sets dst = 1 if src1 < src2 in last CMP.",
    how:      "dst ← (flag < 0) ? 1 : 0",
    example:  "CMP R0, R1\nSETL R2     ; R2 = 1 if R0 < R1",
  },
  SETG: {
    category: "Comparison",
    syntax:   "SETG dst",
    what:     "Sets dst = 1 if src1 > src2 in last CMP.",
    how:      "dst ← (flag > 0) ? 1 : 0",
    example:  "CMP R0, R1\nSETG R2     ; R2 = 1 if R0 > R1",
  },
  SETLE: {
    category: "Comparison",
    syntax:   "SETLE dst",
    what:     "Sets dst = 1 if src1 <= src2 in last CMP.",
    how:      "dst ← (flag <= 0) ? 1 : 0",
    example:  "CMP R0, R1\nSETLE R2    ; R2 = 1 if R0 <= R1",
  },
  SETGE: {
    category: "Comparison",
    syntax:   "SETGE dst",
    what:     "Sets dst = 1 if src1 >= src2 in last CMP.",
    how:      "dst ← (flag >= 0) ? 1 : 0",
    example:  "CMP R0, R1\nSETGE R2    ; R2 = 1 if R0 >= R1",
  },

  // ── Logical ────────────────────────────────────────────────────
  AND: {
    category: "Logical",
    syntax:   "AND dst, src1, src2",
    what:     "Bitwise AND of src1 and src2, stores in dst.",
    how:      "dst ← src1 & src2",
    example:  "AND R0, R1, R2   ; R0 = R1 & R2",
  },
  OR: {
    category: "Logical",
    syntax:   "OR dst, src1, src2",
    what:     "Bitwise OR of src1 and src2, stores in dst.",
    how:      "dst ← src1 | src2",
    example:  "OR R0, R1, R2    ; R0 = R1 | R2",
  },
  NOT: {
    category: "Logical",
    syntax:   "NOT dst, src",
    what:     "Bitwise NOT of src, stores in dst.",
    how:      "dst ← ~src",
    example:  "NOT R0, R1       ; R0 = ~R1",
  },
  XOR: {
    category: "Logical",
    syntax:   "XOR dst, src1, src2",
    what:     "Bitwise XOR of src1 and src2, stores in dst.",
    how:      "dst ← src1 ^ src2",
    example:  "XOR R0, R1, R2   ; R0 = R1 ^ R2",
  },

  // ── Control Flow ───────────────────────────────────────────────
  JMP: {
    category: "Control Flow",
    syntax:   "JMP label",
    what:     "Unconditionally jumps execution to a label.",
    how:      "PC ← address of label",
    example:  "JMP loop_start   ; always jump to loop_start",
  },
  JZ: {
    category: "Control Flow",
    syntax:   "JZ label",
    what:     "Jumps to label only if last CMP result was zero (equal).",
    how:      "if (flag == 0) PC ← label",
    example:  "CMP R0, #0\nJZ done      ; jump if R0 == 0",
  },
  JNZ: {
    category: "Control Flow",
    syntax:   "JNZ label",
    what:     "Jumps to label only if last CMP result was non-zero (not equal).",
    how:      "if (flag != 0) PC ← label",
    example:  "CMP R0, #0\nJNZ loop     ; jump if R0 != 0",
  },
  CALL: {
    category: "Control Flow",
    syntax:   "CALL funcName",
    what:     "Calls a function. Saves the return address on the call stack, then jumps to the function.",
    how:      "call_stack.push(PC+1)  ->  PC = funcName",
    example:  "CALL factorial   ; call factorial, return here after RET",
  },
  RET: {
    category: "Control Flow",
    syntax:   "RET",
    what:     "Returns from a function. Pops the return address from the call stack and jumps to it.",
    how:      "PC = call_stack.pop()",
    example:  "RET   ; go back to the instruction after CALL",
  },

  // ── Function ───────────────────────────────────────────────────
  FUNC_BEGIN: {
    category: "Function",
    syntax:   "FUNC_BEGIN name",
    what:     "Marks the start of a function. Acts as a label for CALL to jump to.",
    how:      "No-op at runtime — just marks entry point.",
    example:  "FUNC_BEGIN factorial",
  },
  FUNC_END: {
    category: "Function",
    syntax:   "FUNC_END name",
    what:     "Marks the end of a function definition.",
    how:      "No-op at runtime.",
    example:  "FUNC_END factorial",
  },
  LABEL: {
    category: "Control Flow",
    syntax:   "label:",
    what:     "Defines a jump target. Used by JMP, JZ, JNZ.",
    how:      "No-op at runtime — just marks position.",
    example:  "loop_start:   ; target for JMP loop_start",
  },

  // ── I/O ────────────────────────────────────────────────────────
  PRINT: {
    category: "I/O",
    syntax:   "PRINT reg / #val / \"str\"",
    what:     "Outputs a value to the Program Output panel.",
    how:      "output ← value of operand",
    example:  "PRINT R0         ; print value in R0\nPRINT #42        ; print 42\nPRINT \"hello\"    ; print string",
  },
  READ: {
    category: "I/O",
    syntax:   "READ dst",
    what:     "Reads a value from user input and stores it in dst.",
    how:      "dst ← user_input",
    example:  "READ R0   ; pause and wait for user to enter a number",
  },

  // ── Special ────────────────────────────────────────────────────
  NOP: {
    category: "Special",
    syntax:   "NOP",
    what:     "No operation. Does nothing for one cycle.",
    how:      "PC ← PC + 1",
    example:  "NOP   ; skip one cycle",
  },
};

export default instructionDocs;

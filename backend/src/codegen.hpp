#pragma once
#include "optimizer.hpp"
#include <string>
#include <vector>
#include <unordered_map>

// ── Register names ─────────────────────────────────────────
enum class Reg {
    R0, R1, R2, R3, R4, R5, R6, R7,
    NONE
};

inline std::string regName(Reg r) {
    switch (r) {
        case Reg::R0: return "R0";
        case Reg::R1: return "R1";
        case Reg::R2: return "R2";
        case Reg::R3: return "R3";
        case Reg::R4: return "R4";
        case Reg::R5: return "R5";
        case Reg::R6: return "R6";
        case Reg::R7: return "R7";
        default:      return "NONE";
    }
}

// ── Assembly instruction types ─────────────────────────────
enum class AsmOp {
    // Data movement
    MOV,        // MOV dst, src
    LOAD,       // LOAD reg, [mem]
    STORE,      // STORE [mem], reg
    PUSH,       // PUSH reg
    POP,        // POP reg

    // Arithmetic
    ADD,        // ADD dst, src1, src2
    SUB,        // SUB dst, src1, src2
    MUL,        // MUL dst, src1, src2
    DIV,        // DIV dst, src1, src2
    MOD,        // MOD dst, src1, src2
    NEG,        // NEG dst, src

    // Comparison
    CMP,        // CMP src1, src2
    SETE,       // SETE dst  (set if equal)
    SETNE,      // SETNE dst
    SETL,       // SETL dst
    SETG,       // SETG dst
    SETLE,      // SETLE dst
    SETGE,      // SETGE dst

    // Logical
    AND,        // AND dst, src1, src2
    OR,         // OR  dst, src1, src2
    NOT,        // NOT dst, src
    XOR,        // XOR dst, src1, src2
    SHL,        // SHL dst, src1, src2  (left shift)
    SHR,        // SHR dst, src1, src2  (right shift)

    // Control flow
    JMP,        // JMP label
    JZ,         // JZ  label  (jump if zero)
    JNZ,        // JNZ label  (jump if not zero)
    LABEL,      // label:
    CALL,       // CALL func
    RET,        // RET

    // Function
    FUNC_BEGIN, // function prologue
    FUNC_END,   // function epilogue

    // I/O
    PRINT,      // PRINT reg
    READ,       // READ into register

    // Special
    NOP,        // NOP
    COMMENT,    // ; comment line
};

inline std::string asmOpName(AsmOp op) {
    switch (op) {
        case AsmOp::MOV:        return "MOV";
        case AsmOp::LOAD:       return "LOAD";
        case AsmOp::STORE:      return "STORE";
        case AsmOp::PUSH:       return "PUSH";
        case AsmOp::POP:        return "POP";
        case AsmOp::ADD:        return "ADD";
        case AsmOp::SUB:        return "SUB";
        case AsmOp::MUL:        return "MUL";
        case AsmOp::DIV:        return "DIV";
        case AsmOp::MOD:        return "MOD";
        case AsmOp::NEG:        return "NEG";
        case AsmOp::CMP:        return "CMP";
        case AsmOp::SETE:       return "SETE";
        case AsmOp::SETNE:      return "SETNE";
        case AsmOp::SETL:       return "SETL";
        case AsmOp::SETG:       return "SETG";
        case AsmOp::SETLE:      return "SETLE";
        case AsmOp::SETGE:      return "SETGE";
        case AsmOp::AND:        return "AND";
        case AsmOp::OR:         return "OR";
        case AsmOp::NOT:        return "NOT";
        case AsmOp::XOR:        return "XOR";
        case AsmOp::SHL:        return "SHL";
        case AsmOp::SHR:        return "SHR";
        case AsmOp::JMP:        return "JMP";
        case AsmOp::JZ:         return "JZ";
        case AsmOp::JNZ:        return "JNZ";
        case AsmOp::LABEL:      return "LABEL";
        case AsmOp::CALL:       return "CALL";
        case AsmOp::RET:        return "RET";
        case AsmOp::FUNC_BEGIN: return "FUNC_BEGIN";
        case AsmOp::FUNC_END:   return "FUNC_END";
        case AsmOp::PRINT:      return "PRINT";
        case AsmOp::READ:       return "READ";
        case AsmOp::NOP:        return "NOP";
        case AsmOp::COMMENT:    return ";";
        default:                return "UNKNOWN";
    }
}

// ── Single assembly instruction ────────────────────────────
struct AsmInstr {
    int         id;
    AsmOp       op;
    std::string dst;     // destination register/label/mem
    std::string src1;    // first source
    std::string src2;    // second source (optional)
    std::string comment; // inline comment
    int         tacId;   // which TAC instruction generated this

    AsmInstr(int id_, AsmOp op_,
             std::string dst_  = "",
             std::string src1_ = "",
             std::string src2_ = "",
             std::string cmt_  = "",
             int         tid_  = 0)
        : id(id_), op(op_),
          dst(std::move(dst_)),
          src1(std::move(src1_)),
          src2(std::move(src2_)),
          comment(std::move(cmt_)),
          tacId(tid_) {}

    // Human readable assembly string
    std::string toString() const {
        std::string s;
        switch (op) {
            case AsmOp::LABEL:
                return dst + ":";
            case AsmOp::FUNC_BEGIN:
                return "section " + dst + "\n    PUSH RBP\n    MOV RBP, RSP";
            case AsmOp::FUNC_END:
                return "FUNC_END " + dst;
            case AsmOp::COMMENT:
                return "    ; " + comment;
            case AsmOp::MOV:
                return "    MOV " + dst + ", " + src1;
            case AsmOp::LOAD:
                return "    LOAD " + dst + ", [" + src1 + "]";
            case AsmOp::STORE:
                return "    STORE [" + dst + "], " + src1;
            case AsmOp::PUSH:
                return "    PUSH " + dst;
            case AsmOp::POP:
                return "    POP " + dst;
            case AsmOp::ADD:
                return "    ADD " + dst + ", " + src1 + ", " + src2;
            case AsmOp::SUB:
                return "    SUB " + dst + ", " + src1 + ", " + src2;
            case AsmOp::MUL:
                return "    MUL " + dst + ", " + src1 + ", " + src2;
            case AsmOp::DIV:
                return "    DIV " + dst + ", " + src1 + ", " + src2;
            case AsmOp::MOD:
                return "    MOD " + dst + ", " + src1 + ", " + src2;
            case AsmOp::NEG:
                return "    NEG " + dst + ", " + src1;
            case AsmOp::CMP:
                return "    CMP " + src1 + ", " + src2;
            case AsmOp::SETE:  case AsmOp::SETNE:
            case AsmOp::SETL:  case AsmOp::SETG:
            case AsmOp::SETLE: case AsmOp::SETGE:
                return "    " + asmOpName(op) + " " + dst;
            case AsmOp::AND:
                return "    AND " + dst + ", " + src1 + ", " + src2;
            case AsmOp::OR:
                return "    OR "  + dst + ", " + src1 + ", " + src2;
            case AsmOp::NOT:
                return "    NOT " + dst + ", " + src1;
            case AsmOp::XOR:
                return "    XOR " + dst + ", " + src1 + ", " + src2;
            case AsmOp::SHL:
                return "    SHL " + dst + ", " + src1 + ", " + src2;
            case AsmOp::SHR:
                return "    SHR " + dst + ", " + src1 + ", " + src2;
            case AsmOp::JMP:
                return "    JMP " + dst;
            case AsmOp::JZ:
                return "    JZ "  + dst;
            case AsmOp::JNZ:
                return "    JNZ " + dst;
            case AsmOp::CALL:
                return "    CALL " + dst;
            case AsmOp::RET:
                return "    RET";
            case AsmOp::PRINT:
                return "    PRINT " + dst;
            case AsmOp::READ:
                return "    READ " + dst;
            case AsmOp::NOP:
                return "    NOP";
            default:
                return "    ; unknown";
        }
    }

    std::string toJSON() const {
        auto esc = [](const std::string& s) {
            std::string out;
            for (char c : s) {
                if (c == '"')       out += "\\\"";
                else if (c == '\\') out += "\\\\";
                else if (c == '\n') out += "\\n";
                else                out += c;
            }
            return out;
        };
        std::string code = toString();
        // Remove leading spaces for JSON
        size_t start = code.find_first_not_of(' ');
        if (start != std::string::npos) code = code.substr(start);

        return "{"
            "\"id\": "       + std::to_string(id)         + ", "
            "\"op\": \""     + esc(asmOpName(op))         + "\", "
            "\"dst\": \""    + esc(dst)                    + "\", "
            "\"src1\": \""   + esc(src1)                   + "\", "
            "\"src2\": \""   + esc(src2)                   + "\", "
            "\"code\": \""   + esc(code)                   + "\", "
            "\"comment\": \""+ esc(comment)                + "\", "
            "\"tacId\": "    + std::to_string(tacId)       +
            "}";
    }
};

// ── Code Generator ─────────────────────────────────────────
class CodeGenerator {
public:
    CodeGenerator();

    // Main entry
    void generate(const std::vector<TACInstr>& optimized);

    // Results
    const std::vector<AsmInstr>& instructions() const {
        return instrs_;
    }

    // JSON output
    std::string toJSON() const;

    // Assembly listing (human readable)
    std::string toListing() const;

private:
    std::vector<AsmInstr>                instrs_;
    int                                  instrCount_;

    // Register allocator
    std::unordered_map<std::string, Reg> regMap_;   // var → reg
    std::unordered_map<Reg, std::string> regUser_;  // reg → var
    bool                                 regFree_[8];

    // Memory (spill)
    std::unordered_map<std::string, int> memMap_;
    int                                  memOffset_;

    // ── Emit helpers ──────────────────────────────────────
    void emit(AsmOp op,
              const std::string& dst  = "",
              const std::string& src1 = "",
              const std::string& src2 = "",
              const std::string& cmt  = "",
              int                tid  = 0);

    void emitComment(const std::string& text, int tid = 0);

    // ── Register allocation ───────────────────────────────
    Reg  allocReg(const std::string& var);
    Reg  getReg  (const std::string& var);
    void freeReg (const std::string& var);
    void freeReg (Reg r);
    Reg  findFreeReg();
    void spillReg(Reg r);
    std::string loadOperand(const std::string& val, int tid);

    // ── TAC → Assembly translators ────────────────────────
    void genFuncBegin (const TACInstr& t);
    void genFuncEnd   (const TACInstr& t);
    void genAssign    (const TACInstr& t);
    void genBinaryOp  (const TACInstr& t);
    void genUnaryOp   (const TACInstr& t);
    void genJump      (const TACInstr& t);
    void genJumpIf    (const TACInstr& t);
    void genJumpIfNot (const TACInstr& t);
    void genLabel     (const TACInstr& t);
    void genCall      (const TACInstr& t);
    void genReturn    (const TACInstr& t);
    void genParam     (const TACInstr& t);
    void genPrint     (const TACInstr& t);
    void genRead      (const TACInstr& t);

    bool isConstant(const std::string& val) const;
    std::string escapeJSON(const std::string& s) const;
};
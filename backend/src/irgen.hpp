#pragma once
#include "ast.hpp"
#include <string>
#include <vector>

// ── TAC instruction types ──────────────────────────────────
enum class TACOp {
    // Arithmetic
    ADD, SUB, MUL, DIV, MOD,

    // Bitwise
    BIT_AND, BIT_OR, BIT_XOR, BIT_NOT,
    LSHIFT, RSHIFT,

    // Comparison
    EQ, NEQ, LT, GT, LTE, GTE,

    // Logical
    AND, OR, NOT,

    // Assignment
    ASSIGN,     // result = arg1
    COPY,       // result = arg1  (simple copy)

    // Jump / branch
    LABEL,      // label:
    JUMP,       // goto label
    JUMP_IF,    // if arg1 goto label
    JUMP_IFNOT, // ifnot arg1 goto label

    // Function
    FUNC_BEGIN, // begin function
    FUNC_END,   // end function
    PARAM,      // push param
    CALL,       // call function
    RETURN,     // return value

    // Memory
    ARRAY_GET,  // result = arr[idx]
    ARRAY_SET,  // arr[idx] = val
    MEMBER_GET, // result = obj.field
    MEMBER_SET, // obj.field = val
    ADDR_OF,    // result = &var
    DEREF,      // result = *ptr

    // I/O
    PRINT,      // print arg1

    // Cast
    CAST,       // result = (type) arg1

    // Special
    NOP,        // no operation
    UNKNOWN,
};

inline std::string tacOpName(TACOp op) {
    switch (op) {
        case TACOp::ADD:        return "+";
        case TACOp::SUB:        return "-";
        case TACOp::MUL:        return "*";
        case TACOp::DIV:        return "/";
        case TACOp::MOD:        return "%";
        case TACOp::BIT_AND:    return "&";
        case TACOp::BIT_OR:     return "|";
        case TACOp::BIT_XOR:    return "^";
        case TACOp::BIT_NOT:    return "~";
        case TACOp::LSHIFT:     return "<<";
        case TACOp::RSHIFT:     return ">>";
        case TACOp::EQ:         return "==";
        case TACOp::NEQ:        return "!=";
        case TACOp::LT:         return "<";
        case TACOp::GT:         return ">";
        case TACOp::LTE:        return "<=";
        case TACOp::GTE:        return ">=";
        case TACOp::AND:        return "&&";
        case TACOp::OR:         return "||";
        case TACOp::NOT:        return "!";
        case TACOp::ASSIGN:     return "=";
        case TACOp::COPY:       return "copy";
        case TACOp::LABEL:      return "label";
        case TACOp::JUMP:       return "goto";
        case TACOp::JUMP_IF:    return "if_goto";
        case TACOp::JUMP_IFNOT: return "ifnot_goto";
        case TACOp::FUNC_BEGIN: return "func_begin";
        case TACOp::FUNC_END:   return "func_end";
        case TACOp::PARAM:      return "param";
        case TACOp::CALL:       return "call";
        case TACOp::RETURN:     return "return";
        case TACOp::ARRAY_GET:  return "arr_get";
        case TACOp::ARRAY_SET:  return "arr_set";
        case TACOp::MEMBER_GET: return "member_get";
        case TACOp::MEMBER_SET: return "member_set";
        case TACOp::ADDR_OF:    return "addr_of";
        case TACOp::DEREF:      return "deref";
        case TACOp::PRINT:      return "print";
        case TACOp::CAST:       return "cast";
        case TACOp::NOP:        return "nop";
        default:                return "unknown";
    }
}

// ── Single TAC instruction ─────────────────────────────────
struct TACInstr {
    int         id;       // instruction number
    TACOp       op;
    std::string result;   // destination
    std::string arg1;     // first operand
    std::string arg2;     // second operand (optional)
    std::string comment;  // for readability
    int         line;     // source line

    TACInstr(int id_, TACOp op_,
             std::string res  = "",
             std::string a1   = "",
             std::string a2   = "",
             std::string cmt  = "",
             int         line_ = 0)
        : id(id_), op(op_),
          result(std::move(res)),
          arg1(std::move(a1)),
          arg2(std::move(a2)),
          comment(std::move(cmt)),
          line(line_) {}

    // Human-readable form
    std::string toString() const {
        switch (op) {
            case TACOp::LABEL:
                return result + ":";
            case TACOp::JUMP:
                return "goto " + arg1;
            case TACOp::JUMP_IF:
                return "if " + arg1 + " goto " + arg2;
            case TACOp::JUMP_IFNOT:
                return "ifnot " + arg1 + " goto " + arg2;
            case TACOp::FUNC_BEGIN:
                return "func_begin " + result;
            case TACOp::FUNC_END:
                return "func_end " + result;
            case TACOp::PARAM:
                return "param " + arg1;
            case TACOp::CALL:
                return result.empty()
                    ? "call " + arg1 + ", " + arg2
                    : result + " = call " + arg1 + ", " + arg2;
            case TACOp::RETURN:
                return arg1.empty()
                    ? "return"
                    : "return " + arg1;
            case TACOp::COPY:
                return result + " = " + arg1;
            case TACOp::ASSIGN:
                return result + " = " + arg1;
            case TACOp::PRINT:
                return "print " + arg1;
            case TACOp::NOP:
                return "nop";
            case TACOp::ARRAY_GET:
                return result + " = " + arg1 + "[" + arg2 + "]";
            case TACOp::ARRAY_SET:
                return arg1 + "[" + arg2 + "] = " + result;
            case TACOp::ADDR_OF:
                return result + " = &" + arg1;
            case TACOp::DEREF:
                return result + " = *" + arg1;
            case TACOp::CAST:
                return result + " = (" + arg2 + ") " + arg1;
            case TACOp::NOT:
            case TACOp::BIT_NOT:
                return result + " = " + tacOpName(op) + arg1;
            default:
                // Binary: result = arg1 op arg2
                return result + " = " + arg1 +
                       " " + tacOpName(op) + " " + arg2;
        }
    }

    std::string toJSON() const {
        auto esc = [](const std::string& s) {
            std::string out;
            for (char c : s) {
                if (c == '"')       out += "\\\"";
                else if (c == '\\') out += "\\\\";
                else                out += c;
            }
            return out;
        };

        return "{"
            "\"id\": "         + std::to_string(id)      + ", "
            "\"op\": \""       + esc(tacOpName(op))      + "\", "
            "\"result\": \""   + esc(result)              + "\", "
            "\"arg1\": \""     + esc(arg1)                + "\", "
            "\"arg2\": \""     + esc(arg2)                + "\", "
            "\"code\": \""     + esc(toString())          + "\", "
            "\"comment\": \""  + esc(comment)             + "\", "
            "\"line\": "       + std::to_string(line)     +
            "}";
    }
};

// ── IR Generator ───────────────────────────────────────────
class IRGenerator {
public:
    IRGenerator();

    // Main entry — pass AST root
    void generate(ASTNodePtr root);

    // Results
    const std::vector<TACInstr>& instructions() const {
        return instrs_;
    }

    // JSON output
    std::string toJSON() const;

private:
    std::vector<TACInstr> instrs_;
    int                   tempCount_;
    int                   labelCount_;
    int                   instrCount_;

    // ── Helpers ───────────────────────────────────────────
    std::string newTemp();
    std::string newLabel();
    void        emit(TACOp op,
                     const std::string& result = "",
                     const std::string& arg1   = "",
                     const std::string& arg2   = "",
                     const std::string& comment= "",
                     int                line   = 0);

    // ── Visitors ──────────────────────────────────────────
    void        visitNode       (ASTNodePtr node);
    void        visitProgram    (ASTNodePtr node);
    void        visitFunctionDecl(ASTNodePtr node);
    void        visitVarDecl    (ASTNodePtr node);
    void        visitCompoundStmt(ASTNodePtr node);
    void        visitIfStmt     (ASTNodePtr node);
    void        visitForStmt    (ASTNodePtr node);
    void        visitWhileStmt  (ASTNodePtr node);
    void        visitDoWhileStmt(ASTNodePtr node);
    void        visitSwitchStmt (ASTNodePtr node);
    void        visitReturnStmt (ASTNodePtr node);
    void        visitExprStmt   (ASTNodePtr node);

    std::string genExpr         (ASTNodePtr node);
    std::string genBinaryExpr   (ASTNodePtr node);
    std::string genUnaryExpr    (ASTNodePtr node);
    std::string genAssignExpr   (ASTNodePtr node);
    std::string genCallExpr     (ASTNodePtr node);
    std::string genIdentifier   (ASTNodePtr node);
    std::string genMemberExpr   (ASTNodePtr node);
    std::string genIndexExpr    (ASTNodePtr node);
    std::string genTernaryExpr  (ASTNodePtr node);
    std::string genLiteral      (ASTNodePtr node);

    TACOp       opFromString    (const std::string& op);
};
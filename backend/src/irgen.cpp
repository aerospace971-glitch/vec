#include "irgen.hpp"
#include <sstream>
#include <unordered_map>

// ══════════════════════════════════════════════════════════
//  Constructor
// ══════════════════════════════════════════════════════════

IRGenerator::IRGenerator()
    : tempCount_(0), labelCount_(0), instrCount_(0) {}

// ══════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════

std::string IRGenerator::newTemp() {
    return "t" + std::to_string(++tempCount_);
}

std::string IRGenerator::newLabel() {
    return "L" + std::to_string(++labelCount_);
}

void IRGenerator::emit(TACOp op,
                       const std::string& result,
                       const std::string& arg1,
                       const std::string& arg2,
                       const std::string& comment,
                       int                line) {
    instrs_.emplace_back(++instrCount_, op,
                         result, arg1, arg2,
                         comment, line);
}

// ══════════════════════════════════════════════════════════
//  Operator string → TACOp
// ══════════════════════════════════════════════════════════

TACOp IRGenerator::opFromString(const std::string& op) {
    if (op == "+")  return TACOp::ADD;
    if (op == "-")  return TACOp::SUB;
    if (op == "*")  return TACOp::MUL;
    if (op == "/")  return TACOp::DIV;
    if (op == "%")  return TACOp::MOD;
    if (op == "&")  return TACOp::BIT_AND;
    if (op == "|")  return TACOp::BIT_OR;
    if (op == "^")  return TACOp::BIT_XOR;
    if (op == "~")  return TACOp::BIT_NOT;
    if (op == "<<") return TACOp::LSHIFT;
    if (op == ">>") return TACOp::RSHIFT;
    if (op == "==") return TACOp::EQ;
    if (op == "!=") return TACOp::NEQ;
    if (op == "<")  return TACOp::LT;
    if (op == ">")  return TACOp::GT;
    if (op == "<=") return TACOp::LTE;
    if (op == ">=") return TACOp::GTE;
    if (op == "&&") return TACOp::AND;
    if (op == "||") return TACOp::OR;
    if (op == "!")  return TACOp::NOT;
    return TACOp::UNKNOWN;
}

// ══════════════════════════════════════════════════════════
//  Main entry
// ══════════════════════════════════════════════════════════

void IRGenerator::generate(ASTNodePtr root) {
    if (root) visitNode(root);
}

// ══════════════════════════════════════════════════════════
//  Node dispatcher
// ══════════════════════════════════════════════════════════

void IRGenerator::visitNode(ASTNodePtr node) {
    if (!node) return;

    switch (node->type) {
        case NodeType::Program:        visitProgram(node);      break;
        case NodeType::FunctionDecl:   visitFunctionDecl(node); break;
        case NodeType::VarDecl:        visitVarDecl(node);      break;
        case NodeType::CompoundStmt:   visitCompoundStmt(node); break;
        case NodeType::IfStmt:         visitIfStmt(node);       break;
        case NodeType::ForStmt:        visitForStmt(node);      break;
        case NodeType::WhileStmt:      visitWhileStmt(node);    break;
        case NodeType::DoWhileStmt:    visitDoWhileStmt(node);  break;
        case NodeType::SwitchStmt:     visitSwitchStmt(node);   break;
        case NodeType::ReturnStmt:     visitReturnStmt(node);   break;
        case NodeType::ExprStmt:       visitExprStmt(node);     break;

        // Skip preprocessor / using / namespace at top level
        case NodeType::IncludeDecl:
        case NodeType::MacroDecl:
        case NodeType::UsingDecl:
        case NodeType::NamespaceDecl:
        case NodeType::NullStmt:
            break;

        default:
            for (auto& child : node->children)
                visitNode(child);
            break;
    }
}

// ══════════════════════════════════════════════════════════
//  Program
// ══════════════════════════════════════════════════════════

void IRGenerator::visitProgram(ASTNodePtr node) {
    for (auto& child : node->children)
        visitNode(child);
}

// ══════════════════════════════════════════════════════════
//  Function declaration
// ══════════════════════════════════════════════════════════

void IRGenerator::visitFunctionDecl(ASTNodePtr node) {
    std::string name = node->value;
    std::string ret  = node->dataType;

    // func_begin
    emit(TACOp::FUNC_BEGIN, name, ret, "",
         "function " + ret + " " + name, node->line);

    for (auto& child : node->children) {
        if (!child) continue;

        // Parameters
        if (child->type == NodeType::CompoundStmt &&
            child->value == "params") {
            for (auto& param : child->children) {
                if (!param) continue;
                emit(TACOp::PARAM, param->value,
                     param->dataType, "",
                     "param " + param->dataType +
                     " " + param->value, param->line);
            }
        } else {
            visitNode(child);
        }
    }

    // func_end
    emit(TACOp::FUNC_END, name, "", "",
         "end " + name, node->line);
}

// ══════════════════════════════════════════════════════════
//  Variable declaration
// ══════════════════════════════════════════════════════════

void IRGenerator::visitVarDecl(ASTNodePtr node) {
    std::string name = node->value;
    std::string type = node->dataType;

    if (node->children.empty()) {
        // Declaration only — no initializer
        emit(TACOp::NOP, "", "", "",
             "decl " + type + " " + name, node->line);
        return;
    }

    // Generate initializer expression
    std::string initVal = genExpr(node->children[0]);

    // Assign to variable
    emit(TACOp::ASSIGN, name, initVal, "",
         type + " " + name + " = " + initVal, node->line);
}

// ══════════════════════════════════════════════════════════
//  Compound statement (block)
// ══════════════════════════════════════════════════════════

void IRGenerator::visitCompoundStmt(ASTNodePtr node) {
    for (auto& child : node->children)
        visitNode(child);
}

// ══════════════════════════════════════════════════════════
//  If statement
//
//  if (cond) goto L_then
//  goto L_else
//  L_then:
//    <then body>
//  goto L_end
//  L_else:
//    <else body>   (if present)
//  L_end:
// ══════════════════════════════════════════════════════════

void IRGenerator::visitIfStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.empty()) return;

    std::string lThen = newLabel();
    std::string lElse = newLabel();
    std::string lEnd  = newLabel();

    bool hasElse = ch.size() >= 3;

    // Evaluate condition
    std::string cond = genExpr(ch[0]);

    // Branch
    emit(TACOp::JUMP_IF,    "", cond, lThen, "if true goto then",  node->line);
    emit(TACOp::JUMP,       "", hasElse ? lElse : lEnd, "",
             std::string("goto ") + (hasElse ? "else" : "end"),         node->line);

    // Then branch
    emit(TACOp::LABEL, lThen, "", "", "", node->line);
    visitNode(ch[1]);
    emit(TACOp::JUMP, "", lEnd, "", "goto end", node->line);

    // Else branch
    if (hasElse) {
        emit(TACOp::LABEL, lElse, "", "", "", node->line);
        visitNode(ch[2]);
    }

    // End label
    emit(TACOp::LABEL, lEnd, "", "", "", node->line);
}

// ══════════════════════════════════════════════════════════
//  For loop
//
//  <init>
//  L_start:
//    if not cond goto L_end
//    <body>
//  L_inc:
//    <increment>
//    goto L_start
//  L_end:
// ══════════════════════════════════════════════════════════

void IRGenerator::visitForStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.size() < 4) return;

    std::string lStart = newLabel();
    std::string lInc   = newLabel();
    std::string lEnd   = newLabel();

    // Init
    visitNode(ch[0]);

    // Loop start
    emit(TACOp::LABEL, lStart, "", "", "for loop start", node->line);

    // Condition
    std::string cond = genExpr(ch[1]);
    emit(TACOp::JUMP_IFNOT, "", cond, lEnd,
         "exit loop if false", node->line);

    // Body
    visitNode(ch[3]);

    // Increment
    emit(TACOp::LABEL, lInc, "", "", "increment", node->line);
    genExpr(ch[2]);

    // Back to start
    emit(TACOp::JUMP, "", lStart, "", "goto loop start", node->line);

    // End
    emit(TACOp::LABEL, lEnd, "", "", "for loop end", node->line);
}

// ══════════════════════════════════════════════════════════
//  While loop
//
//  L_start:
//    if not cond goto L_end
//    <body>
//    goto L_start
//  L_end:
// ══════════════════════════════════════════════════════════

void IRGenerator::visitWhileStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.size() < 2) return;

    std::string lStart = newLabel();
    std::string lEnd   = newLabel();

    emit(TACOp::LABEL, lStart, "", "", "while start", node->line);

    std::string cond = genExpr(ch[0]);
    emit(TACOp::JUMP_IFNOT, "", cond, lEnd,
         "exit while if false", node->line);

    visitNode(ch[1]);

    emit(TACOp::JUMP, "", lStart, "", "goto while start", node->line);
    emit(TACOp::LABEL, lEnd, "", "", "while end", node->line);
}

// ══════════════════════════════════════════════════════════
//  Do-while loop
//
//  L_start:
//    <body>
//    if cond goto L_start
// ══════════════════════════════════════════════════════════

void IRGenerator::visitDoWhileStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.size() < 2) return;

    std::string lStart = newLabel();
    std::string lEnd   = newLabel();

    emit(TACOp::LABEL, lStart, "", "", "do-while start", node->line);

    visitNode(ch[0]); // body

    std::string cond = genExpr(ch[1]);
    emit(TACOp::JUMP_IF, "", cond, lStart,
         "repeat if true", node->line);
    emit(TACOp::LABEL, lEnd, "", "", "do-while end", node->line);
}

// ══════════════════════════════════════════════════════════
//  Switch statement
// ══════════════════════════════════════════════════════════

void IRGenerator::visitSwitchStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.empty()) return;

    std::string lEnd = newLabel();

    // Evaluate switch expression
    std::string switchVal = genExpr(ch[0]);

    // Generate case comparisons
    for (size_t i = 1; i < ch.size(); i++) {
        auto& c = ch[i];
        if (!c) continue;

        if (c->type == NodeType::CaseStmt) {
            std::string lCase = newLabel();
            std::string caseVal = genExpr(c->children[0]);
            std::string cmp = newTemp();

            emit(TACOp::EQ, cmp, switchVal, caseVal,
                 "case comparison", c->line);
            emit(TACOp::JUMP_IF, "", cmp, lCase,
                 "goto case", c->line);

            std::string lNext = newLabel();
            emit(TACOp::JUMP, "", lNext, "", "", c->line);
            emit(TACOp::LABEL, lCase, "", "", "", c->line);

            // Case body
            for (size_t j = 1; j < c->children.size(); j++)
                visitNode(c->children[j]);

            emit(TACOp::LABEL, lNext, "", "", "", c->line);

        } else if (c->type == NodeType::DefaultStmt) {
            for (auto& stmt : c->children)
                visitNode(stmt);
        }
    }

    emit(TACOp::LABEL, lEnd, "", "", "switch end", node->line);
}

// ══════════════════════════════════════════════════════════
//  Return statement
// ══════════════════════════════════════════════════════════

void IRGenerator::visitReturnStmt(ASTNodePtr node) {
    if (node->children.empty()) {
        emit(TACOp::RETURN, "", "", "",
             "return void", node->line);
    } else {
        std::string val = genExpr(node->children[0]);
        emit(TACOp::RETURN, "", val, "",
             "return " + val, node->line);
    }
}

// ══════════════════════════════════════════════════════════
//  Expression statement
// ══════════════════════════════════════════════════════════

void IRGenerator::visitExprStmt(ASTNodePtr node) {
    if (!node->children.empty())
        genExpr(node->children[0]);
}

// ══════════════════════════════════════════════════════════
//  Expression generator — returns result name/value
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genExpr(ASTNodePtr node) {
    if (!node) return "";

    switch (node->type) {
        case NodeType::IntLiteral:
        case NodeType::FloatLiteral:
        case NodeType::DoubleLiteral:
        case NodeType::CharLiteral:
        case NodeType::StringLiteral:
        case NodeType::BoolLiteral:
        case NodeType::NullptrLiteral:
            return genLiteral(node);

        case NodeType::Identifier:
            return genIdentifier(node);

        case NodeType::BinaryExpr:
            return genBinaryExpr(node);

        case NodeType::UnaryExpr:
            return genUnaryExpr(node);

        case NodeType::AssignExpr:
            return genAssignExpr(node);

        case NodeType::CallExpr:
            return genCallExpr(node);

        case NodeType::MemberExpr:
        case NodeType::ArrowExpr:
            return genMemberExpr(node);

        case NodeType::IndexExpr:
            return genIndexExpr(node);

        case NodeType::TernaryExpr:
            return genTernaryExpr(node);

        case NodeType::SizeofExpr: {
            std::string t = newTemp();
            emit(TACOp::COPY, t, "sizeof(" +
                 (node->children.empty() ? "?" :
                  node->children[0]->value) + ")",
                 "", "sizeof", node->line);
            return t;
        }

        case NodeType::NewExpr: {
            std::string t = newTemp();
            std::string type = node->children.empty()
                ? "unknown" : node->children[0]->value;
            emit(TACOp::COPY, t, "new " + type,
                 "", "heap alloc", node->line);
            return t;
        }

        case NodeType::DeleteExpr: {
            if (!node->children.empty()) {
                std::string ptr = genExpr(node->children[0]);
                emit(TACOp::COPY, "", "delete " + ptr,
                     "", "heap free", node->line);
            }
            return "";
        }

        case NodeType::CastExpr: {
            std::string t = newTemp();
            std::string inner = node->children.size() >= 2
                ? genExpr(node->children[1]) : "";
            std::string type  = node->children.empty()
                ? "" : node->children[0]->value;
            emit(TACOp::CAST, t, inner, type,
                 "cast to " + type, node->line);
            return t;
        }

        case NodeType::InitListExpr: {
            std::string t = newTemp();
            emit(TACOp::COPY, t, "{...}", "",
                 "init list", node->line);
            return t;
        }

        case NodeType::VarDecl:
            visitVarDecl(node);
            return node->value;

        default:
            for (auto& child : node->children)
                genExpr(child);
            return "";
    }
}

// ══════════════════════════════════════════════════════════
//  Literals
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genLiteral(ASTNodePtr node) {
    // Literals are their own values — no instruction needed
    return node->value;
}

// ══════════════════════════════════════════════════════════
//  Identifier
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genIdentifier(ASTNodePtr node) {
    return node->value;
}

// ══════════════════════════════════════════════════════════
//  Binary expression:  t = arg1 op arg2
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genBinaryExpr(ASTNodePtr node) {
    if (node->children.size() < 2) return "";

    std::string left  = genExpr(node->children[0]);
    std::string right = genExpr(node->children[1]);
    std::string t     = newTemp();
    TACOp       op    = opFromString(node->value);

    emit(op, t, left, right,
         t + " = " + left + " " + node->value + " " + right,
         node->line);
    return t;
}

// ══════════════════════════════════════════════════════════
//  Unary expression:  t = op arg
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genUnaryExpr(ASTNodePtr node) {
    if (node->children.empty()) return "";

    std::string operand = genExpr(node->children[0]);
    std::string op      = node->value;
    std::string t       = newTemp();

    // Post-increment / post-decrement
    if (op == "++(post)") {
        emit(TACOp::COPY, t, operand, "",
             t + " = " + operand, node->line);
        emit(TACOp::ADD, operand, operand, "1",
             operand + " = " + operand + " + 1", node->line);
        return t;
    }
    if (op == "--(post)") {
        emit(TACOp::COPY, t, operand, "",
             t + " = " + operand, node->line);
        emit(TACOp::SUB, operand, operand, "1",
             operand + " = " + operand + " - 1", node->line);
        return t;
    }

    // Pre-increment
    if (op == "++") {
        emit(TACOp::ADD, operand, operand, "1",
             operand + " = " + operand + " + 1", node->line);
        return operand;
    }
    // Pre-decrement
    if (op == "--") {
        emit(TACOp::SUB, operand, operand, "1",
             operand + " = " + operand + " - 1", node->line);
        return operand;
    }
    // Address-of
    if (op == "&") {
        emit(TACOp::ADDR_OF, t, operand, "",
             t + " = &" + operand, node->line);
        return t;
    }
    // Dereference
    if (op == "*") {
        emit(TACOp::DEREF, t, operand, "",
             t + " = *" + operand, node->line);
        return t;
    }
    // Logical NOT
    if (op == "!") {
        emit(TACOp::NOT, t, operand, "",
             t + " = !" + operand, node->line);
        return t;
    }
    // Bitwise NOT
    if (op == "~") {
        emit(TACOp::BIT_NOT, t, operand, "",
             t + " = ~" + operand, node->line);
        return t;
    }
    // Unary minus
    if (op == "-") {
        emit(TACOp::SUB, t, "0", operand,
             t + " = 0 - " + operand, node->line);
        return t;
    }

    // Default
    emit(TACOp::COPY, t, op + operand, "",
         t + " = " + op + operand, node->line);
    return t;
}

// ══════════════════════════════════════════════════════════
//  Assignment:  lhs = rhs
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genAssignExpr(ASTNodePtr node) {
    if (node->children.size() < 2) return "";

    std::string rhs = genExpr(node->children[1]);
    std::string lhs = node->children[0]->value;
    std::string op  = node->value;

    // Compound assignment: += -= *= /= etc.
    if (op == "+=") {
        emit(TACOp::ADD, lhs, lhs, rhs,
             lhs + " = " + lhs + " + " + rhs, node->line);
    } else if (op == "-=") {
        emit(TACOp::SUB, lhs, lhs, rhs,
             lhs + " = " + lhs + " - " + rhs, node->line);
    } else if (op == "*=") {
        emit(TACOp::MUL, lhs, lhs, rhs,
             lhs + " = " + lhs + " * " + rhs, node->line);
    } else if (op == "/=") {
        emit(TACOp::DIV, lhs, lhs, rhs,
             lhs + " = " + lhs + " / " + rhs, node->line);
    } else if (op == "%=") {
        emit(TACOp::MOD, lhs, lhs, rhs,
             lhs + " = " + lhs + " % " + rhs, node->line);
    } else if (op == "&=") {
        emit(TACOp::BIT_AND, lhs, lhs, rhs,
             lhs + " = " + lhs + " & " + rhs, node->line);
    } else if (op == "|=") {
        emit(TACOp::BIT_OR, lhs, lhs, rhs,
             lhs + " = " + lhs + " | " + rhs, node->line);
    } else if (op == "^=") {
        emit(TACOp::BIT_XOR, lhs, lhs, rhs,
             lhs + " = " + lhs + " ^ " + rhs, node->line);
    } else {
        // Simple =
        emit(TACOp::ASSIGN, lhs, rhs, "",
             lhs + " = " + rhs, node->line);
    }

    return lhs;
}

// ══════════════════════════════════════════════════════════
//  Function call
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genCallExpr(ASTNodePtr node) {
    if (node->children.empty()) return "";

    // Function name
    std::string funcName = node->children[0]->value;

    // Push arguments in order
    int argCount = 0;
    for (size_t i = 1; i < node->children.size(); i++) {
        std::string arg = genExpr(node->children[i]);
        emit(TACOp::PARAM, "", arg, "",
             "param " + arg, node->line);
        argCount++;
    }

    // Call instruction
    std::string t = newTemp();
    emit(TACOp::CALL, t, funcName,
         std::to_string(argCount),
         t + " = call " + funcName, node->line);

    return t;
}

// ══════════════════════════════════════════════════════════
//  Member access:  obj.field  or  ptr->field
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genMemberExpr(ASTNodePtr node) {
    std::string obj = node->children.empty()
        ? "" : genExpr(node->children[0]);
    std::string field = node->value;
    std::string t = newTemp();

    std::string sep = (node->type == NodeType::ArrowExpr)
        ? "->" : ".";

    emit(TACOp::MEMBER_GET, t, obj, field,
         t + " = " + obj + sep + field, node->line);
    return t;
}

// ══════════════════════════════════════════════════════════
//  Array index:  arr[idx]
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genIndexExpr(ASTNodePtr node) {
    if (node->children.size() < 2) return "";

    std::string base  = genExpr(node->children[0]);
    std::string index = genExpr(node->children[1]);
    std::string t     = newTemp();

    emit(TACOp::ARRAY_GET, t, base, index,
         t + " = " + base + "[" + index + "]", node->line);
    return t;
}

// ══════════════════════════════════════════════════════════
//  Ternary:  cond ? thenVal : elseVal
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genTernaryExpr(ASTNodePtr node) {
    if (node->children.size() < 3) return "";

    std::string lThen = newLabel();
    std::string lEnd  = newLabel();
    std::string t     = newTemp();

    std::string cond = genExpr(node->children[0]);
    emit(TACOp::JUMP_IF, "", cond, lThen,
         "ternary: if true", node->line);

    // False branch
    std::string falseVal = genExpr(node->children[2]);
    emit(TACOp::COPY, t, falseVal, "",
         t + " = " + falseVal, node->line);
    emit(TACOp::JUMP, "", lEnd, "", "", node->line);

    // True branch
    emit(TACOp::LABEL, lThen, "", "", "", node->line);
    std::string trueVal = genExpr(node->children[1]);
    emit(TACOp::COPY, t, trueVal, "",
         t + " = " + trueVal, node->line);

    emit(TACOp::LABEL, lEnd, "", "", "", node->line);
    return t;
}

// ══════════════════════════════════════════════════════════
//  JSON output
// ══════════════════════════════════════════════════════════

std::string IRGenerator::toJSON() const {
    std::ostringstream out;
    out << "[\n";
    for (size_t i = 0; i < instrs_.size(); i++) {
        out << "    " << instrs_[i].toJSON();
        if (i + 1 < instrs_.size()) out << ",";
        out << "\n";
    }
    out << "  ]";
    return out.str();
}
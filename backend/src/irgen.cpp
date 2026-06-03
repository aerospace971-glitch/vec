#include "irgen.hpp"
#include <sstream>
#include <functional>
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
    computeBasicBlocks();
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

        case NodeType::BreakStmt:
            if (!breakStack_.empty())
                emit(TACOp::JUMP, "", breakStack_.back(), "",
                     "break", node->line);
            break;

        case NodeType::ContinueStmt:
            if (!continueStack_.empty())
                emit(TACOp::JUMP, "", continueStack_.back(), "",
                     "continue", node->line);
            break;

        case NodeType::GotoStmt:
            emit(TACOp::JUMP, "", node->value, "",
                 "goto " + node->value, node->line);
            break;

        case NodeType::TryStmt: {
            std::string lTryEnd = newLabel();
            emit(TACOp::LABEL, newLabel(), "", "", "try block", node->line);
            if (!node->children.empty())
                visitNode(node->children[0]);          // try body
            emit(TACOp::JUMP, "", lTryEnd, "", "skip catch", node->line);
            for (size_t i = 1; i < node->children.size(); i++)
                visitNode(node->children[i]);          // catch clauses
            emit(TACOp::LABEL, lTryEnd, "", "", "try-catch end", node->line);
            break;
        }

        case NodeType::CatchStmt: {
            emit(TACOp::LABEL, newLabel(), "", "", "catch block", node->line);
            for (auto& child : node->children)
                visitNode(child);
            break;
        }

        case NodeType::ThrowStmt: {
            std::string val = node->children.empty()
                ? "" : genExpr(node->children[0]);
            emit(TACOp::THROW, "", val, "",
                 "throw " + val, node->line);
            break;
        }

        case NodeType::LabelStmt:
            emit(TACOp::LABEL, node->value, "", "",
                 "label", node->line);
            for (auto& child : node->children)
                visitNode(child);
            break;

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

    emit(TACOp::FUNC_BEGIN, name, ret, "",
         "function " + ret + " " + name, node->line);

    std::vector<ASTNodePtr> params;
    std::vector<ASTNodePtr> body;
    for (auto& child : node->children) {
        if (!child) continue;
        if (child->type == NodeType::CompoundStmt &&
            child->value == "params") {
            for (auto& param : child->children) {
                if (param) params.push_back(param);
            }
        } else if (child->type == NodeType::ParamDecl) {
            params.push_back(child);
        } else {
            body.push_back(child);
        }
    }

    // Emit parameter declarations in reverse order so parameters are popped from
    // the call stack in the opposite order they were pushed at the call site.
    for (auto it = params.rbegin(); it != params.rend(); ++it) {
        ASTNodePtr param = *it;
        emit(TACOp::PARAM, param->value,
             param->dataType, "",
             "param " + param->dataType +
             " " + param->value, param->line);
    }

    for (auto& child : body)
        visitNode(child);

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
        emit(TACOp::NOP, "", "", "",
             "decl " + type + " " + name, node->line);
        return;
    }

    // constexpr folding: register literal value for subsequent identifier refs
    // (done after initIdx is found below — handled post-initIdx resolution)

    // For array decls: children = [size, init_expr], so pick last non-VarDecl child
    size_t initIdx = 0;
    for (size_t ci = node->children.size(); ci-- > 0;) {
        if (node->children[ci]->type != NodeType::VarDecl) {
            initIdx = ci;
            break;
        }
    }
    auto& initChild = node->children[initIdx];

    // constexpr folding: register literal value for subsequent identifier refs
    bool isConstexpr = type.find("constexpr") != std::string::npos;
    if (isConstexpr && initChild &&
        (initChild->type == NodeType::IntLiteral   ||
         initChild->type == NodeType::FloatLiteral  ||
         initChild->type == NodeType::DoubleLiteral ||
         initChild->type == NodeType::BoolLiteral)) {
        constexprMap_[name] = initChild->value;
    }

    // Constructor call — Rectangle r(5, 3)
    if (initChild->type == NodeType::CallExpr &&
        initChild->value == "ctor") {
        
        // Args push karo
        int argCount = 0;
        for (auto& arg : initChild->children) {
            std::string argVal = genExpr(arg);
            emit(TACOp::PARAM, "", argVal, "",
                 "param " + argVal, node->line);
            argCount++;
        }
        // type name se call karo
        std::string t = newTemp();
        emit(TACOp::CALL, t, type,
             std::to_string(argCount),
             t + " = call " + type, node->line);
        emit(TACOp::ASSIGN, name, t, "",
             name + " = " + t, node->line);
        return;
    }

    // Normal initializer
    std::string initVal = genExpr(initChild);
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

    // ── Range-based for: for (auto x : collection) ──────────
    // children: [VarDecl, collection_expr, body]
    if (node->value == "range-for" && ch.size() >= 3) {
        std::string varName   = ch[0] ? ch[0]->value : newTemp();
        std::string tIdx      = newTemp();
        std::string tSize     = newTemp();
        std::string tCond     = newTemp();
        std::string lStart    = newLabel();
        std::string lInc      = newLabel();
        std::string lEnd      = newLabel();

        std::string collection = genExpr(ch[1]);

        // t_idx = 0
        emit(TACOp::ASSIGN, tIdx, "0", "",
             "range-for index = 0", node->line);
        // t_size = array_size(collection)
        emit(TACOp::ASSIGN, tSize,
             "array_size(" + collection + ")", "",
             "range-for size", node->line);

        emit(TACOp::LABEL, lStart, "", "", "range-for start", node->line);

        // t_cond = t_idx < t_size
        emit(TACOp::LT, tCond, tIdx, tSize,
             "range-for bounds check", node->line);
        emit(TACOp::JUMP_IFNOT, "", tCond, lEnd,
             "exit range-for", node->line);

        // x = collection[t_idx]
        emit(TACOp::ARRAY_GET, varName, collection, tIdx,
             varName + " = " + collection + "[" + tIdx + "]", node->line);

        breakStack_.push_back(lEnd);
        continueStack_.push_back(lInc);
        visitNode(ch[2]);
        breakStack_.pop_back();
        continueStack_.pop_back();

        emit(TACOp::LABEL, lInc, "", "", "range-for increment", node->line);
        emit(TACOp::ADD, tIdx, tIdx, "1",
             tIdx + " = " + tIdx + " + 1", node->line);
        emit(TACOp::JUMP, "", lStart, "", "goto range-for start", node->line);
        emit(TACOp::LABEL, lEnd, "", "", "range-for end", node->line);
        return;
    }

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
    breakStack_.push_back(lEnd);
    continueStack_.push_back(lInc);
    visitNode(ch[3]);
    breakStack_.pop_back();
    continueStack_.pop_back();

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

    breakStack_.push_back(lEnd);
    continueStack_.push_back(lStart);
    visitNode(ch[1]);
    breakStack_.pop_back();
    continueStack_.pop_back();

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

    breakStack_.push_back(lEnd);
    continueStack_.push_back(lStart);
    visitNode(ch[0]); // body
    breakStack_.pop_back();
    continueStack_.pop_back();

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
    breakStack_.push_back(lEnd);

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

    breakStack_.pop_back();
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
            emit(TACOp::ALLOC, t, type, "",
                 t + " = new " + type, node->line);
            return t;
        }

        case NodeType::DeleteExpr: {
            if (!node->children.empty()) {
                std::string ptr = genExpr(node->children[0]);
                emit(TACOp::FREE, "", ptr, "",
                     "delete " + ptr, node->line);
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
            emit(TACOp::NOP, "", "", "",
                 "init list {" + std::to_string(node->children.size()) + " elems}",
                 node->line);
            for (size_t i = 0; i < node->children.size(); i++) {
                std::string elem = genExpr(node->children[i]);
                emit(TACOp::ARRAY_SET, elem, t, std::to_string(i),
                     t + "[" + std::to_string(i) + "] = " + elem,
                     node->line);
            }
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
    auto it = constexprMap_.find(node->value);
    if (it != constexprMap_.end())
        return it->second;   // fold constexpr to its literal
    return node->value;
}

// ══════════════════════════════════════════════════════════
//  Binary expression:  t = arg1 op arg2
// ══════════════════════════════════════════════════════════

std::string IRGenerator::genBinaryExpr(ASTNodePtr node) {
    // ── Handle cout << chain ──────────────────────────
    if (node->value == "<<") {

        // Check karo left side mein cout hai ya nahi
        // (directly ya chain mein)
        std::function<bool(ASTNodePtr)> hasCout =
        [&](ASTNodePtr n) -> bool {
            if (!n) return false;
            if (n->value == "cout") return true;
            if (n->type == NodeType::Identifier &&
                n->value == "cout") return true;
            for (auto& c : n->children)
                if (hasCout(c)) return true;
            return false;
        };

        if (hasCout(node)) {
            // Collect all values in the chain
            // cout << a << b << c  →  PRINT a, PRINT b, PRINT c
            std::function<void(ASTNodePtr)> emitPrints =
            [&](ASTNodePtr n) {
                if (!n) return;
                if (n->value != "<<") return;

                if (n->children.size() >= 1 &&
                    n->children[0]->value == "<<") {
                    emitPrints(n->children[0]);
                }

                if (n->children.size() >= 2) {
                    auto right = n->children[1];
                    std::string val = genExpr(right);

                    if (val == "endl" || val == "\\n") {
                        emit(TACOp::PRINT, "", "\\n", "",
                             "print newline", n->line);
                    } else if (right->value == "cout") {
                        // skip cout itself
                    } else {
                        emit(TACOp::PRINT, "", val, "",
                             "print " + val, n->line);
                    }
                }
            };

            emitPrints(node);
            return "";
        }
    }

    if (node->value == ">>") {
        // Handle cin >> chain
        std::function<bool(ASTNodePtr)> hasCin =
        [&](ASTNodePtr n) -> bool {
            if (!n) return false;
            if (n->value == "cin") return true;
            if (n->type == NodeType::Identifier &&
                n->value == "cin") return true;
            for (auto& c : n->children)
                if (hasCin(c)) return true;
            return false;
        };

        if (hasCin(node)) {
            std::function<void(ASTNodePtr)> emitReads =
            [&](ASTNodePtr n) {
                if (!n) return;
                if (n->value != ">>") return;

                if (n->children.size() >= 1 &&
                    n->children[0]->value == ">>") {
                    emitReads(n->children[0]);
                }

                if (n->children.size() >= 2) {
                    auto right = n->children[1];
                    if (right->value == "cin") return;
                    std::string target = genExpr(right);
                    emit(TACOp::READ, target, "", "",
                         "read " + target, n->line);
                }
            };
            emitReads(node);
            return "";
        }
    }

    // ── Short-circuit: && ────────────────────────────
    if (node->value == "&&" && node->children.size() >= 2) {
        std::string lFalse = newLabel();
        std::string lEnd   = newLabel();
        std::string t      = newTemp();
        std::string left   = genExpr(node->children[0]);
        emit(TACOp::JUMP_IFNOT, "", left, lFalse,
             "short-circuit &&: skip right if left false", node->line);
        std::string right  = genExpr(node->children[1]);
        emit(TACOp::COPY, t, right, "",
             t + " = " + right, node->line);
        emit(TACOp::JUMP, "", lEnd, "", "", node->line);
        emit(TACOp::LABEL, lFalse, "", "", "", node->line);
        emit(TACOp::COPY, t, "0", "",
             t + " = 0 (short-circuit)", node->line);
        emit(TACOp::LABEL, lEnd, "", "", "", node->line);
        return t;
    }

    // ── Short-circuit: || ────────────────────────────
    if (node->value == "||" && node->children.size() >= 2) {
        std::string lTrue = newLabel();
        std::string lEnd  = newLabel();
        std::string t     = newTemp();
        std::string left  = genExpr(node->children[0]);
        emit(TACOp::JUMP_IF, "", left, lTrue,
             "short-circuit ||: skip right if left true", node->line);
        std::string right = genExpr(node->children[1]);
        emit(TACOp::COPY, t, right, "",
             t + " = " + right, node->line);
        emit(TACOp::JUMP, "", lEnd, "", "", node->line);
        emit(TACOp::LABEL, lTrue, "", "", "", node->line);
        emit(TACOp::COPY, t, "1", "",
             t + " = 1 (short-circuit)", node->line);
        emit(TACOp::LABEL, lEnd, "", "", "", node->line);
        return t;
    }

    // ── Normal binary expression ──────────────────────
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
    std::string op  = node->value;

    // Member assignment: obj.field = rhs → MEMBER_SET
    auto lhsNode = node->children[0];
    if (lhsNode && (lhsNode->type == NodeType::MemberExpr ||
                    lhsNode->type == NodeType::ArrowExpr)) {
        std::string obj   = lhsNode->children.empty()
            ? "" : genExpr(lhsNode->children[0]);
        std::string field = lhsNode->value;
        emit(TACOp::MEMBER_SET, rhs, obj, field,
             obj + "." + field + " = " + rhs, node->line);
        return rhs;
    }

    // Array element assignment: arr[idx] = rhs → ARRAY_SET
    if (lhsNode && lhsNode->type == NodeType::IndexExpr &&
        lhsNode->children.size() >= 2) {
        std::string base  = genExpr(lhsNode->children[0]);
        std::string index = genExpr(lhsNode->children[1]);
        emit(TACOp::ARRAY_SET, rhs, base, index,
             base + "[" + index + "] = " + rhs, node->line);
        return rhs;
    }

    std::string lhs = lhsNode ? lhsNode->value : "";

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

    auto callee = node->children[0];
    std::string funcName;
    std::string objRef;

    // Method call: obj.method(...) or ptr->method(...)
    if (callee && (callee->type == NodeType::MemberExpr ||
                   callee->type == NodeType::ArrowExpr)) {
        std::string sep = (callee->type == NodeType::ArrowExpr) ? "->" : ".";
        objRef   = callee->children.empty() ? "" : genExpr(callee->children[0]);
        funcName = objRef + sep + callee->value;
    } else {
        funcName = callee ? callee->value : "";
    }

    // Push object as implicit first arg for method calls
    int argCount = 0;
    if (!objRef.empty()) {
        emit(TACOp::PARAM, "", objRef, "",
             "this = " + objRef, node->line);
        argCount++;
    }

    // Push explicit arguments
    for (size_t i = 1; i < node->children.size(); i++) {
        std::string arg = genExpr(node->children[i]);
        emit(TACOp::PARAM, "", arg, "",
             "param " + arg, node->line);
        argCount++;
    }

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
//  Basic block computation + CFG
// ══════════════════════════════════════════════════════════

void IRGenerator::computeBasicBlocks() {
    blocks_.clear();
    if (instrs_.empty()) return;

    // Step 1: Mark leaders (first instr of each basic block)
    std::unordered_set<int> leaders;
    leaders.insert(0);

    for (size_t i = 0; i < instrs_.size(); i++) {
        auto op = instrs_[i].op;
        if (op == TACOp::JUMP     || op == TACOp::JUMP_IF   ||
            op == TACOp::JUMP_IFNOT || op == TACOp::RETURN  ||
            op == TACOp::FUNC_END) {
            if (i + 1 < instrs_.size()) leaders.insert((int)(i + 1));
        }
        if (op == TACOp::LABEL || op == TACOp::FUNC_BEGIN)
            leaders.insert((int)i);
    }

    // Step 2: Build blocks
    std::unordered_map<std::string, int> labelToBlock;
    std::string currentFunc;
    int blockId = 0;

    for (size_t i = 0; i < instrs_.size(); i++) {
        if (!leaders.count((int)i)) continue;

        BasicBlock bb;
        bb.id = blockId++;

        auto& first = instrs_[i];
        if (first.op == TACOp::FUNC_BEGIN) { currentFunc = first.result; bb.label = first.result; }
        if (first.op == TACOp::LABEL)       bb.label = first.result;
        bb.func = currentFunc;

        // Collect instructions until next leader
        for (size_t j = i; j < instrs_.size(); j++) {
            if (j > i && leaders.count((int)j)) break;
            bb.instrIds.push_back(instrs_[j].id);
        }

        // Register label → block mapping
        if (!bb.label.empty())
            labelToBlock[bb.label] = bb.id;

        blocks_.push_back(bb);
    }

    // Step 3: Compute CFG edges
    // Build instr-id → instr index for fast lookup
    std::unordered_map<int, size_t> idToIdx;
    for (size_t i = 0; i < instrs_.size(); i++)
        idToIdx[instrs_[i].id] = i;

    for (size_t bi = 0; bi < blocks_.size(); bi++) {
        auto& bb = blocks_[bi];
        if (bb.instrIds.empty()) continue;

        int    lastId  = bb.instrIds.back();
        size_t lastIdx = idToIdx.count(lastId) ? idToIdx[lastId] : instrs_.size();
        if (lastIdx >= instrs_.size()) continue;
        const auto& last = instrs_[lastIdx];

        auto addEdge = [&](int from, int to) {
            blocks_[from].succs.push_back(to);
            blocks_[to].preds.push_back(from);
        };

        if (last.op == TACOp::JUMP) {
            // arg1 = target label
            if (labelToBlock.count(last.arg1))
                addEdge(bi, labelToBlock[last.arg1]);

        } else if (last.op == TACOp::JUMP_IF || last.op == TACOp::JUMP_IFNOT) {
            // arg2 = target label; fall-through to next block
            if (labelToBlock.count(last.arg2))
                addEdge(bi, labelToBlock[last.arg2]);
            if (bi + 1 < blocks_.size())
                addEdge(bi, (int)(bi + 1));

        } else if (last.op == TACOp::RETURN || last.op == TACOp::FUNC_END) {
            // no successors

        } else {
            // Fall-through
            if (bi + 1 < blocks_.size())
                addEdge(bi, (int)(bi + 1));
        }
    }
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
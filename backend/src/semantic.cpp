#include "semantic.hpp"
#include <sstream>
#include <algorithm>
#include <iostream>
#include <cstring>

// ── Name mangling helpers ──────────────────────────────────
static std::string mangleTypeSingle(const std::string& t) {
    if (t == "void")                         return "v";
    if (t == "bool")                         return "b";
    if (t == "char")                         return "c";
    if (t == "short")                        return "s";
    if (t == "int")                          return "i";
    if (t == "long")                         return "l";
    if (t == "long long")                    return "x";
    if (t == "float")                        return "f";
    if (t == "double")                       return "d";
    if (t == "long double")                  return "e";
    if (t == "unsigned int")                 return "j";
    if (t == "unsigned long")                return "m";
    if (t == "string" || t == "std::string") return "Ss";
    if (!t.empty() && t.back() == '*')
        return "P" + mangleTypeSingle(t.substr(0, t.size() - 1));
    if (!t.empty() && t.back() == '&')
        return "R" + mangleTypeSingle(t.substr(0, t.size() - 1));
    if (t.size() > 6 && t.substr(0, 6) == "const ")
        return "K" + mangleTypeSingle(t.substr(6));
    return std::to_string(t.size()) + t;
}

static std::string stripFuncSpecifiers(const std::string& t) {
    static const char* specs[] = {
        "virtual ", "static ", "inline ", "explicit ", "constexpr ", nullptr
    };
    for (int i = 0; specs[i]; ++i) {
        size_t len = strlen(specs[i]);
        if (t.size() > len && t.substr(0, len) == specs[i])
            return stripFuncSpecifiers(t.substr(len));
    }
    return t;
}

static std::string buildMangledName(const std::string& name,
                                    const std::string& retType,
                                    const std::string& paramTypes) {
    // Simplified GCC-style: _Z + length + name + rettype + paramtypes
    std::string cleanRet = stripFuncSpecifiers(retType);
    std::string mangled = "_Z" + std::to_string(name.size()) + name;
    mangled += mangleTypeSingle(cleanRet.empty() ? "v" : cleanRet);
    if (paramTypes.empty()) {
        mangled += "v";
    } else {
        std::istringstream ss(paramTypes);
        std::string tok;
        while (std::getline(ss, tok, ',')) {
            while (!tok.empty() && tok.front() == ' ') tok = tok.substr(1);
            while (!tok.empty() && tok.back()  == ' ') tok.pop_back();
            mangled += mangleTypeSingle(tok);
        }
    }
    return mangled;
}

// ══════════════════════════════════════════════════════════
//  Constructor
// ══════════════════════════════════════════════════════════

SemanticAnalyzer::SemanticAnalyzer() {}

// ══════════════════════════════════════════════════════════
//  Error / warning helpers
// ══════════════════════════════════════════════════════════

void SemanticAnalyzer::addError(const std::string& msg,
                                 int line, int col) {
    errors_.push_back({ msg, "error", line, col });
}

void SemanticAnalyzer::addWarning(const std::string& msg,
                                   int line, int col) {
    errors_.push_back({ msg, "warning", line, col });
}

// ══════════════════════════════════════════════════════════
//  Main entry
// ══════════════════════════════════════════════════════════

void SemanticAnalyzer::analyze(ASTNodePtr root) {
    if (root) visitNode(root);
}

// ══════════════════════════════════════════════════════════
//  Node dispatcher
// ══════════════════════════════════════════════════════════

void SemanticAnalyzer::visitNode(ASTNodePtr node) {
    if (!node) return;

    switch (node->type) {
        case NodeType::Program:        visitProgram(node);      break;
        case NodeType::FunctionDecl:   visitFunctionDecl(node); break;
        case NodeType::VarDecl:        visitVarDecl(node);      break;
        case NodeType::ParamDecl:      visitParamDecl(node);    break;
        case NodeType::ClassDecl:      visitClassDecl(node);    break;
        case NodeType::StructDecl:     visitStructDecl(node);   break;
        case NodeType::EnumDecl:       visitEnumDecl(node);     break;
        case NodeType::NamespaceDecl:  visitNamespace(node);    break;
        case NodeType::UsingDecl:      visitUsing(node);        break;
        case NodeType::IncludeDecl:    visitInclude(node);      break;
        case NodeType::CompoundStmt:   visitCompoundStmt(node); break;
        case NodeType::IfStmt:         visitIfStmt(node);       break;
        case NodeType::ForStmt:        visitForStmt(node);      break;
        case NodeType::WhileStmt:      visitWhileStmt(node);    break;
        case NodeType::DoWhileStmt:    visitDoWhileStmt(node);  break;
        case NodeType::SwitchStmt:     visitSwitchStmt(node);   break;
        case NodeType::ReturnStmt:     visitReturnStmt(node);   break;
        case NodeType::TryStmt:        visitTryStmt(node);      break;
        case NodeType::ThrowStmt:      visitThrowStmt(node);    break;
        case NodeType::ExprStmt:       visitExprStmt(node);     break;

        // Expressions — resolve type
        case NodeType::BinaryExpr:
        case NodeType::UnaryExpr:
        case NodeType::AssignExpr:
        case NodeType::CallExpr:
        case NodeType::Identifier:
        case NodeType::MemberExpr:
        case NodeType::ArrowExpr:
        case NodeType::IndexExpr:
        case NodeType::TernaryExpr:
        case NodeType::IntLiteral:
        case NodeType::FloatLiteral:
        case NodeType::DoubleLiteral:
        case NodeType::CharLiteral:
        case NodeType::StringLiteral:
        case NodeType::BoolLiteral:
        case NodeType::NullptrLiteral:
            visitExpr(node);
            break;

        default:
            // Visit children for unknown node types
            for (auto& child : node->children)
                visitNode(child);
            break;
    }
}

// ══════════════════════════════════════════════════════════
//  Program
// ══════════════════════════════════════════════════════════

void SemanticAnalyzer::visitProgram(ASTNodePtr node) {
    for (auto& child : node->children)
        visitNode(child);
}

// ══════════════════════════════════════════════════════════
//  Declarations
// ══════════════════════════════════════════════════════════

void SemanticAnalyzer::visitFunctionDecl(ASTNodePtr node) {
    std::string name = node->value;
    std::string ret  = node->dataType;
    int l = node->line, c = node->col;

    std::string savedClass = currentClass_;
    if (currentClass_.empty()) {
        size_t pos = name.find("::");
        if (pos != std::string::npos)
            currentClass_ = name.substr(0, pos);
    }

    // Collect param types to support overloading and mangling
    std::string paramTypesStr;
    for (auto& child : node->children) {
        if (!child) continue;
        auto collectParam = [&](ASTNodePtr p) {
            if (!p || p->type != NodeType::ParamDecl) return;
            if (!paramTypesStr.empty()) paramTypesStr += ",";
            paramTypesStr += p->dataType.empty() ? "auto" : p->dataType;
        };
        if (child->type == NodeType::CompoundStmt && child->value == "params") {
            for (auto& param : child->children) collectParam(param);
        } else if (child->type == NodeType::ParamDecl) {
            collectParam(child);
        }
    }

    // Detect forward declaration: no CompoundStmt body ({})
    bool hasBody = false;
    for (auto& child : node->children) {
        if (child && child->type == NodeType::CompoundStmt && child->value == "{}")
            hasBody = true;
    }

    std::string cleanRet = stripFuncSpecifiers(ret);
    Symbol sym(name, cleanRet, SymbolKind::FUNCTION, table_.currentLevel(), l, c);
    sym.isInitialized = hasBody;
    sym.isForwardDecl = !hasBody;
    sym.paramTypes    = paramTypesStr;
    sym.mangledName   = buildMangledName(name, cleanRet, paramTypesStr);

    if (!table_.declare(sym)) {
        if (hasBody)
            addError("Function '" + name + "' already declared with same signature", l, c);
        // duplicate forward decl — silently ignore
    }

    std::string savedReturn = currentFuncReturn_;
    currentFuncReturn_ = cleanRet;
    table_.enterScope(name);

    for (auto& child : node->children) {
        if (!child) continue;
        if (child->type == NodeType::CompoundStmt && child->value == "params") {
            for (auto& param : child->children) visitParamDecl(param);
        } else if (child->type == NodeType::ParamDecl) {
            visitParamDecl(child);
        } else {
            visitNode(child);
        }
    }

    table_.exitScope();
    currentFuncReturn_ = savedReturn;
    currentClass_      = savedClass;
}

void SemanticAnalyzer::visitVarDecl(ASTNodePtr node) {
    std::string name = node->value;
    std::string type = node->dataType;
    int l = node->line, c = node->col;

    if (name.empty()) return;

    // Check redeclaration in same scope
    if (table_.lookupLocal(name)) {
        addError("Variable '" + name + "' already declared "
                 "in this scope", l, c);
        return;
    }

    Symbol sym(name, type, SymbolKind::VARIABLE,
               table_.currentLevel(), l, c);

    // Visit initializer
    if (!node->children.empty()) {
        std::string initType = visitExpr(node->children[0]);
        sym.isInitialized = true;

        // auto type inference
        if (type == "auto" && !initType.empty() &&
            initType != "auto" && initType != "initializer_list" &&
            initType != "call") {
            sym.type = initType;
            node->dataType = initType;
        } else if (!type.empty() && !initType.empty() &&
            !typesCompatible(type, initType) &&
            initType != "auto"             &&
            initType != "initializer_list" &&
            initType != "call") {
            addWarning("Possible type mismatch: variable '" +
                    name + "' is '" + type +
                    "' but initialized with '" +
                    initType + "'", l, c);
        }
    }

    table_.declare(sym);
}

void SemanticAnalyzer::visitParamDecl(ASTNodePtr node) {
    if (!node) return;
    std::string name = node->value;
    std::string type = node->dataType;
    int l = node->line, c = node->col;

    if (name.empty()) return;

    Symbol sym(name, type, SymbolKind::PARAMETER,
               table_.currentLevel(), l, c);
    sym.isInitialized = true;

    if (!table_.declare(sym)) {
        addError("Parameter '" + name +
                 "' already declared", l, c);
    }
}

void SemanticAnalyzer::visitClassDecl(ASTNodePtr node) {
    std::string name = node->value;
    int l = node->line, c = node->col;

    Symbol sym(name, "class", SymbolKind::CLASS,
               table_.currentLevel(), l, c);
    sym.isInitialized = true;

    if (!table_.declare(sym)) {
        addError("Class '" + name +
                 "' already declared", l, c);
    }

    std::string savedClass = currentClass_;
    currentClass_ = name;
    table_.enterScope("class_" + name);
    for (auto& child : node->children)
        visitNode(child);
    table_.exitScope();
    currentClass_ = savedClass;
}

void SemanticAnalyzer::visitStructDecl(ASTNodePtr node) {
    std::string name = node->value;
    int l = node->line, c = node->col;

    Symbol sym(name, "struct", SymbolKind::STRUCT,
               table_.currentLevel(), l, c);
    sym.isInitialized = true;

    if (!table_.declare(sym)) {
        addError("Struct '" + name +
                 "' already declared", l, c);
    }

    table_.enterScope("struct_" + name);
    for (auto& child : node->children)
        visitNode(child);
    table_.exitScope();
}

void SemanticAnalyzer::visitEnumDecl(ASTNodePtr node) {
    std::string name = node->value;
    int l = node->line, c = node->col;

    Symbol sym(name, "enum", SymbolKind::ENUM,
               table_.currentLevel(), l, c);
    sym.isInitialized = true;
    table_.declare(sym);

    // Declare each enum value
    for (auto& child : node->children) {
        if (!child) continue;
        Symbol val(child->value, name,
                   SymbolKind::ENUM_VALUE,
                   table_.currentLevel(),
                   child->line, child->col);
        val.isInitialized = true;
        table_.declare(val);
    }
}

void SemanticAnalyzer::visitNamespace(ASTNodePtr node) {
    std::string name = node->value;
    int l = node->line, c = node->col;

    Symbol sym(name, "namespace", SymbolKind::NAMESPACE,
               table_.currentLevel(), l, c);
    sym.isInitialized = true;
    table_.declare(sym);

    table_.enterScope("ns_" + name);
    for (auto& child : node->children)
        visitNode(child);
    table_.exitScope();
}

void SemanticAnalyzer::visitUsing(ASTNodePtr node) {
    // using namespace std — mark std symbols as available
    // For educational purposes just record it
    (void)node;
}

void SemanticAnalyzer::visitInclude(ASTNodePtr node) {
    // #include — record but don't process
    (void)node;
}

// ══════════════════════════════════════════════════════════
//  Statements
// ══════════════════════════════════════════════════════════

void SemanticAnalyzer::visitCompoundStmt(ASTNodePtr node) {
    // Only create new scope if it's a real block
    // (not the params pseudo-node)
    bool newScope = (node->value == "{}");
    if (newScope) table_.enterScope("block");

    for (auto& child : node->children)
        visitNode(child);

    if (newScope) table_.exitScope();
}

void SemanticAnalyzer::visitIfStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.size() >= 1) visitExpr(ch[0]);   // condition
    if (ch.size() >= 2) visitNode(ch[1]);   // then branch
    if (ch.size() >= 3) visitNode(ch[2]);   // else branch
}

void SemanticAnalyzer::visitForStmt(ASTNodePtr node) {
    table_.enterScope("for");
    for (auto& child : node->children)
        visitNode(child);
    table_.exitScope();
}

void SemanticAnalyzer::visitWhileStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.size() >= 1) visitExpr(ch[0]);  // condition
    if (ch.size() >= 2) visitNode(ch[1]);  // body
}

void SemanticAnalyzer::visitDoWhileStmt(ASTNodePtr node) {
    auto& ch = node->children;
    if (ch.size() >= 1) visitNode(ch[0]);  // body
    if (ch.size() >= 2) visitExpr(ch[1]);  // condition
}

void SemanticAnalyzer::visitSwitchStmt(ASTNodePtr node) {
    table_.enterScope("switch");
    for (auto& child : node->children)
        visitNode(child);
    table_.exitScope();
}

void SemanticAnalyzer::visitReturnStmt(ASTNodePtr node) {
    if (node->children.empty()) {
        if (!currentFuncReturn_.empty() &&
            currentFuncReturn_ != "void" &&
            currentFuncReturn_ != "auto")
            addWarning("Return with no value in non-void function",
                       node->line, node->col);
        return;
    }
    std::string retType = visitExpr(node->children[0]);
    if (!currentFuncReturn_.empty() && !retType.empty() &&
        currentFuncReturn_ != "void" && currentFuncReturn_ != "auto" &&
        retType != "auto" && retType != "call" &&
        !typesCompatible(currentFuncReturn_, retType)) {
        addWarning("Return type mismatch: function returns '" +
                   currentFuncReturn_ + "' but expression is '" +
                   retType + "'", node->line, node->col);
    }
}

void SemanticAnalyzer::visitTryStmt(ASTNodePtr node) {
    for (auto& child : node->children)
        visitNode(child);
}

void SemanticAnalyzer::visitThrowStmt(ASTNodePtr node) {
    if (!node->children.empty())
        visitExpr(node->children[0]);
}

void SemanticAnalyzer::visitExprStmt(ASTNodePtr node) {
    if (!node->children.empty())
        visitExpr(node->children[0]);
}

// ══════════════════════════════════════════════════════════
//  Expressions — return inferred type string
// ══════════════════════════════════════════════════════════

std::string SemanticAnalyzer::visitExpr(ASTNodePtr node) {
    if (!node) return "";

    switch (node->type) {
        case NodeType::IntLiteral:
            node->dataType = "int";
            return "int";

        case NodeType::FloatLiteral:
            node->dataType = "float";
            return "float";

        case NodeType::DoubleLiteral:
            node->dataType = "double";
            return "double";

        case NodeType::CharLiteral:
            node->dataType = "char";
            return "char";

        case NodeType::StringLiteral:
            node->dataType = "string";
            return "string";

        case NodeType::BoolLiteral:
            node->dataType = "bool";
            return "bool";

        case NodeType::NullptrLiteral:
            node->dataType = "nullptr_t";
            return "nullptr_t";

        case NodeType::Identifier:
            return visitIdentifier(node);

        case NodeType::BinaryExpr:
            return visitBinaryExpr(node);

        case NodeType::UnaryExpr:
            return visitUnaryExpr(node);

        case NodeType::AssignExpr:
            return visitAssignExpr(node);

        case NodeType::CallExpr:
            return visitCallExpr(node);

        case NodeType::MemberExpr:
        case NodeType::ArrowExpr:
            return visitMemberExpr(node);

        case NodeType::IndexExpr:
            return visitIndexExpr(node);

        case NodeType::TernaryExpr:
            return visitTernaryExpr(node);

        case NodeType::InitListExpr:
            for (auto& child : node->children)
                visitExpr(child);
            return "initializer_list";

        case NodeType::SizeofExpr:
            return "size_t";

        case NodeType::NewExpr:
            if (!node->children.empty())
                return node->children[0]->value + "*";
            return "pointer";

        case NodeType::DeleteExpr:
            if (!node->children.empty())
                visitExpr(node->children[0]);
            return "void";

        case NodeType::CastExpr:
            if (!node->children.empty())
                return node->children[0]->value;
            return "";

        default:
            for (auto& child : node->children)
                visitNode(child);
            return node->dataType;
    }
}

std::string SemanticAnalyzer::visitIdentifier(ASTNodePtr node) {
    std::string name = node->value;
    int l = node->line, c = node->col;

    Symbol* sym = nullptr;

    // Scope resolution: Foo::bar or ns::func
    size_t scopeOp = name.find("::");
    if (scopeOp != std::string::npos) {
        std::string scopePart = name.substr(0, scopeOp);
        std::string namePart  = name.substr(scopeOp + 2);
        sym = table_.lookupInScope("class_"  + scopePart, namePart);
        if (!sym) sym = table_.lookupInScope("ns_"     + scopePart, namePart);
        if (!sym) sym = table_.lookupInScope(scopePart,             namePart);
    }

    if (!sym) sym = table_.lookup(name);
    if (!sym && !currentClass_.empty())
        sym = table_.lookupInScope("class_" + currentClass_, name);

    if (!sym) {
        if (name.find("::") == std::string::npos)
            addWarning("Identifier '" + name + "' may be undeclared", l, c);
        return "";
    }
    sym->isUsed     = true;
    node->dataType  = sym->type;
    return sym->type;
}

std::string SemanticAnalyzer::visitBinaryExpr(ASTNodePtr node) {
    std::string lType, rType;
    if(node->value=="<<"){
      if(node->children.size()>=1){
        auto left=node->children[0];
        if(left && left->type == NodeType::Identifier && left->value=="cout"){
            node->dataType="ostream";
            return "ostream";
        }
      }
    }

    if(node->value==">>"){
      if(node->children.size()>=1){
        auto left=node->children[0];
        if(left && left->type==NodeType::Identifier && left->value=="cin"){
            node->dataType="istream";
            return "istream";
        }
      }
    }
    if (node->children.size() >= 1)
        lType = visitExpr(node->children[0]);
    if (node->children.size() >= 2)
        rType = visitExpr(node->children[1]);

    std::string result = inferBinaryType(lType, rType, node->value);

    // Operator overloading: if left operand is a user-defined type,
    // look for operator<op> function and use its return type
    static const std::vector<std::string> primitives = {
        "int","float","double","bool","char","long","short",
        "unsigned","void","string","auto","ostream","istream",
        "long long","unsigned int","size_t","wchar_t"
    };
    auto isPrimitive = [&](const std::string& t) {
        for (auto& p : primitives) if (t == p) return true;
        return t.empty();
    };
    if (!isPrimitive(lType)) {
        auto* sym = table_.lookup("operator" + node->value);
        if (sym && sym->kind == SymbolKind::FUNCTION) {
            result = sym->type;
        }
    }

    node->dataType = result;
    return result;
}

std::string SemanticAnalyzer::visitUnaryExpr(ASTNodePtr node) {
    std::string type;
    if (!node->children.empty())
        type = visitExpr(node->children[0]);

    std::string op = node->value;
    if (op == "!" || op == "not") {
        node->dataType = "bool";
        return "bool";
    }
    if (op == "&") {
        node->dataType = type + "*";
        return type + "*";
    }
    if (op == "*") {
        // Dereference — remove one pointer level
        if (!type.empty() && type.back() == '*') {
            std::string inner = type.substr(0, type.size() - 1);
            node->dataType = inner;
            return inner;
        }
    }
    node->dataType = type;
    return type;
}

std::string SemanticAnalyzer::visitAssignExpr(ASTNodePtr node) {
    std::string lType, rType;
    if (node->children.size() >= 1)
        lType = visitExpr(node->children[0]);
    if (node->children.size() >= 2)
        rType = visitExpr(node->children[1]);

    if (!lType.empty() && !rType.empty() &&
        !typesCompatible(lType, rType)) {
        addWarning("Assignment type mismatch: '" +
                   lType + "' = '" + rType + "'",
                   node->line, node->col);
    }

    node->dataType = lType;
    return lType;
}

std::string SemanticAnalyzer::visitCallExpr(ASTNodePtr node) {
    // Visit callee
    std::string calleeType;
    if (!node->children.empty())
        calleeType = visitExpr(node->children[0]);

    // Visit arguments
    for (size_t i = 1; i < node->children.size(); i++)
        visitExpr(node->children[i]);

    // For known functions, return type
    if (!node->children.empty()) {
        std::string name = node->children[0]->value;
        Symbol* sym = table_.lookup(name);
        if (sym && sym->kind == SymbolKind::FUNCTION) {
            sym->isUsed = true;
            node->dataType = sym->type;
            return sym->type;
        }
    }

    node->dataType = "auto";
    return "auto";
}

std::string SemanticAnalyzer::visitMemberExpr(ASTNodePtr node) {
    if (!node->children.empty())
        visitExpr(node->children[0]);
    // Member access type resolution requires full type system
    // Return auto for educational purposes
    node->dataType = "auto";
    return "auto";
}

std::string SemanticAnalyzer::visitIndexExpr(ASTNodePtr node) {
    std::string baseType;
    if (!node->children.empty())
        baseType = visitExpr(node->children[0]);
    if (node->children.size() >= 2)
        visitExpr(node->children[1]);

    // Remove array/pointer qualifier
    if (!baseType.empty() && baseType.back() == '*') {
        std::string inner = baseType.substr(0, baseType.size() - 1);
        node->dataType = inner;
        return inner;
    }
    node->dataType = "auto";
    return "auto";
}

std::string SemanticAnalyzer::visitTernaryExpr(ASTNodePtr node) {
    if (node->children.size() >= 1) visitExpr(node->children[0]);
    std::string tType, fType;
    if (node->children.size() >= 2) tType = visitExpr(node->children[1]);
    if (node->children.size() >= 3) fType = visitExpr(node->children[2]);
    std::string result = tType.empty() ? fType : tType;
    node->dataType = result;
    return result;
}

// ══════════════════════════════════════════════════════════
//  Type helpers
// ══════════════════════════════════════════════════════════

bool SemanticAnalyzer::isNumericType(const std::string& type) {
    static const std::vector<std::string> numeric = {
        "int", "float", "double", "long", "short",
        "unsigned", "signed", "char", "size_t",
        "int8_t", "int16_t", "int32_t", "int64_t",
        "uint8_t","uint16_t","uint32_t","uint64_t",
    };
    for (auto& n : numeric)
        if (type == n || type.find(n) != std::string::npos)
            return true;
    return false;
}

bool SemanticAnalyzer::typesCompatible(const std::string& l,
                                        const std::string& r) {
    if (l == r)      return true;
    if (l == "auto") return true;
    if (r == "auto") return true;
    if (l.empty() || r.empty()) return true;

    // Strip reference: T& ↔ T
    auto stripRef = [](const std::string& t) {
        return (!t.empty() && t.back() == '&') ? t.substr(0, t.size()-1) : t;
    };
    std::string lR = stripRef(l), rR = stripRef(r);
    if (lR != l || rR != r) return typesCompatible(lR, rR);

    // Strip const: const T ↔ T
    auto stripConst = [](const std::string& t) {
        return (t.size() > 6 && t.substr(0, 6) == "const ") ? t.substr(6) : t;
    };
    std::string lC = stripConst(l), rC = stripConst(r);
    if (lC != l || rC != r) return typesCompatible(lC, rC);

    // Numeric promotions
    if (isNumericType(l) && isNumericType(r)) return true;
    if (l == "bool" && isNumericType(r)) return true;
    if (r == "bool" && isNumericType(l)) return true;

    // Pointer / nullptr
    if (!l.empty() && !r.empty()) {
        if (r == "nullptr_t" && l.back() == '*') return true;
        if (l == "nullptr_t" && r.back() == '*') return true;
        // pointer → bool (implicit)
        if (l == "bool"   && r.back() == '*') return true;
    }

    // string / const char* / char* compatibility
    static const std::vector<std::string> stringTypes = {
        "string", "std::string", "const char*", "char*", "char[]"
    };
    auto isString = [&](const std::string& t) {
        for (auto& s : stringTypes) if (t == s) return true;
        return false;
    };
    if (isString(l) && isString(r)) return true;

    return false;
}

std::string SemanticAnalyzer::inferBinaryType(
    const std::string& l,
    const std::string& r,
    const std::string& op) {

    // Comparison operators always return bool
    static const std::vector<std::string> cmpOps = {
        "==", "!=", "<", ">", "<=", ">=", "&&", "||"
    };
    for (auto& o : cmpOps)
        if (op == o) return "bool";

    // Bitwise ops
    if (op == "<<" || op == ">>")
        return l.empty() ? r : l;

    // Arithmetic — use wider type
    if (l == "double" || r == "double") return "double";
    if (l == "float"  || r == "float")  return "float";
    if (l == "long"   || r == "long")   return "long";
    if (!l.empty()) return l;
    if (!r.empty()) return r;
    return "int";
}

// ══════════════════════════════════════════════════════════
//  JSON output
// ══════════════════════════════════════════════════════════

std::string SemanticAnalyzer::toJSON() const {
    std::ostringstream out;
    out << "{\n";
    out << "  \"symbols\": " << table_.toJSON() << ",\n";
    out << "  \"semantic_errors\": [\n";

    for (size_t i = 0; i < errors_.size(); i++) {
        const auto& e = errors_[i];
        out << "    {"
            << "\"message\": \""  << e.message  << "\", "
            << "\"severity\": \"" << e.severity << "\", "
            << "\"line\": "       << e.line     << ", "
            << "\"col\": "        << e.col
            << "}";
        if (i + 1 < errors_.size()) out << ",";
        out << "\n";
    }
    out << "  ]\n}";
    return out.str();
}
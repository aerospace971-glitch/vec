#pragma once
#include <string>
#include <vector>
#include <memory>

// ── Forward declarations ───────────────────────────────────
struct ASTNode;
using ASTNodePtr  = std::shared_ptr<ASTNode>;
using ASTNodeList = std::vector<ASTNodePtr>;

// ── All AST node types ─────────────────────────────────────
enum class NodeType {

    // ── Program root ───────────────────────────────────────
    Program,

    // ── Declarations ──────────────────────────────────────
    FunctionDecl,       // int main() { ... }
    VarDecl,            // int x = 5;
    ParamDecl,          // int x  (inside function params)
    ClassDecl,          // class Foo { ... }
    StructDecl,         // struct Bar { ... }
    EnumDecl,           // enum Color { RED, GREEN }
    EnumValue,          // RED = 0
    NamespaceDecl,      // namespace std { ... }
    UsingDecl,          // using namespace std;
    TypedefDecl,        // typedef int MyInt;
    TemplateDecl,       // template<typename T>
    IncludeDecl,        // #include <iostream>
    MacroDecl,          // #define PI 3.14

    // ── Statements ────────────────────────────────────────
    CompoundStmt,       // { ... }
    IfStmt,             // if (cond) { } else { }
    ForStmt,            // for (init; cond; inc) { }
    WhileStmt,          // while (cond) { }
    DoWhileStmt,        // do { } while (cond)
    SwitchStmt,         // switch (expr) { }
    CaseStmt,           // case 1:
    DefaultStmt,        // default:
    ReturnStmt,         // return expr;
    BreakStmt,          // break;
    ContinueStmt,       // continue;
    GotoStmt,           // goto label;
    LabelStmt,          // label:
    ExprStmt,           // expr;
    NullStmt,           // ;

    // ── Expressions ───────────────────────────────────────
    BinaryExpr,         // a + b
    UnaryExpr,          // -a  !a  ++a  a++
    TernaryExpr,        // a ? b : c
    AssignExpr,         // a = b  a += b
    CallExpr,           // foo(a, b)
    IndexExpr,          // arr[i]
    MemberExpr,         // obj.field
    ArrowExpr,          // ptr->field
    ScopeExpr,          // std::cout
    CastExpr,           // static_cast<int>(x)
    SizeofExpr,         // sizeof(int)
    NewExpr,            // new Foo()
    DeleteExpr,         // delete ptr
    LambdaExpr,         // [&](int x) { return x; }
    InitListExpr,       // {1, 2, 3}

    // ── Literals ──────────────────────────────────────────
    IntLiteral,         // 42
    FloatLiteral,       // 3.14f
    DoubleLiteral,      // 3.14
    CharLiteral,        // 'a'
    StringLiteral,      // "hello"
    BoolLiteral,        // true / false
    NullptrLiteral,     // nullptr

    // ── Types ─────────────────────────────────────────────
    BuiltinType,        // int, float, void ...
    PointerType,        // int*
    ReferenceType,      // int&
    ArrayType,          // int[10]
    TemplateType,       // vector<int>
    QualifiedType,      // const int

    // ── Access specifiers ──────────────────────────────────
    AccessSpecifier,    // public: private: protected:

    // ── Exception handling ─────────────────────────────────
    TryStmt,            // try { }
    CatchStmt,          // catch (exception& e) { }
    ThrowStmt,          // throw e;

    // ── Identifiers ───────────────────────────────────────
    Identifier,         // variable / function name

    // ── Unknown ───────────────────────────────────────────
    Unknown,
};

// ── Node type → string ─────────────────────────────────────
inline std::string nodeTypeName(NodeType t) {
    switch (t) {
        case NodeType::Program:         return "Program";
        case NodeType::FunctionDecl:    return "FunctionDecl";
        case NodeType::VarDecl:         return "VarDecl";
        case NodeType::ParamDecl:       return "ParamDecl";
        case NodeType::ClassDecl:       return "ClassDecl";
        case NodeType::StructDecl:      return "StructDecl";
        case NodeType::EnumDecl:        return "EnumDecl";
        case NodeType::EnumValue:       return "EnumValue";
        case NodeType::NamespaceDecl:   return "NamespaceDecl";
        case NodeType::UsingDecl:       return "UsingDecl";
        case NodeType::TypedefDecl:     return "TypedefDecl";
        case NodeType::TemplateDecl:    return "TemplateDecl";
        case NodeType::IncludeDecl:     return "IncludeDecl";
        case NodeType::MacroDecl:       return "MacroDecl";
        case NodeType::CompoundStmt:    return "CompoundStmt";
        case NodeType::IfStmt:          return "IfStmt";
        case NodeType::ForStmt:         return "ForStmt";
        case NodeType::WhileStmt:       return "WhileStmt";
        case NodeType::DoWhileStmt:     return "DoWhileStmt";
        case NodeType::SwitchStmt:      return "SwitchStmt";
        case NodeType::CaseStmt:        return "CaseStmt";
        case NodeType::DefaultStmt:     return "DefaultStmt";
        case NodeType::ReturnStmt:      return "ReturnStmt";
        case NodeType::BreakStmt:       return "BreakStmt";
        case NodeType::ContinueStmt:    return "ContinueStmt";
        case NodeType::GotoStmt:        return "GotoStmt";
        case NodeType::LabelStmt:       return "LabelStmt";
        case NodeType::ExprStmt:        return "ExprStmt";
        case NodeType::NullStmt:        return "NullStmt";
        case NodeType::BinaryExpr:      return "BinaryExpr";
        case NodeType::UnaryExpr:       return "UnaryExpr";
        case NodeType::TernaryExpr:     return "TernaryExpr";
        case NodeType::AssignExpr:      return "AssignExpr";
        case NodeType::CallExpr:        return "CallExpr";
        case NodeType::IndexExpr:       return "IndexExpr";
        case NodeType::MemberExpr:      return "MemberExpr";
        case NodeType::ArrowExpr:       return "ArrowExpr";
        case NodeType::ScopeExpr:       return "ScopeExpr";
        case NodeType::CastExpr:        return "CastExpr";
        case NodeType::SizeofExpr:      return "SizeofExpr";
        case NodeType::NewExpr:         return "NewExpr";
        case NodeType::DeleteExpr:      return "DeleteExpr";
        case NodeType::LambdaExpr:      return "LambdaExpr";
        case NodeType::InitListExpr:    return "InitListExpr";
        case NodeType::IntLiteral:      return "IntLiteral";
        case NodeType::FloatLiteral:    return "FloatLiteral";
        case NodeType::DoubleLiteral:   return "DoubleLiteral";
        case NodeType::CharLiteral:     return "CharLiteral";
        case NodeType::StringLiteral:   return "StringLiteral";
        case NodeType::BoolLiteral:     return "BoolLiteral";
        case NodeType::NullptrLiteral:  return "NullptrLiteral";
        case NodeType::BuiltinType:     return "BuiltinType";
        case NodeType::PointerType:     return "PointerType";
        case NodeType::ReferenceType:   return "ReferenceType";
        case NodeType::ArrayType:       return "ArrayType";
        case NodeType::TemplateType:    return "TemplateType";
        case NodeType::QualifiedType:   return "QualifiedType";
        case NodeType::AccessSpecifier: return "AccessSpecifier";
        case NodeType::TryStmt:         return "TryStmt";
        case NodeType::CatchStmt:       return "CatchStmt";
        case NodeType::ThrowStmt:       return "ThrowStmt";
        case NodeType::Identifier:      return "Identifier";
        default:                        return "Unknown";
    }
}

// ── Node category for UI color coding ─────────────────────
inline std::string nodeCategory(NodeType t) {
    switch (t) {
        case NodeType::Program:                             return "root";
        case NodeType::FunctionDecl:
        case NodeType::VarDecl:
        case NodeType::ParamDecl:
        case NodeType::ClassDecl:
        case NodeType::StructDecl:
        case NodeType::EnumDecl:
        case NodeType::EnumValue:
        case NodeType::NamespaceDecl:
        case NodeType::UsingDecl:
        case NodeType::TypedefDecl:
        case NodeType::TemplateDecl:
        case NodeType::IncludeDecl:
        case NodeType::MacroDecl:                          return "declaration";
        case NodeType::CompoundStmt:
        case NodeType::IfStmt:
        case NodeType::ForStmt:
        case NodeType::WhileStmt:
        case NodeType::DoWhileStmt:
        case NodeType::SwitchStmt:
        case NodeType::CaseStmt:
        case NodeType::DefaultStmt:
        case NodeType::ReturnStmt:
        case NodeType::BreakStmt:
        case NodeType::ContinueStmt:
        case NodeType::GotoStmt:
        case NodeType::LabelStmt:
        case NodeType::ExprStmt:
        case NodeType::NullStmt:                           return "statement";
        case NodeType::BinaryExpr:
        case NodeType::UnaryExpr:
        case NodeType::TernaryExpr:
        case NodeType::AssignExpr:
        case NodeType::CallExpr:
        case NodeType::IndexExpr:
        case NodeType::MemberExpr:
        case NodeType::ArrowExpr:
        case NodeType::ScopeExpr:
        case NodeType::CastExpr:
        case NodeType::SizeofExpr:
        case NodeType::NewExpr:
        case NodeType::DeleteExpr:
        case NodeType::LambdaExpr:
        case NodeType::InitListExpr:                       return "expression";
        case NodeType::IntLiteral:
        case NodeType::FloatLiteral:
        case NodeType::DoubleLiteral:
        case NodeType::CharLiteral:
        case NodeType::StringLiteral:
        case NodeType::BoolLiteral:
        case NodeType::NullptrLiteral:                     return "literal";
        case NodeType::BuiltinType:
        case NodeType::PointerType:
        case NodeType::ReferenceType:
        case NodeType::ArrayType:
        case NodeType::TemplateType:
        case NodeType::QualifiedType:                      return "type";
        case NodeType::TryStmt:
        case NodeType::CatchStmt:
        case NodeType::ThrowStmt:                          return "exception";
        case NodeType::Identifier:                         return "identifier";
        default:                                           return "unknown";
    }
}

// ══════════════════════════════════════════════════════════
//  ASTNode — single node in the tree
// ══════════════════════════════════════════════════════════

struct ASTNode {
    NodeType    type;
    std::string value;      // token value, operator, name etc.
    std::string dataType;   // inferred/declared type (int, float ...)
    std::string category;   // for UI color coding
    int         line;
    int         col;
    ASTNodeList children;

    ASTNode(NodeType t,
            std::string v    = "",
            std::string dt   = "",
            int         l    = 0,
            int         c    = 0)
        : type(t),
          value(std::move(v)),
          dataType(std::move(dt)),
          category(nodeCategory(t)),
          line(l), col(c) {}

    void addChild(ASTNodePtr child) {
        if (child) children.push_back(std::move(child));
    }

    // ── JSON serialization ─────────────────────────────────
    std::string toJSON(int indent = 0) const {
        std::string pad(indent * 2, ' ');
        std::string out;

        out += pad + "{\n";
        out += pad + "  \"type\":     \"" + nodeTypeName(type)  + "\",\n";
        out += pad + "  \"category\": \"" + category            + "\",\n";
        out += pad + "  \"value\":    \"" + escapeJSON(value)   + "\",\n";
        out += pad + "  \"dataType\": \"" + escapeJSON(dataType)+ "\",\n";
        out += pad + "  \"line\":     "   + std::to_string(line)+ ",\n";
        out += pad + "  \"col\":      "   + std::to_string(col) + ",\n";
        out += pad + "  \"children\": [\n";

        for (size_t i = 0; i < children.size(); i++) {
            out += children[i]->toJSON(indent + 2);
            if (i + 1 < children.size()) out += ",";
            out += "\n";
        }

        out += pad + "  ]\n";
        out += pad + "}";
        return out;
    }

private:
    static std::string escapeJSON(const std::string& s) {
        std::string out;
        for (char c : s) {
            switch (c) {
                case '"':  out += "\\\""; break;
                case '\\': out += "\\\\"; break;
                case '\n': out += "\\n";  break;
                case '\r': out += "\\r";  break;
                case '\t': out += "\\t";  break;
                default:   out += c;
            }
        }
        return out;
    }
};
#pragma once
#include "ast.hpp"
#include "symtable.hpp"
#include <string>
#include <vector>

// ── Semantic error struct ──────────────────────────────────
struct SemanticError {
    std::string message;
    std::string severity; // "error" or "warning"
    int         line;
    int         col;
};

// ── Semantic analyzer ──────────────────────────────────────
class SemanticAnalyzer {
public:
    SemanticAnalyzer();

    // Main entry — pass the AST root
    void analyze(ASTNodePtr root);

    // Results
    SymbolTable&              symbolTable() { return table_; }
    std::vector<SemanticError> errors()    const { return errors_; }

    // JSON output
    std::string toJSON() const;

private:
    SymbolTable               table_;
    std::vector<SemanticError> errors_;

    // ── Error / warning helpers ────────────────────────────
    void addError  (const std::string& msg, int line, int col);
    void addWarning(const std::string& msg, int line, int col);

    // ── AST walkers ───────────────────────────────────────
    void visitNode       (ASTNodePtr node);
    void visitProgram    (ASTNodePtr node);

    // Declarations
    void visitFunctionDecl(ASTNodePtr node);
    void visitVarDecl     (ASTNodePtr node);
    void visitParamDecl   (ASTNodePtr node);
    void visitClassDecl   (ASTNodePtr node);
    void visitStructDecl  (ASTNodePtr node);
    void visitEnumDecl    (ASTNodePtr node);
    void visitNamespace   (ASTNodePtr node);
    void visitUsing       (ASTNodePtr node);
    void visitInclude     (ASTNodePtr node);

    // Statements
    void visitCompoundStmt(ASTNodePtr node);
    void visitIfStmt      (ASTNodePtr node);
    void visitForStmt     (ASTNodePtr node);
    void visitWhileStmt   (ASTNodePtr node);
    void visitDoWhileStmt (ASTNodePtr node);
    void visitSwitchStmt  (ASTNodePtr node);
    void visitReturnStmt  (ASTNodePtr node);
    void visitTryStmt     (ASTNodePtr node);
    void visitThrowStmt   (ASTNodePtr node);
    void visitExprStmt    (ASTNodePtr node);

    // Expressions
    std::string visitExpr        (ASTNodePtr node);
    std::string visitBinaryExpr  (ASTNodePtr node);
    std::string visitUnaryExpr   (ASTNodePtr node);
    std::string visitAssignExpr  (ASTNodePtr node);
    std::string visitCallExpr    (ASTNodePtr node);
    std::string visitIdentifier  (ASTNodePtr node);
    std::string visitMemberExpr  (ASTNodePtr node);
    std::string visitIndexExpr   (ASTNodePtr node);
    std::string visitTernaryExpr (ASTNodePtr node);

    // Type helpers
    std::string inferBinaryType(const std::string& l,
                                const std::string& r,
                                const std::string& op);
    bool        isNumericType  (const std::string& type);
    bool        typesCompatible(const std::string& l,
                                const std::string& r);
};
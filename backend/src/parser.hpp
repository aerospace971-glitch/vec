#pragma once
#include "token.hpp"
#include "ast.hpp"
#include <vector>
#include <string>

// ── Parser error struct ────────────────────────────────────
struct ParseError {
    std::string message;
    int         line;
    int         col;
};

// ── Parser class ───────────────────────────────────────────
class Parser {
public:
    explicit Parser(const std::vector<Token>& tokens);

    // Main entry — call this to get the AST
    ASTNodePtr              parse();

    // Get errors encountered during parsing
    std::vector<ParseError> errors() const { return errors_; }

    // Output AST as JSON string
    std::string             toJSON() const;

private:
    std::vector<Token>      tokens_;
    size_t                  pos_;
    std::vector<ParseError> errors_;
    ASTNodePtr              root_;

    // ── Token navigation ──────────────────────────────────
    Token       current()                        const;
    Token       peek(int offset = 1)             const;
    Token       advance();
    bool        isAtEnd()                        const;
    bool        check(TokenType t)               const;
    bool        checkAny(std::vector<TokenType>) const;
    bool        match(TokenType t);
    bool        matchAny(std::vector<TokenType>);
    Token       expect(TokenType t,
                       const std::string& msg);

    // ── Error handling ────────────────────────────────────
    void        addError(const std::string& msg);
    void        synchronize();

    // ── Type parsing ──────────────────────────────────────
    std::string parseTypeName();
    bool        isTypeName()                     const;

    // ── Top level ─────────────────────────────────────────
    ASTNodePtr  parseProgram();
    ASTNodePtr  parseTopLevel();
    ASTNodePtr  parseInclude();
    ASTNodePtr  parseMacro();
    ASTNodePtr  parseNamespace();
    ASTNodePtr  parseUsing();
    ASTNodePtr  parseTemplate();

    // ── Declarations ──────────────────────────────────────
    ASTNodePtr  parseDeclaration();
    ASTNodePtr  parseFunctionDecl(const std::string& retType,
                                  const std::string& name,
                                  int line, int col);
    ASTNodePtr  parseVarDecl(const std::string& typeName,
                             const std::string& varName,
                             int line, int col);
    ASTNodePtr  parseClassDecl();
    ASTNodePtr  parseStructDecl();
    ASTNodePtr  parseEnumDecl();
    ASTNodePtr  parseParamList();
    ASTNodePtr  parseParam();

    // ── Statements ────────────────────────────────────────
    ASTNodePtr  parseStatement();
    ASTNodePtr  parseCompoundStmt();
    ASTNodePtr  parseIfStmt();
    ASTNodePtr  parseForStmt();
    ASTNodePtr  parseWhileStmt();
    ASTNodePtr  parseDoWhileStmt();
    ASTNodePtr  parseSwitchStmt();
    ASTNodePtr  parseReturnStmt();
    ASTNodePtr  parseBreakStmt();
    ASTNodePtr  parseContinueStmt();
    ASTNodePtr  parseGotoStmt();
    ASTNodePtr  parseLabelStmt();
    ASTNodePtr  parseTryStmt();
    ASTNodePtr  parseThrowStmt();
    ASTNodePtr  parseExprStmt();

    // ── Expressions (precedence climbing) ─────────────────
    ASTNodePtr  parseExpression();
    ASTNodePtr  parseAssignment();
    ASTNodePtr  parseTernary();
    ASTNodePtr  parseLogicalOr();
    ASTNodePtr  parseLogicalAnd();
    ASTNodePtr  parseBitwiseOr();
    ASTNodePtr  parseBitwiseXor();
    ASTNodePtr  parseBitwiseAnd();
    ASTNodePtr  parseEquality();
    ASTNodePtr  parseRelational();
    ASTNodePtr  parseShift();
    ASTNodePtr  parseAdditive();
    ASTNodePtr  parseMultiplicative();
    ASTNodePtr  parseUnary();
    ASTNodePtr  parsePostfix();
    ASTNodePtr  parsePrimary();

    // ── Primary helpers ───────────────────────────────────
    ASTNodePtr  parseCallExpr(ASTNodePtr callee);
    ASTNodePtr  parseIndexExpr(ASTNodePtr base);
    ASTNodePtr  parseInitList();
    ASTNodePtr  parseLambda();
};
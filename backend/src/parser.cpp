#include "parser.hpp"
#include <sstream>
#include <stdexcept>

// ══════════════════════════════════════════════════════════
//  Constructor
// ══════════════════════════════════════════════════════════

Parser::Parser(const std::vector<Token>& tokens)
    : tokens_(tokens), pos_(0) {}

// ══════════════════════════════════════════════════════════
//  Token navigation
// ══════════════════════════════════════════════════════════

Token Parser::current() const {
    if (pos_ < tokens_.size()) return tokens_[pos_];
    return tokens_.back(); // EOF
}

Token Parser::peek(int offset) const {
    size_t idx = pos_ + offset;
    if (idx < tokens_.size()) return tokens_[idx];
    return tokens_.back();
}

Token Parser::advance() {
    Token t = current();
    if (!isAtEnd()) pos_++;
    return t;
}

bool Parser::isAtEnd() const {
    return current().type == TokenType::EOF_TOKEN;
}

bool Parser::check(TokenType t) const {
    return current().type == t;
}

bool Parser::checkAny(std::vector<TokenType> types) const {
    for (auto t : types)
        if (check(t)) return true;
    return false;
}

bool Parser::match(TokenType t) {
    if (check(t)) { advance(); return true; }
    return false;
}

bool Parser::matchAny(std::vector<TokenType> types) {
    for (auto t : types)
        if (match(t)) return true;
    return false;
}

Token Parser::expect(TokenType t, const std::string& msg) {
    if (check(t)) return advance();
    addError(msg + " (got '" + current().value + "')");
    return current();
}

// ══════════════════════════════════════════════════════════
//  Error handling
// ══════════════════════════════════════════════════════════

void Parser::addError(const std::string& msg) {
    errors_.push_back({ msg, current().line, current().col });
}

// Panic mode recovery — skip to next safe point
void Parser::synchronize() {
    while (!isAtEnd()) {
        // Stop at statement boundaries
        if (current().type == TokenType::SEMICOLON) {
            advance();
            return;
        }
        // Stop before keywords that start new constructs
        switch (current().type) {
            case TokenType::KW_INT:
            case TokenType::KW_FLOAT:
            case TokenType::KW_DOUBLE:
            case TokenType::KW_CHAR:
            case TokenType::KW_BOOL:
            case TokenType::KW_VOID:
            case TokenType::KW_CLASS:
            case TokenType::KW_STRUCT:
            case TokenType::KW_IF:
            case TokenType::KW_FOR:
            case TokenType::KW_WHILE:
            case TokenType::KW_RETURN:
            case TokenType::KW_NAMESPACE:
                return;
            default:
                advance();
        }
    }
}

// ══════════════════════════════════════════════════════════
//  Type name parsing
// ══════════════════════════════════════════════════════════

bool Parser::isTypeName() const {
    switch (current().type) {
        case TokenType::KW_INT:
        case TokenType::KW_FLOAT:
        case TokenType::KW_DOUBLE:
        case TokenType::KW_CHAR:
        case TokenType::KW_BOOL:
        case TokenType::KW_VOID:
        case TokenType::KW_LONG:
        case TokenType::KW_SHORT:
        case TokenType::KW_UNSIGNED:
        case TokenType::KW_SIGNED:
        case TokenType::KW_AUTO:
        case TokenType::KW_STRING:
        case TokenType::KW_CONST:
        case TokenType::KW_STATIC:
        case TokenType::KW_INLINE:
        case TokenType::KW_VIRTUAL:
        case TokenType::KW_EXPLICIT:
        case TokenType::KW_CONSTEXPR:
            return true;
        case TokenType::IDENTIFIER:
            // Could be a user-defined type
            return peek().type == TokenType::IDENTIFIER  ||
                   peek().type == TokenType::OP_STAR     ||
                   peek().type == TokenType::OP_BIT_AND  ||
                   peek().type == TokenType::OP_SCOPE    ||
                   peek().type == TokenType::KW_OPERATOR; // Vec2 operator+()
        default:
            return false;
    }
}

std::string Parser::parseTypeName() {
    std::string typeName;

    // Qualifiers: const, static, inline, virtual, constexpr
    while (checkAny({
        TokenType::KW_CONST,    TokenType::KW_STATIC,
        TokenType::KW_INLINE,   TokenType::KW_VIRTUAL,
        TokenType::KW_EXPLICIT, TokenType::KW_CONSTEXPR,
        TokenType::KW_UNSIGNED, TokenType::KW_SIGNED,
        TokenType::KW_LONG,     TokenType::KW_SHORT,
        TokenType::KW_EXTERN,   TokenType::KW_MUTABLE,
    })) {
        if (!typeName.empty()) typeName += " ";
        typeName += advance().value;
    }

    // Base type
    if (!typeName.empty()) typeName += " ";
    typeName += advance().value;  // int, float, MyClass, etc.

    // Scope: std::string
    while (check(TokenType::OP_SCOPE)) {
        typeName += advance().value; // ::
        typeName += advance().value; // name
    }

    // Template args: vector<int>
    if (check(TokenType::OP_LT)) {
        typeName += advance().value; // 
        int depth = 1;
        while (!isAtEnd() && depth > 0) {
            if      (check(TokenType::OP_LT))  depth++;
            else if (check(TokenType::OP_GT))  depth--;
            if (depth > 0) typeName += advance().value;
            else           advance(); // consume >
        }
        typeName += ">";
    }

    // Pointer / reference modifiers
    while (checkAny({ TokenType::OP_STAR, TokenType::OP_BIT_AND }))
        typeName += advance().value;

    return typeName;
}

// ══════════════════════════════════════════════════════════
//  Program root
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parse() {
    root_ = parseProgram();
    return root_;
}

ASTNodePtr Parser::parseProgram() {
    auto node = std::make_shared<ASTNode>(
        NodeType::Program, "Program", "", 1, 1);

    while (!isAtEnd()) {
        try {
            auto child = parseTopLevel();
            if (child) node->addChild(child);
        } catch (...) {
            synchronize();
        }
    }
    return node;
}

// ══════════════════════════════════════════════════════════
//  Top-level constructs
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseTopLevel() {
    // Preprocessor
    if (check(TokenType::KW_INCLUDE)) return parseInclude();
    if (check(TokenType::KW_DEFINE))  return parseMacro();
    if (checkAny({ TokenType::KW_IFDEF, TokenType::KW_IFNDEF,
                   TokenType::KW_ENDIF, TokenType::KW_PRAGMA })) {
        auto n = std::make_shared<ASTNode>(
            NodeType::MacroDecl, advance().value,
            "", current().line, current().col);
        return n;
    }

    // Namespace
    if (check(TokenType::KW_NAMESPACE)) return parseNamespace();

    // Using
    if (check(TokenType::KW_USING)) return parseUsing();

    // Template
    if (check(TokenType::KW_TEMPLATE)) return parseTemplate();

    // Class / struct / enum
    if (check(TokenType::KW_CLASS))  return parseClassDecl();
    if (check(TokenType::KW_STRUCT)) return parseStructDecl();
    if (check(TokenType::KW_ENUM))   return parseEnumDecl();

    // Function or variable declaration
    return parseDeclaration();
}

// ══════════════════════════════════════════════════════════
//  Preprocessor
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseInclude() {
    int l = current().line, c = current().col;
    std::string val = advance().value; // full #include <...> line
    return std::make_shared<ASTNode>(
        NodeType::IncludeDecl, val, "", l, c);
}

ASTNodePtr Parser::parseMacro() {
    int l = current().line, c = current().col;
    std::string val = advance().value;
    return std::make_shared<ASTNode>(
        NodeType::MacroDecl, val, "", l, c);
}

// ══════════════════════════════════════════════════════════
//  Namespace
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseNamespace() {
    int l = current().line, c = current().col;
    advance(); // consume 'namespace'

    std::string name;
    if (check(TokenType::IDENTIFIER))
        name = advance().value;

    auto node = std::make_shared<ASTNode>(
        NodeType::NamespaceDecl, name, "", l, c);

    if (match(TokenType::LBRACE)) {
        while (!isAtEnd() && !check(TokenType::RBRACE)) {
            auto child = parseTopLevel();
            if (child) node->addChild(child);
        }
        expect(TokenType::RBRACE, "Expected '}' after namespace");
    }
    return node;
}

// ══════════════════════════════════════════════════════════
//  Using declaration
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseUsing() {
    int l = current().line, c = current().col;
    advance(); // consume 'using'

    std::string val = "using";
    while (!isAtEnd() && !check(TokenType::SEMICOLON))
        val += " " + advance().value;
    match(TokenType::SEMICOLON);

    return std::make_shared<ASTNode>(
        NodeType::UsingDecl, val, "", l, c);
}

// ══════════════════════════════════════════════════════════
//  Template
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseTemplate() {
    int l = current().line, c = current().col;
    advance(); // consume 'template'

    std::string params;
    if (match(TokenType::OP_LT)) {
        while (!isAtEnd() && !check(TokenType::OP_GT))
            params += advance().value + " ";
        expect(TokenType::OP_GT, "Expected '>' after template params");
    }

    auto node = std::make_shared<ASTNode>(
        NodeType::TemplateDecl, params, "", l, c);

    // What follows the template declaration
    auto inner = parseTopLevel();
    if (inner) node->addChild(inner);

    return node;
}

// ══════════════════════════════════════════════════════════
//  Class declaration
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseClassDecl() {
    int l = current().line, c = current().col;
    advance(); // consume 'class'

    std::string name;
    if (check(TokenType::IDENTIFIER))
        name = advance().value;

    // Inheritance: class Foo : public Bar, protected Baz (multiple inheritance)
    std::string base;
    if (match(TokenType::OP_COLON)) {
        do {
            matchAny({ TokenType::KW_PUBLIC, TokenType::KW_PRIVATE,
                       TokenType::KW_PROTECTED, TokenType::KW_VIRTUAL });
            if (check(TokenType::IDENTIFIER)) {
                if (!base.empty()) base += ", ";
                base += advance().value;
                while (check(TokenType::OP_SCOPE)) {
                    base += advance().value;
                    if (check(TokenType::IDENTIFIER)) base += advance().value;
                }
            }
        } while (match(TokenType::COMMA) && !check(TokenType::LBRACE) && !isAtEnd());
    }

    auto node = std::make_shared<ASTNode>(
        NodeType::ClassDecl, name, base, l, c);

    if (match(TokenType::LBRACE)) {
        while (!isAtEnd() && !check(TokenType::RBRACE)) {
            // Access specifiers
            if (checkAny({ TokenType::KW_PUBLIC,
                           TokenType::KW_PRIVATE,
                           TokenType::KW_PROTECTED })) {
                int al = current().line, ac = current().col;
                std::string acc = advance().value;
                match(TokenType::OP_COLON);
                node->addChild(std::make_shared<ASTNode>(
                    NodeType::AccessSpecifier, acc, "", al, ac));
                continue;
            }
            try {
                ASTNodePtr member;
                // Constructor detection: ClassName(params) { body } or : initList {}
                if (check(TokenType::IDENTIFIER) &&
                    peek().type == TokenType::LPAREN) {
                    size_t savedPos = pos_;
                    int cl = current().line, cc = current().col;
                    std::string ctorName = current().value;
                    advance(); // consume IDENTIFIER
                    advance(); // consume (
                    int depth = 1;
                    while (!isAtEnd() && depth > 0) {
                        if      (check(TokenType::LPAREN))  depth++;
                        else if (check(TokenType::RPAREN))  depth--;
                        advance();
                    }
                    bool isCtor = check(TokenType::LBRACE)   ||
                                  check(TokenType::OP_COLON) ||
                                  check(TokenType::KW_CONST) ||
                                  check(TokenType::SEMICOLON);
                    pos_ = savedPos;
                    if (isCtor) {
                        advance(); // skip constructor name; parseFunctionDecl expects to start at (
                        member = parseFunctionDecl(ctorName, ctorName, cl, cc);
                    } else {
                        member = parseDeclaration();
                    }
                } else {
                    member = parseDeclaration();
                }
                if (member) node->addChild(member);
            } catch (...) { synchronize(); }
        }
        expect(TokenType::RBRACE, "Expected '}' after class body");
        match(TokenType::SEMICOLON);
    }
    return node;
}

// ══════════════════════════════════════════════════════════
//  Struct declaration
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseStructDecl() {
    int l = current().line, c = current().col;
    advance(); // consume 'struct'

    std::string name;
    if (check(TokenType::IDENTIFIER))
        name = advance().value;

    auto node = std::make_shared<ASTNode>(
        NodeType::StructDecl, name, "", l, c);

    if (match(TokenType::LBRACE)) {
        while (!isAtEnd() && !check(TokenType::RBRACE)) {
            try {
                auto member = parseDeclaration();
                if (member) node->addChild(member);
            } catch (...) { synchronize(); }
        }
        expect(TokenType::RBRACE, "Expected '}' after struct body");
        match(TokenType::SEMICOLON);
    }
    return node;
}

// ══════════════════════════════════════════════════════════
//  Enum declaration
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseEnumDecl() {
    int l = current().line, c = current().col;
    advance(); // consume 'enum'

    // enum class / enum struct
    matchAny({ TokenType::KW_CLASS, TokenType::KW_STRUCT });

    std::string name;
    if (check(TokenType::IDENTIFIER))
        name = advance().value;

    auto node = std::make_shared<ASTNode>(
        NodeType::EnumDecl, name, "", l, c);

    if (match(TokenType::LBRACE)) {
        while (!isAtEnd() && !check(TokenType::RBRACE)) {
            if (check(TokenType::IDENTIFIER)) {
                int vl = current().line, vc = current().col;
                std::string vname = advance().value;
                std::string vval;
                if (match(TokenType::OP_ASSIGN)) {
                    while (!isAtEnd() &&
                           !check(TokenType::COMMA) &&
                           !check(TokenType::RBRACE))
                        vval += advance().value;
                }
                node->addChild(std::make_shared<ASTNode>(
                    NodeType::EnumValue, vname, vval, vl, vc));
            }
            match(TokenType::COMMA);
        }
        expect(TokenType::RBRACE, "Expected '}' after enum");
        match(TokenType::SEMICOLON);
    }
    return node;
}

// ══════════════════════════════════════════════════════════
//  General declaration — function or variable
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseDeclaration() {
    if (!isTypeName()) {
        // Not a declaration — parse as expression statement
        return parseExprStmt();
    }

    int l = current().line, c = current().col;
    std::string typeName = parseTypeName();

    // Constructor / destructor: no return type name
    if (check(TokenType::OP_BIT_NOT)) {
        advance(); // ~
        std::string name = "~";
        if (check(TokenType::IDENTIFIER))
            name += advance().value;
        return parseFunctionDecl(typeName, name, l, c);
    }

    // Structured bindings: auto [a, b, c] = expr;
    if (check(TokenType::LBRACKET)) {
        advance(); // consume '['
        std::string names;
        while (!isAtEnd() && !check(TokenType::RBRACKET)) {
            if (check(TokenType::IDENTIFIER)) {
                if (!names.empty()) names += ", ";
                names += advance().value;
            }
            match(TokenType::COMMA);
        }
        expect(TokenType::RBRACKET, "Expected ']' after structured binding names");
        auto node = std::make_shared<ASTNode>(
            NodeType::VarDecl, "[" + names + "]", typeName, l, c);
        if (match(TokenType::OP_ASSIGN)) {
            auto init = parseExpression();
            if (init) node->addChild(init);
        }
        match(TokenType::SEMICOLON);
        return node;
    }

    // Operator overloading: operator+, operator==, operator(), etc.
    if (check(TokenType::KW_OPERATOR)) {
        advance(); // consume 'operator'
        std::string opName = "operator";
        if (check(TokenType::LPAREN) && peek().type == TokenType::RPAREN) {
            opName += "()"; advance(); advance();
        } else if (check(TokenType::LBRACKET) && peek().type == TokenType::RBRACKET) {
            opName += "[]"; advance(); advance();
        } else {
            while (!isAtEnd() && !check(TokenType::LPAREN) &&
                   !check(TokenType::LBRACE) && !check(TokenType::SEMICOLON))
                opName += advance().value;
        }
        return parseFunctionDecl(typeName, opName, l, c);
    }

    if (!check(TokenType::IDENTIFIER)) {
        // Out-of-class constructor: ReturnType::CtorName or bare CtorName followed by (
        if (check(TokenType::LPAREN))
            return parseFunctionDecl(typeName, typeName, l, c);
        addError("Expected identifier after type '" + typeName + "'");
        synchronize();
        return nullptr;
    }

    std::string name = advance().value;

    // Scope: Foo::bar
    while (check(TokenType::OP_SCOPE)) {
        name += advance().value; // ::
        if (check(TokenType::IDENTIFIER))
            name += advance().value;
    }

    // Function declaration
    if (check(TokenType::LPAREN)) {
        // Aage dekho — function hai ya constructor-style var init
        size_t savedPos = pos_;
        advance(); // consume (
        int depth = 1;
        while (!isAtEnd() && depth > 0) {
            if      (check(TokenType::LPAREN))  depth++;
            else if (check(TokenType::RPAREN))  depth--;
            advance();
        }
        // Closing ) ke baad kya hai?
        // Also detect forward decls with primitive return types: void foo(int h);
        static const std::vector<std::string> primTypes = {
            "void","int","float","double","char","bool","long","short","auto","string"
        };
        bool isPrimReturn = false;
        for (auto& p : primTypes)
            if (typeName.find(p) != std::string::npos) { isPrimReturn = true; break; }

        bool isFunc = check(TokenType::LBRACE)       ||  // { body }
                    check(TokenType::KW_CONST)   ||  // const method
                    check(TokenType::OP_COLON)   ||  // initializer list :
                    check(TokenType::KW_NOEXCEPT)||  // noexcept spec
                    check(TokenType::KW_OVERRIDE)||  // override
                    check(TokenType::KW_FINAL)   ||  // final
                    check(TokenType::OP_ASSIGN)  ||  // pure virtual = 0
                    (check(TokenType::SEMICOLON) &&
                     (typeName == name || isPrimReturn)); // forward decl

        pos_ = savedPos; // restore

        if (isFunc)
            return parseFunctionDecl(typeName, name, l, c);
        else
            return parseVarDecl(typeName, name, l, c);
    }

    // Variable declaration
    return parseVarDecl(typeName, name, l, c);
}

// ══════════════════════════════════════════════════════════
//  Function declaration
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseFunctionDecl(const std::string& retType,
                                      const std::string& name,
                                      int line, int col) {
    auto node = std::make_shared<ASTNode>(
        NodeType::FunctionDecl, name, retType, line, col);

    // Parameter list
    expect(TokenType::LPAREN, "Expected '(' in function declaration");
    auto params = parseParamList();
    if (params) node->addChild(params);
    expect(TokenType::RPAREN, "Expected ')' after parameters");

    // Qualifiers: const, noexcept, override, final
    while (checkAny({ TokenType::KW_CONST,    TokenType::KW_NOEXCEPT,
                      TokenType::KW_OVERRIDE,  TokenType::KW_FINAL }))
        advance();

    // Pure virtual: = 0
    if (check(TokenType::OP_ASSIGN)) {
        advance();
        if (check(TokenType::INTEGER_LITERAL)) advance();
    }

    // Constructor initializer list: : mem1(val1), mem2(val2), ...
    if (check(TokenType::OP_COLON)) {
        advance(); // consume ':'
        auto initList = std::make_shared<ASTNode>(
            NodeType::CompoundStmt, "init_list", "", 0, 0);
        do {
            if (isAtEnd() || check(TokenType::LBRACE)) break;
            if (check(TokenType::IDENTIFIER)) {
                int ml = current().line, mc = current().col;
                std::string memberName = advance().value;
                if (check(TokenType::LPAREN)) {
                    advance(); // '('
                    ASTNodePtr val;
                    if (!check(TokenType::RPAREN))
                        val = parseExpression();
                    expect(TokenType::RPAREN, "Expected ')' in member initializer");
                    auto assign = std::make_shared<ASTNode>(
                        NodeType::AssignExpr, "=", "", ml, mc);
                    assign->addChild(std::make_shared<ASTNode>(
                        NodeType::Identifier, memberName, "", ml, mc));
                    if (val) assign->addChild(val);
                    initList->addChild(assign);
                }
            } else {
                advance(); // skip unexpected token
            }
        } while (match(TokenType::COMMA));
        node->addChild(initList);
    }

    // Body or forward declaration
    if (check(TokenType::LBRACE)) {
        auto body = parseCompoundStmt();
        if (body) node->addChild(body);
    } else {
        match(TokenType::SEMICOLON);
    }

    return node;
}

// ══════════════════════════════════════════════════════════
//  Parameter list
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseParamList() {
    auto node = std::make_shared<ASTNode>(
        NodeType::CompoundStmt, "params", "", 0, 0);

    if (check(TokenType::RPAREN)) return node; // empty params

    // void foo(void)
    if (check(TokenType::KW_VOID) &&
        peek().type == TokenType::RPAREN) {
        advance();
        return node;
    }

    do {
        if (check(TokenType::OP_ELLIPSIS)) { advance(); break; }
        if (isTypeName()) {
            auto param = parseParam();
            if (param) {
                // DEBUG — console pe dekho
                // std::cerr << "PARAM: " << param->value << " type=" << param->dataType << "\n";
                node->addChild(param);
            }
        }
    } while (match(TokenType::COMMA) && !isAtEnd());

    return node;
}

ASTNodePtr Parser::parseParam() {
    int l = current().line, c = current().col;
    std::string typeName = parseTypeName();

    std::string name;
    if (check(TokenType::IDENTIFIER))
        name = advance().value;

    // Default value
    std::string defVal;
    if (match(TokenType::OP_ASSIGN)) {
        while (!isAtEnd() &&
               !check(TokenType::COMMA) &&
               !check(TokenType::RPAREN))
            defVal += advance().value;
    }

    return std::make_shared<ASTNode>(
        NodeType::ParamDecl, name, typeName, l, c);
}

// ══════════════════════════════════════════════════════════
//  Variable declaration
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseVarDecl(const std::string& typeName,
                                 const std::string& varName,
                                 int line, int col) {
    auto node = std::make_shared<ASTNode>(
        NodeType::VarDecl, varName, typeName, line, col);

    // Array: int arr[10]
    if (match(TokenType::LBRACKET)) {
        if (!check(TokenType::RBRACKET)) {
            auto size = parseExpression();
            if (size) node->addChild(size);
        }
        expect(TokenType::RBRACKET, "Expected ']' after array size");
    }

    // Initializer: = expr  or  {expr}  or  (expr)
    if (match(TokenType::OP_ASSIGN)) {
        auto init = parseExpression();
        if (init) node->addChild(init);
    } else if (check(TokenType::LBRACE)) {
        auto init = parseInitList();
        if (init) node->addChild(init);
    } else if (check(TokenType::LPAREN)) {
        advance(); // consume (
        auto initNode = std::make_shared<ASTNode>(
            NodeType::CallExpr, "ctor", "", line, col);  // ← l,c ki jagah line,col
        if (!check(TokenType::RPAREN)) {
            do {
                auto arg = parseExpression();
                if (arg) initNode->addChild(arg);
            } while (match(TokenType::COMMA) && !isAtEnd());
        }
        expect(TokenType::RPAREN, "Expected ')' in initializer");
        node->addChild(initNode);
    }

    // Multiple declarations: int a = 1, b = 2;
    while (match(TokenType::COMMA)) {
        if (check(TokenType::IDENTIFIER)) {
            int nl = current().line, nc = current().col;
            std::string nextName = advance().value;
            auto nextVar = parseVarDecl(typeName, nextName, nl, nc);
            if (nextVar) node->addChild(nextVar);
        }
    }

    match(TokenType::SEMICOLON);
    return node;
}

// ══════════════════════════════════════════════════════════
//  Statements
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseStatement() {
    switch (current().type) {
        case TokenType::LBRACE:       return parseCompoundStmt();
        case TokenType::KW_IF:        return parseIfStmt();
        case TokenType::KW_FOR:       return parseForStmt();
        case TokenType::KW_WHILE:     return parseWhileStmt();
        case TokenType::KW_DO:        return parseDoWhileStmt();
        case TokenType::KW_SWITCH:    return parseSwitchStmt();
        case TokenType::KW_RETURN:    return parseReturnStmt();
        case TokenType::KW_BREAK:     return parseBreakStmt();
        case TokenType::KW_CONTINUE:  return parseContinueStmt();
        case TokenType::KW_GOTO:      return parseGotoStmt();
        case TokenType::KW_TRY:       return parseTryStmt();
        case TokenType::KW_THROW:     return parseThrowStmt();
        case TokenType::SEMICOLON:
            advance();
            return std::make_shared<ASTNode>(NodeType::NullStmt, ";");
        default:
            // Label: IDENTIFIER followed by ':'
            if (check(TokenType::IDENTIFIER) &&
                pos_ + 1 < tokens_.size() &&
                tokens_[pos_ + 1].type == TokenType::OP_COLON)
                return parseLabelStmt();
            if (isTypeName()) return parseDeclaration();
            return parseExprStmt();
    }
}

ASTNodePtr Parser::parseCompoundStmt() {
    int l = current().line, c = current().col;
    expect(TokenType::LBRACE, "Expected '{'");

    auto node = std::make_shared<ASTNode>(
        NodeType::CompoundStmt, "{}", "", l, c);

    while (!isAtEnd() && !check(TokenType::RBRACE)) {
        try {
            auto stmt = parseStatement();
            if (stmt) node->addChild(stmt);
        } catch (...) { synchronize(); }
    }

    expect(TokenType::RBRACE, "Expected '}'");
    return node;
}

ASTNodePtr Parser::parseIfStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'if'
    bool isConstexpr = match(TokenType::KW_CONSTEXPR);

    auto node = std::make_shared<ASTNode>(
        NodeType::IfStmt, isConstexpr ? "if constexpr" : "if", "", l, c);

    expect(TokenType::LPAREN, "Expected '(' after if");
    auto cond = parseExpression();
    if (cond) node->addChild(cond);
    expect(TokenType::RPAREN, "Expected ')' after if condition");

    auto thenBranch = parseStatement();
    if (thenBranch) node->addChild(thenBranch);

    if (match(TokenType::KW_ELSE)) {
        auto elseBranch = parseStatement();
        if (elseBranch) node->addChild(elseBranch);
    }

    return node;
}

ASTNodePtr Parser::parseForStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'for'

    auto node = std::make_shared<ASTNode>(
        NodeType::ForStmt, "for", "", l, c);

    expect(TokenType::LPAREN, "Expected '(' after for");

    // Detect range-based for: for (type name : collection)
    {
        size_t savedPos = pos_;
        bool isRangeFor = false;
        int depth = 0;
        while (!isAtEnd()) {
            if      (check(TokenType::LPAREN))    depth++;
            else if (check(TokenType::RPAREN))    { if (depth-- == 0) break; }
            else if (check(TokenType::SEMICOLON)  && depth == 0) break;
            else if (check(TokenType::OP_COLON)   && depth == 0) { isRangeFor = true; break; }
            advance();
        }
        pos_ = savedPos;

        if (isRangeFor) {
            int vl = current().line, vc = current().col;
            std::string varType = isTypeName() ? parseTypeName() : "";
            std::string varName;
            if (check(TokenType::IDENTIFIER)) varName = advance().value;
            auto varDecl = std::make_shared<ASTNode>(NodeType::VarDecl, varName, varType, vl, vc);
            node->addChild(varDecl);
            expect(TokenType::OP_COLON, "Expected ':' in range-based for");
            auto collection = parseExpression();
            if (collection) node->addChild(collection);
            expect(TokenType::RPAREN, "Expected ')' after range-based for");
            auto body = parseStatement();
            if (body) node->addChild(body);
            node->value = "range-for";
            return node;
        }
    }

    // Init
    if (!check(TokenType::SEMICOLON)) {
        if (isTypeName()) {
            auto init = parseDeclaration();
            if (init) node->addChild(init);
        } else {
            auto init = parseExprStmt();
            if (init) node->addChild(init);
        }
    } else {
        advance(); // skip ;
        node->addChild(std::make_shared<ASTNode>(NodeType::NullStmt, ";"));
    }

    // Condition
    if (!check(TokenType::SEMICOLON)) {
        auto cond = parseExpression();
        if (cond) node->addChild(cond);
    }
    expect(TokenType::SEMICOLON, "Expected ';' in for loop");

    // Increment
    if (!check(TokenType::RPAREN)) {
        auto inc = parseExpression();
        if (inc) node->addChild(inc);
    }
    expect(TokenType::RPAREN, "Expected ')' after for clauses");

    auto body = parseStatement();
    if (body) node->addChild(body);

    return node;
}

ASTNodePtr Parser::parseWhileStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'while'

    auto node = std::make_shared<ASTNode>(
        NodeType::WhileStmt, "while", "", l, c);

    expect(TokenType::LPAREN,  "Expected '(' after while");
    auto cond = parseExpression();
    if (cond) node->addChild(cond);
    expect(TokenType::RPAREN, "Expected ')' after while condition");

    auto body = parseStatement();
    if (body) node->addChild(body);

    return node;
}

ASTNodePtr Parser::parseDoWhileStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'do'

    auto node = std::make_shared<ASTNode>(
        NodeType::DoWhileStmt, "do-while", "", l, c);

    auto body = parseStatement();
    if (body) node->addChild(body);

    expect(TokenType::KW_WHILE, "Expected 'while' after do body");
    expect(TokenType::LPAREN,   "Expected '(' after while");
    auto cond = parseExpression();
    if (cond) node->addChild(cond);
    expect(TokenType::RPAREN,   "Expected ')' after do-while condition");
    match(TokenType::SEMICOLON);

    return node;
}

ASTNodePtr Parser::parseSwitchStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'switch'

    auto node = std::make_shared<ASTNode>(
        NodeType::SwitchStmt, "switch", "", l, c);

    expect(TokenType::LPAREN, "Expected '(' after switch");
    auto expr = parseExpression();
    if (expr) node->addChild(expr);
    expect(TokenType::RPAREN, "Expected ')' after switch expr");

    expect(TokenType::LBRACE, "Expected '{' after switch");
    while (!isAtEnd() && !check(TokenType::RBRACE)) {
        if (check(TokenType::KW_CASE)) {
            int cl = current().line, cc = current().col;
            advance(); // consume 'case'
            auto val = parseExpression();
            expect(TokenType::OP_COLON, "Expected ':' after case value");
            auto caseNode = std::make_shared<ASTNode>(
                NodeType::CaseStmt, "case", "", cl, cc);
            if (val) caseNode->addChild(val);
            // Case body statements
            while (!isAtEnd() &&
                   !check(TokenType::KW_CASE) &&
                   !check(TokenType::KW_DEFAULT) &&
                   !check(TokenType::RBRACE)) {
                auto stmt = parseStatement();
                if (stmt) caseNode->addChild(stmt);
            }
            node->addChild(caseNode);
        } else if (check(TokenType::KW_DEFAULT)) {
            int dl = current().line, dc = current().col;
            advance();
            expect(TokenType::OP_COLON, "Expected ':' after default");
            auto defNode = std::make_shared<ASTNode>(
                NodeType::DefaultStmt, "default", "", dl, dc);
            while (!isAtEnd() &&
                   !check(TokenType::KW_CASE) &&
                   !check(TokenType::RBRACE)) {
                auto stmt = parseStatement();
                if (stmt) defNode->addChild(stmt);
            }
            node->addChild(defNode);
        } else {
            auto stmt = parseStatement();
            if (stmt) node->addChild(stmt);
        }
    }
    expect(TokenType::RBRACE, "Expected '}' after switch body");
    return node;
}

ASTNodePtr Parser::parseReturnStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'return'

    auto node = std::make_shared<ASTNode>(
        NodeType::ReturnStmt, "return", "", l, c);

    if (!check(TokenType::SEMICOLON)) {
        auto expr = parseExpression();
        if (expr) node->addChild(expr);
    }
    match(TokenType::SEMICOLON);
    return node;
}

ASTNodePtr Parser::parseBreakStmt() {
    int l = current().line, c = current().col;
    advance();
    match(TokenType::SEMICOLON);
    return std::make_shared<ASTNode>(NodeType::BreakStmt, "break", "", l, c);
}

ASTNodePtr Parser::parseContinueStmt() {
    int l = current().line, c = current().col;
    advance();
    match(TokenType::SEMICOLON);
    return std::make_shared<ASTNode>(NodeType::ContinueStmt, "continue", "", l, c);
}

ASTNodePtr Parser::parseGotoStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'goto'
    std::string label;
    if (check(TokenType::IDENTIFIER)) label = advance().value;
    match(TokenType::SEMICOLON);
    return std::make_shared<ASTNode>(NodeType::GotoStmt, label, "", l, c);
}

ASTNodePtr Parser::parseLabelStmt() {
    int l = current().line, c = current().col;
    std::string name = advance().value; // identifier
    advance(); // consume ':'
    auto node = std::make_shared<ASTNode>(NodeType::LabelStmt, name, "", l, c);
    if (!isAtEnd() && !check(TokenType::RBRACE))
        if (auto stmt = parseStatement()) node->addChild(stmt);
    return node;
}

ASTNodePtr Parser::parseTryStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'try'

    auto node = std::make_shared<ASTNode>(
        NodeType::TryStmt, "try", "", l, c);

    auto body = parseCompoundStmt();
    if (body) node->addChild(body);

    // One or more catch clauses
    while (check(TokenType::KW_CATCH)) {
        int cl = current().line, cc = current().col;
        advance(); // consume 'catch'

        expect(TokenType::LPAREN, "Expected '(' after catch");
        std::string excType;
        while (!isAtEnd() && !check(TokenType::RPAREN))
            excType += advance().value + " ";
        expect(TokenType::RPAREN, "Expected ')' after catch param");

        auto catchNode = std::make_shared<ASTNode>(
            NodeType::CatchStmt, excType, "", cl, cc);
        auto catchBody = parseCompoundStmt();
        if (catchBody) catchNode->addChild(catchBody);
        node->addChild(catchNode);
    }

    return node;
}

ASTNodePtr Parser::parseThrowStmt() {
    int l = current().line, c = current().col;
    advance(); // consume 'throw'

    auto node = std::make_shared<ASTNode>(
        NodeType::ThrowStmt, "throw", "", l, c);

    if (!check(TokenType::SEMICOLON)) {
        auto expr = parseExpression();
        if (expr) node->addChild(expr);
    }
    match(TokenType::SEMICOLON);
    return node;
}

ASTNodePtr Parser::parseExprStmt() {
    int l = current().line, c = current().col;
    auto expr = parseExpression();
    match(TokenType::SEMICOLON);

    auto node = std::make_shared<ASTNode>(
        NodeType::ExprStmt, "", "", l, c);
    if (expr) node->addChild(expr);
    return node;
}

// ══════════════════════════════════════════════════════════
//  Expressions — precedence climbing
// ══════════════════════════════════════════════════════════

ASTNodePtr Parser::parseExpression() {
    return parseAssignment();
}

ASTNodePtr Parser::parseAssignment() {
    auto left = parseTernary();

    static const std::vector<TokenType> assignOps = {
        TokenType::OP_ASSIGN,
        TokenType::OP_PLUS_ASSIGN,   TokenType::OP_MINUS_ASSIGN,
        TokenType::OP_STAR_ASSIGN,   TokenType::OP_SLASH_ASSIGN,
        TokenType::OP_PERCENT_ASSIGN,TokenType::OP_AND_ASSIGN,
        TokenType::OP_OR_ASSIGN,     TokenType::OP_XOR_ASSIGN,
        TokenType::OP_LSHIFT_ASSIGN, TokenType::OP_RSHIFT_ASSIGN,
    };

    if (checkAny(assignOps)) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseAssignment();

        auto node = std::make_shared<ASTNode>(
            NodeType::AssignExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        return node;
    }
    return left;
}

ASTNodePtr Parser::parseTernary() {
    auto cond = parseLogicalOr();

    if (match(TokenType::OP_TERNARY)) {
        int l = current().line, c = current().col;
        auto thenExpr = parseExpression();
        expect(TokenType::OP_COLON, "Expected ':' in ternary");
        auto elseExpr = parseTernary();

        auto node = std::make_shared<ASTNode>(
            NodeType::TernaryExpr, "?:", "", l, c);
        if (cond)     node->addChild(cond);
        if (thenExpr) node->addChild(thenExpr);
        if (elseExpr) node->addChild(elseExpr);
        return node;
    }
    return cond;
}

ASTNodePtr Parser::parseLogicalOr() {
    auto left = parseLogicalAnd();
    while (check(TokenType::OP_LOGICAL_OR)) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseLogicalAnd();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseLogicalAnd() {
    auto left = parseBitwiseOr();
    while (check(TokenType::OP_LOGICAL_AND)) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseBitwiseOr();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseBitwiseOr() {
    auto left = parseBitwiseXor();
    while (check(TokenType::OP_BIT_OR)) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseBitwiseXor();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseBitwiseXor() {
    auto left = parseBitwiseAnd();
    while (check(TokenType::OP_BIT_XOR)) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseBitwiseAnd();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseBitwiseAnd() {
    auto left = parseEquality();
    while (check(TokenType::OP_BIT_AND)) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseEquality();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseEquality() {
    auto left = parseRelational();
    while (checkAny({ TokenType::OP_EQ, TokenType::OP_NEQ })) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseRelational();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseRelational() {
    auto left = parseShift();
    while (checkAny({ TokenType::OP_LT,  TokenType::OP_GT,
                      TokenType::OP_LTE, TokenType::OP_GTE })) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseShift();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseShift() {
    auto left = parseAdditive();
    while (checkAny({ TokenType::OP_LSHIFT, TokenType::OP_RSHIFT })) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseAdditive();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseAdditive() {
    auto left = parseMultiplicative();
    while (checkAny({ TokenType::OP_PLUS, TokenType::OP_MINUS })) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseMultiplicative();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseMultiplicative() {
    auto left = parseUnary();
    while (checkAny({ TokenType::OP_STAR,
                      TokenType::OP_SLASH,
                      TokenType::OP_PERCENT })) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto right = parseUnary();
        auto node = std::make_shared<ASTNode>(NodeType::BinaryExpr, op, "", l, c);
        if (left)  node->addChild(left);
        if (right) node->addChild(right);
        left = node;
    }
    return left;
}

ASTNodePtr Parser::parseUnary() {
    // Prefix operators
    if (checkAny({ TokenType::OP_LOGICAL_NOT, TokenType::OP_BIT_NOT,
                   TokenType::OP_MINUS,       TokenType::OP_PLUS,
                   TokenType::OP_INC,         TokenType::OP_DEC,
                   TokenType::OP_STAR,        TokenType::OP_BIT_AND })) {
        int l = current().line, c = current().col;
        std::string op = advance().value;
        auto operand = parseUnary();
        auto node = std::make_shared<ASTNode>(
            NodeType::UnaryExpr, op, "", l, c);
        if (operand) node->addChild(operand);
        return node;
    }

    // sizeof
    if (check(TokenType::KW_SIZEOF)) {
        int l = current().line, c = current().col;
        advance();
        auto node = std::make_shared<ASTNode>(
            NodeType::SizeofExpr, "sizeof", "", l, c);
        if (match(TokenType::LPAREN)) {
            auto inner = parseExpression();
            if (inner) node->addChild(inner);
            expect(TokenType::RPAREN, "Expected ')' after sizeof");
        }
        return node;
    }

    // new
    if (check(TokenType::KW_NEW)) {
        int l = current().line, c = current().col;
        advance();
        auto node = std::make_shared<ASTNode>(
            NodeType::NewExpr, "new", "", l, c);
        if (isTypeName()) {
            std::string t = parseTypeName();
            node->addChild(std::make_shared<ASTNode>(
                NodeType::BuiltinType, t, "", l, c));
        }
        if (match(TokenType::LPAREN)) {
            if (!check(TokenType::RPAREN)) {
                auto arg = parseExpression();
                if (arg) node->addChild(arg);
            }
            expect(TokenType::RPAREN, "Expected ')' after new args");
        }
        return node;
    }

    // delete
    if (check(TokenType::KW_DELETE)) {
        int l = current().line, c = current().col;
        advance();
        bool isArray = false;
        if (match(TokenType::LBRACKET)) {
            expect(TokenType::RBRACKET, "Expected ']' after delete[");
            isArray = true;
        }
        auto node = std::make_shared<ASTNode>(
            NodeType::DeleteExpr,
            isArray ? "delete[]" : "delete", "", l, c);
        auto operand = parseUnary();
        if (operand) node->addChild(operand);
        return node;
    }

    // Casts: static_cast<T>(expr)
    if (checkAny({ TokenType::KW_STATIC_CAST,
                   TokenType::KW_DYNAMIC_CAST,
                   TokenType::KW_CONST_CAST,
                   TokenType::KW_REINTERPRET_CAST })) {
        int l = current().line, c = current().col;
        std::string castName = advance().value;
        auto node = std::make_shared<ASTNode>(
            NodeType::CastExpr, castName, "", l, c);
        expect(TokenType::OP_LT, "Expected '<' after cast");
        std::string castType;
        while (!isAtEnd() && !check(TokenType::OP_GT))
            castType += advance().value;
        expect(TokenType::OP_GT, "Expected '>' after cast type");
        node->addChild(std::make_shared<ASTNode>(
            NodeType::BuiltinType, castType, "", l, c));
        expect(TokenType::LPAREN, "Expected '(' in cast");
        auto inner = parseExpression();
        if (inner) node->addChild(inner);
        expect(TokenType::RPAREN, "Expected ')' in cast");
        return node;
    }

    return parsePostfix();
}

ASTNodePtr Parser::parsePostfix() {
    auto expr = parsePrimary();

    while (true) {
        if (check(TokenType::LPAREN)) {
            expr = parseCallExpr(expr);
        } else if (check(TokenType::LBRACKET)) {
            expr = parseIndexExpr(expr);
        } else if (check(TokenType::OP_DOT)) {
            int l = current().line, c = current().col;
            advance();
            std::string member;
            if (check(TokenType::IDENTIFIER))
                member = advance().value;
            auto node = std::make_shared<ASTNode>(
                NodeType::MemberExpr, member, "", l, c);
            if (expr) node->addChild(expr);
            expr = node;
        } else if (check(TokenType::OP_ARROW)) {
            int l = current().line, c = current().col;
            advance();
            std::string member;
            if (check(TokenType::IDENTIFIER))
                member = advance().value;
            auto node = std::make_shared<ASTNode>(
                NodeType::ArrowExpr, member, "", l, c);
            if (expr) node->addChild(expr);
            expr = node;
        } else if (checkAny({ TokenType::OP_INC, TokenType::OP_DEC })) {
            int l = current().line, c = current().col;
            std::string op = advance().value + "(post)";
            auto node = std::make_shared<ASTNode>(
                NodeType::UnaryExpr, op, "", l, c);
            if (expr) node->addChild(expr);
            expr = node;
        } else {
            break;
        }
    }
    return expr;
}

ASTNodePtr Parser::parseCallExpr(ASTNodePtr callee) {
    int l = current().line, c = current().col;
    advance(); // consume '('

    auto node = std::make_shared<ASTNode>(
        NodeType::CallExpr, "call", "", l, c);
    if (callee) node->addChild(callee);

    // Arguments
    if (!check(TokenType::RPAREN)) {
        do {
            auto arg = parseExpression();
            if (arg) node->addChild(arg);
        } while (match(TokenType::COMMA) && !isAtEnd());
    }

    expect(TokenType::RPAREN, "Expected ')' after arguments");
    return node;
}

ASTNodePtr Parser::parseIndexExpr(ASTNodePtr base) {
    int l = current().line, c = current().col;
    advance(); // consume '['

    auto node = std::make_shared<ASTNode>(
        NodeType::IndexExpr, "[]", "", l, c);
    if (base) node->addChild(base);

    auto index = parseExpression();
    if (index) node->addChild(index);

    expect(TokenType::RBRACKET, "Expected ']' after index");
    return node;
}

ASTNodePtr Parser::parseLambda() {
    int l = current().line, c = current().col;
    advance(); // consume '['

    // Capture list: [&], [=], [&x, y], etc.
    std::string capture;
    while (!isAtEnd() && !check(TokenType::RBRACKET))
        capture += advance().value;
    expect(TokenType::RBRACKET, "Expected ']' after lambda capture");

    auto node = std::make_shared<ASTNode>(
        NodeType::LambdaExpr, capture, "", l, c);

    // Optional parameter list: (params)
    if (check(TokenType::LPAREN)) {
        advance(); // consume '('
        auto params = parseParamList();
        if (params) node->addChild(params);
        expect(TokenType::RPAREN, "Expected ')' after lambda params");
    }

    // Optional specifiers: mutable, constexpr, noexcept
    while (checkAny({ TokenType::KW_MUTABLE, TokenType::KW_CONSTEXPR,
                      TokenType::KW_NOEXCEPT }))
        advance();

    // Optional trailing return type: -> type
    if (check(TokenType::OP_ARROW)) {
        advance(); // consume '->'
        parseTypeName(); // consume return type, store as dataType
    }

    // Body
    if (check(TokenType::LBRACE)) {
        auto body = parseCompoundStmt();
        if (body) node->addChild(body);
    }

    return node;
}

ASTNodePtr Parser::parseInitList() {
    int l = current().line, c = current().col;
    advance(); // consume '{'

    auto node = std::make_shared<ASTNode>(
        NodeType::InitListExpr, "{}", "", l, c);

    if (!check(TokenType::RBRACE)) {
        do {
            if (check(TokenType::RBRACE)) break;
            auto elem = parseExpression();
            if (elem) node->addChild(elem);
        } while (match(TokenType::COMMA) && !isAtEnd());
    }

    expect(TokenType::RBRACE, "Expected '}' after init list");
    return node;
}

ASTNodePtr Parser::parsePrimary() {
    int l = current().line, c = current().col;

    // Integer literal
    if (check(TokenType::INTEGER_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::IntLiteral, advance().value, "int", l, c);
    }
    // Float literal
    if (check(TokenType::FLOAT_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::FloatLiteral, advance().value, "float", l, c);
    }
    // Double literal
    if (check(TokenType::DOUBLE_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::DoubleLiteral, advance().value, "double", l, c);
    }
    // Char literal
    if (check(TokenType::CHAR_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::CharLiteral, advance().value, "char", l, c);
    }
    // String literal
    if (check(TokenType::STRING_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::StringLiteral, advance().value, "string", l, c);
    }
    // Bool literal
    if (check(TokenType::BOOL_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::BoolLiteral, advance().value, "bool", l, c);
    }
    // nullptr
    if (check(TokenType::KW_NULLPTR) ||
        check(TokenType::NULLPTR_LITERAL)) {
        return std::make_shared<ASTNode>(
            NodeType::NullptrLiteral, advance().value, "nullptr_t", l, c);
    }
    // this
    if (check(TokenType::KW_THIS)) {
        return std::make_shared<ASTNode>(
            NodeType::Identifier, advance().value, "", l, c);
    }
    // Identifier or scope expression
    if (check(TokenType::IDENTIFIER)) {
        std::string name = advance().value;
        // Scope: std::cout
        while (check(TokenType::OP_SCOPE)) {
            name += advance().value; // ::
            if (check(TokenType::IDENTIFIER))
                name += advance().value;
        }
        return std::make_shared<ASTNode>(
            NodeType::Identifier, name, "", l, c);
    }
    // Scope starting with ::
    if (check(TokenType::OP_SCOPE)) {
        std::string name = advance().value;
        if (check(TokenType::IDENTIFIER))
            name += advance().value;
        return std::make_shared<ASTNode>(
            NodeType::ScopeExpr, name, "", l, c);
    }
    // Grouped expression: (expr)
    if (match(TokenType::LPAREN)) {
        auto expr = parseExpression();
        expect(TokenType::RPAREN, "Expected ')' after expression");
        return expr;
    }
    // Init list: {1, 2, 3}
    if (check(TokenType::LBRACE)) {
        return parseInitList();
    }

    // Lambda: [capture](params) { body }
    if (check(TokenType::LBRACKET)) {
        return parseLambda();
    }

    // Unknown — skip and report
    addError("Unexpected token '" + current().value + "' in expression");
    auto unknown = std::make_shared<ASTNode>(
        NodeType::Unknown, current().value, "", l, c);
    advance();
    return unknown;
}

// ══════════════════════════════════════════════════════════
//  JSON output
// ══════════════════════════════════════════════════════════

std::string Parser::toJSON() const {
    std::ostringstream out;
    out << "{\n";
    out << "  \"ast\": ";
    if (root_) {
        out << root_->toJSON(1);
    } else {
        out << "null";
    }
    out << ",\n  \"parse_errors\": [\n";
    for (size_t i = 0; i < errors_.size(); i++) {
        const auto& e = errors_[i];
        out << "    {\"message\": \""
            << e.message << "\", \"line\": "
            << e.line    << ", \"col\": "
            << e.col     << "}";
        if (i + 1 < errors_.size()) out << ",";
        out << "\n";
    }
    out << "  ]\n}";
    return out.str();
}
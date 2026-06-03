export default {
  id:     "parser",
  num:    "02",
  label:  "Parser — Grammar",
  color:  "#aa44ff",
  icon:   "⟨⟩",
  tagline:"Define grammar rules and build AST",

  theory: {
    what: "A Parser takes tokens and checks them against grammar rules. It builds an Abstract Syntax Tree (AST) showing the hierarchical structure of the program.",

    files: [
      {
        name: "ast.hpp",
        content: `#pragma once
#include <string>
#include <vector>
#include <memory>

// Grammar rule:
//   program → statement*
//   statement → varDecl | exprStmt | ifStmt | whileStmt
//   expr → term (('+' | '-') term)*
//   term → factor (('*' | '/') factor)*
//   factor → NUMBER | IDENTIFIER | '(' expr ')'

struct ASTNode {
  std::string type;   // "Program","BinOp","Number",
                      // "Identifier","VarDecl","IfStmt"
  std::string value;  // operator, identifier name, number
  int         line = 0;

  std::vector<std::shared_ptr<ASTNode>> children;

  ASTNode(std::string t, std::string v = "")
    : type(std::move(t)), value(std::move(v)) {}
};

using ASTPtr = std::shared_ptr<ASTNode>;

inline ASTPtr makeNode(std::string type,
                        std::string value = "") {
  return std::make_shared<ASTNode>(
    std::move(type), std::move(value));
}`,
      },
      {
        name: "parser.hpp",
        content: `#pragma once
#include <vector>
#include "token.hpp"
#include "ast.hpp"

class Parser {
public:
  explicit Parser(std::vector<Token> tokens);
  ASTPtr parse();  // entry point → returns Program node

private:
  std::vector<Token> tokens;
  size_t pos = 0;

  Token& current();
  Token& peek(int n = 1);
  Token  consume();
  Token  expect(TokenType t, const char* msg);
  bool   check(TokenType t) const;
  bool   match(TokenType t);

  // One function per grammar rule
  ASTPtr parseProgram();
  ASTPtr parseStatement();
  ASTPtr parseVarDecl();
  ASTPtr parseIfStmt();
  ASTPtr parseWhileStmt();
  ASTPtr parseExprStmt();
  ASTPtr parseExpr();
  ASTPtr parseTerm();
  ASTPtr parseFactor();
};`,
      },
      {
        name: "parser.cpp",
        content: `#include "parser.hpp"
#include <stdexcept>

Parser::Parser(std::vector<Token> toks)
  : tokens(std::move(toks)), pos(0) {}

Token& Parser::current() { return tokens[pos]; }
Token& Parser::peek(int n) {
  size_t i = pos + n;
  return i < tokens.size() ? tokens[i] : tokens.back();
}
Token Parser::consume() { return tokens[pos++]; }
bool  Parser::check(TokenType t) const {
  return tokens[pos].type == t;
}
bool  Parser::match(TokenType t) {
  if (check(t)) { consume(); return true; }
  return false;
}
Token Parser::expect(TokenType t, const char* msg) {
  if (!check(t))
    throw std::runtime_error(std::string(msg)
      + " — got: " + current().value);
  return consume();
}

ASTPtr Parser::parseProgram() {
  auto prog = makeNode("Program");
  while (!check(TokenType::EOF_TOKEN))
    prog->children.push_back(parseStatement());
  return prog;
}

ASTPtr Parser::parseStatement() {
  if (check(TokenType::KW_INT) ||
      check(TokenType::KW_FLOAT)) return parseVarDecl();
  if (check(TokenType::KW_IF))    return parseIfStmt();
  if (check(TokenType::KW_WHILE)) return parseWhileStmt();
  return parseExprStmt();
}

ASTPtr Parser::parseVarDecl() {
  std::string typeName = consume().value;  // int / float
  auto nameToken = expect(TokenType::IDENTIFIER, "Expected variable name");
  auto node = makeNode("VarDecl", nameToken.value);
  node->children.push_back(makeNode("Type", typeName));
  if (match(TokenType::ASSIGN))
    node->children.push_back(parseExpr());
  expect(TokenType::SEMICOLON, "Expected ';'");
  return node;
}

ASTPtr Parser::parseIfStmt() {
  consume(); // 'if'
  expect(TokenType::LPAREN, "Expected '('");
  auto cond = parseExpr();
  expect(TokenType::RPAREN, "Expected ')'");
  expect(TokenType::LBRACE, "Expected '{'");
  auto body = makeNode("Block");
  while (!check(TokenType::RBRACE) && !check(TokenType::EOF_TOKEN))
    body->children.push_back(parseStatement());
  expect(TokenType::RBRACE, "Expected '}'");
  auto node = makeNode("IfStmt");
  node->children = { cond, body };
  return node;
}

ASTPtr Parser::parseWhileStmt() {
  consume(); // 'while'
  expect(TokenType::LPAREN, "Expected '('");
  auto cond = parseExpr();
  expect(TokenType::RPAREN, "Expected ')'");
  expect(TokenType::LBRACE, "Expected '{'");
  auto body = makeNode("Block");
  while (!check(TokenType::RBRACE) && !check(TokenType::EOF_TOKEN))
    body->children.push_back(parseStatement());
  expect(TokenType::RBRACE, "Expected '}'");
  auto node = makeNode("WhileStmt");
  node->children = { cond, body };
  return node;
}

ASTPtr Parser::parseExprStmt() {
  auto e = parseExpr();
  expect(TokenType::SEMICOLON, "Expected ';'");
  return e;
}

ASTPtr Parser::parseExpr() {
  auto left = parseTerm();
  while (check(TokenType::PLUS) || check(TokenType::MINUS)) {
    std::string op = consume().value;
    auto right = parseTerm();
    auto node = makeNode("BinOp", op);
    node->children = { left, right };
    left = node;
  }
  return left;
}

ASTPtr Parser::parseTerm() {
  auto left = parseFactor();
  while (check(TokenType::STAR) || check(TokenType::SLASH)) {
    std::string op = consume().value;
    auto right = parseFactor();
    auto node = makeNode("BinOp", op);
    node->children = { left, right };
    left = node;
  }
  return left;
}

ASTPtr Parser::parseFactor() {
  if (check(TokenType::NUMBER)) {
    auto tok = consume();
    return makeNode("Number", tok.value);
  }
  if (check(TokenType::IDENTIFIER)) {
    auto tok = consume();
    return makeNode("Identifier", tok.value);
  }
  if (match(TokenType::LPAREN)) {
    auto e = parseExpr();
    expect(TokenType::RPAREN, "Expected ')'");
    return e;
  }
  throw std::runtime_error("Unexpected token: " + current().value);
}

ASTPtr Parser::parse() { return parseProgram(); }`,
      },
    ],

    steps: [
      "Write grammar in BNF/EBNF form first",
      "One function per grammar rule",
      "current() to peek, consume() to advance",
      "expect() to enforce required tokens",
      "Build AST nodes in each parse function",
      "Handle operator precedence via rule hierarchy",
      "Report errors with line/col from tokens",
    ],
    tips: [
      "Higher precedence operators → deeper in grammar",
      "Left recursion must be eliminated",
      "Recursive Descent is easiest to hand-write",
      "LALR parsers (yacc/bison) for complex grammars",
    ],
  },

  workspaceFiles: [
    {
      name: "my_ast.hpp",
      content: `#pragma once
#include <string>
#include <vector>
#include <memory>

struct ASTNode {
  std::string type;   // "BinOp", "Number", "Identifier"
  std::string value;  // operator or literal value
  std::vector<std::shared_ptr<ASTNode>> children;

  ASTNode(std::string t, std::string v = "")
    : type(std::move(t)), value(std::move(v)) {}
};

using ASTPtr = std::shared_ptr<ASTNode>;`,
    },
    {
      name: "my_parser.hpp",
      content: `#pragma once
#include <vector>
#include "my_token.hpp"
#include "my_ast.hpp"

class MyParser {
public:
  explicit MyParser(std::vector<Token> tokens);
  ASTPtr parse();

private:
  std::vector<Token> tokens;
  int pos = 0;

  Token& current();
  Token  consume();
  bool   check(TokenType t) const;

  // TODO: One function per grammar rule
  ASTPtr parseExpr();
  ASTPtr parseTerm();
  ASTPtr parseFactor();
};`,
    },
    {
      name: "my_parser.cpp",
      content: `#include "my_parser.hpp"
#include <stdexcept>
#include <iostream>
using namespace std;

MyParser::MyParser(std::vector<Token> toks)
  : tokens(std::move(toks)), pos(0) {}

Token& MyParser::current() { return tokens[pos]; }
Token  MyParser::consume()  { return tokens[pos++]; }
bool   MyParser::check(TokenType t) const {
  return tokens[pos].type == t;
}

// Grammar: expr → term (('+' | '-') term)*
ASTPtr MyParser::parseExpr() {
  auto left = parseTerm();

  while (check(TokenType::PLUS) || check(TokenType::MINUS)) {
    std::string op = consume().value;
    auto right = parseTerm();

    auto node = std::make_shared<ASTNode>("BinOp", op);
    node->children = { left, right };
    left = node;
  }
  return left;
}

// Grammar: term → factor (('*' | '/') factor)*
ASTPtr MyParser::parseTerm() {
  // TODO: handle * and / like parseExpr handles + and -
  return parseFactor();
}

// Grammar: factor → NUMBER | IDENTIFIER | '(' expr ')'
ASTPtr MyParser::parseFactor() {
  if (check(TokenType::NUMBER)) {
    auto tok = consume();
    return std::make_shared<ASTNode>("Number", tok.value);
  }
  if (check(TokenType::IDENTIFIER)) {
    auto tok = consume();
    return std::make_shared<ASTNode>("Identifier", tok.value);
  }
  // TODO: handle parenthesised expressions
  throw std::runtime_error("Unexpected: " + current().value);
}

ASTPtr MyParser::parse() { return parseExpr(); }

int main() {
  // TODO: connect your lexer output → parser input
  cout << "Parser ready. Connect lexer tokens." << endl;
  return 0;
}`,
    },
  ],

  outputSample: `Parsing: "int x = 3 + 4 * 2;"

AST:
Program
└── VarDecl  (x : int)
    ├── Type        "int"
    └── BinOp       "+"
        ├── Number      "3"
        └── BinOp       "*"
            ├── Number  "4"
            └── Number  "2"

✓  Parse successful — 1 statement, depth 4`,

  template: `// MY LANGUAGE PARSER
#include <iostream>
#include <vector>
#include <string>
using namespace std;

struct ASTNode {
  string type, value;
  vector<ASTNode*> children;
  ASTNode(string t, string v=""):type(t),value(v){}
};

class MyParser {
  int pos = 0;
public:
  ASTNode* parseExpr() { return new ASTNode{"Program"}; }
};

int main() { MyParser p; auto ast = p.parseExpr(); cout << ast->type; }`,
};

export default {
  id:     "lexer",
  num:    "01",
  label:  "Lexer — Tokenizer",
  color:  "#4488ff",
  icon:   "◈",
  tagline:"Define what tokens your language has",

  theory: {
    what: "A Lexer reads characters one by one and groups them into tokens. You define WHAT counts as a valid token using regular expressions or simple rules.",

    files: [
      {
        name: "token.hpp",
        content: `#pragma once
#include <string>

// Every distinct syntactic unit in your language
enum class TokenType {
  // Literals
  NUMBER, STRING, IDENTIFIER,
  // Keywords
  KW_INT, KW_FLOAT, KW_IF,
  KW_ELSE, KW_WHILE, KW_RETURN,
  // Arithmetic
  PLUS, MINUS, STAR, SLASH, PERCENT,
  // Relational / assignment
  ASSIGN, EQ, NEQ, LT, LE, GT, GE,
  // Punctuation
  SEMICOLON, COMMA,
  LPAREN, RPAREN,
  LBRACE, RBRACE,
  // Special
  EOF_TOKEN
};

inline const char* tokenName(TokenType t) {
  switch (t) {
    case TokenType::NUMBER:     return "NUMBER";
    case TokenType::STRING:     return "STRING";
    case TokenType::IDENTIFIER: return "IDENTIFIER";
    case TokenType::PLUS:       return "PLUS";
    case TokenType::MINUS:      return "MINUS";
    case TokenType::STAR:       return "STAR";
    case TokenType::SLASH:      return "SLASH";
    case TokenType::ASSIGN:     return "ASSIGN";
    case TokenType::EQ:         return "EQ";
    case TokenType::SEMICOLON:  return "SEMICOLON";
    case TokenType::EOF_TOKEN:  return "EOF";
    default:                    return "UNKNOWN";
  }
}

struct Token {
  TokenType   type;
  std::string value;
  int         line, col;
};`,
      },
      {
        name: "lexer.hpp",
        content: `#pragma once
#include <string>
#include <vector>
#include "token.hpp"

class Lexer {
public:
  explicit Lexer(std::string source);

  // Tokenize the entire source.
  // The last token is always EOF_TOKEN.
  std::vector<Token> tokenize();

private:
  std::string src;
  size_t      pos  = 0;
  int         line = 1;
  int         col  = 1;

  char current()       const;
  char peek(int n = 1) const;
  void advance();
  void skipWhitespace();
  void skipLineComment();

  Token readNumber();
  Token readString();
  Token readWord();    // identifiers + keywords
  Token readSymbol();  // operators + punctuation
};`,
      },
      {
        name: "lexer.cpp",
        content: `#include "lexer.hpp"
#include <cctype>
#include <stdexcept>
#include <unordered_map>

static const std::unordered_map<std::string, TokenType> KEYWORDS = {
  {"int",    TokenType::KW_INT  },
  {"float",  TokenType::KW_FLOAT},
  {"if",     TokenType::KW_IF   },
  {"else",   TokenType::KW_ELSE },
  {"while",  TokenType::KW_WHILE},
  {"return", TokenType::KW_RETURN},
};

Lexer::Lexer(std::string src) : src(std::move(src)) {}

char Lexer::current()    const {
  return pos < src.size() ? src[pos] : 0;
}
char Lexer::peek(int n)  const {
  return pos+n < src.size() ? src[pos+n] : 0;
}
void Lexer::advance() {
  if (src[pos] == '\\n') { line++; col = 1; } else col++;
  pos++;
}
void Lexer::skipWhitespace() {
  while (std::isspace(current())) advance();
}
void Lexer::skipLineComment() {
  while (current() && current() != '\\n') advance();
}

Token Lexer::readNumber() {
  int sc = col; std::string v;
  while (std::isdigit(current()) || current() == '.') {
    v += current(); advance();
  }
  return { TokenType::NUMBER, v, line, sc };
}
Token Lexer::readString() {
  int sc = col; advance(); // skip "
  std::string v;
  while (current() && current() != '"') { v += current(); advance(); }
  if (current() == '"') advance();
  return { TokenType::STRING, v, line, sc };
}
Token Lexer::readWord() {
  int sc = col; std::string v;
  while (std::isalnum(current()) || current() == '_') {
    v += current(); advance();
  }
  auto it = KEYWORDS.find(v);
  TokenType t = (it != KEYWORDS.end()) ? it->second : TokenType::IDENTIFIER;
  return { t, v, line, sc };
}
Token Lexer::readSymbol() {
  int sc = col; char c = current(); advance();
  switch (c) {
    case '+': return {TokenType::PLUS,     "+", line, sc};
    case '-': return {TokenType::MINUS,    "-", line, sc};
    case '*': return {TokenType::STAR,     "*", line, sc};
    case '/':
      if (current() == '/') { advance(); skipLineComment(); return readSymbol(); }
      return {TokenType::SLASH, "/", line, sc};
    case '%': return {TokenType::PERCENT,  "%", line, sc};
    case '=':
      if (current()=='=') { advance(); return {TokenType::EQ,    "==", line, sc}; }
      return {TokenType::ASSIGN, "=", line, sc};
    case '<':
      if (current()=='=') { advance(); return {TokenType::LE,    "<=", line, sc}; }
      return {TokenType::LT, "<", line, sc};
    case '>':
      if (current()=='=') { advance(); return {TokenType::GE,    ">=", line, sc}; }
      return {TokenType::GT, ">", line, sc};
    case '!':
      if (current()=='=') { advance(); return {TokenType::NEQ,   "!=", line, sc}; }
      break;
    case ';': return {TokenType::SEMICOLON, ";", line, sc};
    case ',': return {TokenType::COMMA,     ",", line, sc};
    case '(': return {TokenType::LPAREN,    "(", line, sc};
    case ')': return {TokenType::RPAREN,    ")", line, sc};
    case '{': return {TokenType::LBRACE,    "{", line, sc};
    case '}': return {TokenType::RBRACE,    "}", line, sc};
  }
  throw std::runtime_error(std::string("Unknown character: ") + c);
}

std::vector<Token> Lexer::tokenize() {
  std::vector<Token> out;
  while (pos < src.size()) {
    skipWhitespace();
    if (pos >= src.size()) break;
    char c = current();
    if      (std::isdigit(c))         out.push_back(readNumber());
    else if (c == '"')                out.push_back(readString());
    else if (std::isalpha(c)||c=='_') out.push_back(readWord());
    else                              out.push_back(readSymbol());
  }
  out.push_back({ TokenType::EOF_TOKEN, "", line, col });
  return out;
}`,
      },
    ],

    steps: [
      "Define token types as enum class",
      "Create Token struct (type + value + line/col)",
      "Skip whitespace and line comments",
      "Match digits → NUMBER token",
      "Match letters/_ → IDENTIFIER or KEYWORD",
      "Match symbols → OPERATOR tokens",
      "Handle multi-char operators (==, !=, <=, >=)",
      "Return EOF_TOKEN at end of input",
    ],
    tips: [
      "Check keywords AFTER matching identifiers",
      "Handle multi-char operators (==, !=, <=) carefully",
      "Track line/col for helpful error messages",
      "Use DFA/NFA internally for complex patterns",
    ],
  },

  workspaceFiles: [
    {
      name: "my_token.hpp",
      content: `#pragma once
#include <string>

// Step 1: Define your language's token types
enum class TokenType {
  // TODO: Add your token types
  NUMBER,
  IDENTIFIER,
  // Operators
  PLUS, MINUS,
  // Delimiters
  SEMICOLON,
  // Special — always keep this last
  EOF_TOKEN
};

struct Token {
  TokenType   type;
  std::string value;
  int         line, col;
};`,
    },
    {
      name: "my_lexer.hpp",
      content: `#pragma once
#include <string>
#include <vector>
#include "my_token.hpp"

class MyLexer {
public:
  explicit MyLexer(std::string source);
  std::vector<Token> tokenize();

private:
  std::string src;
  size_t pos   = 0;
  int    line  = 1, col = 1;

  char current() const;
  void advance();
  void skipWhitespace();

  // TODO: Add readNumber(), readWord(), readSymbol()
};`,
    },
    {
      name: "my_lexer.cpp",
      content: `#include "my_lexer.hpp"
#include <cctype>
#include <iostream>
using namespace std;

MyLexer::MyLexer(std::string s) : src(std::move(s)) {}

char MyLexer::current() const {
  return pos < src.size() ? src[pos] : 0;
}

void MyLexer::advance() {
  if (src[pos] == '\\n') { line++; col = 1; } else col++;
  pos++;
}

void MyLexer::skipWhitespace() {
  while (std::isspace(current())) advance();
}

// TODO: Implement readNumber()
// Token MyLexer::readNumber() { ... }

// TODO: Implement readWord() — handle keywords too
// Token MyLexer::readWord() { ... }

// TODO: Implement readSymbol() — handle operators
// Token MyLexer::readSymbol() { ... }

std::vector<Token> MyLexer::tokenize() {
  std::vector<Token> out;

  while (pos < src.size()) {
    skipWhitespace();
    if (pos >= src.size()) break;
    char c = current();

    // TODO: Dispatch to the right reader
    if (std::isdigit(c)) {
      // out.push_back(readNumber());
    } else {
      advance(); // skip unknown for now
    }
  }

  out.push_back({ TokenType::EOF_TOKEN, "", line, col });
  return out;
}

int main() {
  MyLexer lex("42 + x;");
  auto tokens = lex.tokenize();
  for (auto& t : tokens)
    cout << "[" << t.line << ":" << t.col << "] "
         << t.value << "\\n";
  return 0;
}`,
    },
  ],

  outputSample: `Tokenizing: "x = 42 + y * 2;"

[00] IDENTIFIER  → "x"    line 1, col  1
[01] ASSIGN      → "="    line 1, col  3
[02] NUMBER      → "42"   line 1, col  5
[03] PLUS        → "+"    line 1, col  8
[04] IDENTIFIER  → "y"    line 1, col 10
[05] STAR        → "*"    line 1, col 12
[06] NUMBER      → "2"    line 1, col 14
[07] SEMICOLON   → ";"    line 1, col 15
[08] EOF_TOKEN   → ""     line 1, col 16

✓  8 tokens produced (0 errors)`,

  template: `// MY LANGUAGE LEXER
#include <iostream>
#include <string>
#include <vector>
using namespace std;

enum class TokenType { NUMBER, IDENTIFIER, PLUS, MINUS, SEMICOLON, EOF_TOKEN };

struct Token { TokenType type; string value; };

class MyLexer {
  string src; int pos = 0;
public:
  MyLexer(string s) : src(s) {}
  Token next() {
    while (pos < src.size() && isspace(src[pos])) pos++;
    if (pos >= src.size()) return {TokenType::EOF_TOKEN, ""};
    char c = src[pos++];
    if (isdigit(c)) return {TokenType::NUMBER, string(1,c)};
    if (isalpha(c)) return {TokenType::IDENTIFIER, string(1,c)};
    return {TokenType::EOF_TOKEN, ""};
  }
};
int main() { MyLexer l("42 + x"); auto t = l.next(); cout << t.value; }`,
};

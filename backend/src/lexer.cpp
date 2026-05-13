#include "lexer.hpp"
#include <sstream>
#include <cctype>
#include <stdexcept>
#include <unordered_map>

// ── Keyword lookup table ───────────────────────────────────
static const std::unordered_map<std::string, TokenType> KEYWORDS = {
    // Data types
    {"int",              TokenType::KW_INT},
    {"float",            TokenType::KW_FLOAT},
    {"double",           TokenType::KW_DOUBLE},
    {"char",             TokenType::KW_CHAR},
    {"bool",             TokenType::KW_BOOL},
    {"void",             TokenType::KW_VOID},
    {"long",             TokenType::KW_LONG},
    {"short",            TokenType::KW_SHORT},
    {"unsigned",         TokenType::KW_UNSIGNED},
    {"signed",           TokenType::KW_SIGNED},
    {"auto",             TokenType::KW_AUTO},
    {"string",           TokenType::KW_STRING},

    // Control flow
    {"if",               TokenType::KW_IF},
    {"else",             TokenType::KW_ELSE},
    {"while",            TokenType::KW_WHILE},
    {"for",              TokenType::KW_FOR},
    {"do",               TokenType::KW_DO},
    {"switch",           TokenType::KW_SWITCH},
    {"case",             TokenType::KW_CASE},
    {"default",          TokenType::KW_DEFAULT},
    {"break",            TokenType::KW_BREAK},
    {"continue",         TokenType::KW_CONTINUE},
    {"return",           TokenType::KW_RETURN},
    {"goto",             TokenType::KW_GOTO},

    // Class / struct
    {"class",            TokenType::KW_CLASS},
    {"struct",           TokenType::KW_STRUCT},
    {"enum",             TokenType::KW_ENUM},
    {"union",            TokenType::KW_UNION},
    {"public",           TokenType::KW_PUBLIC},
    {"private",          TokenType::KW_PRIVATE},
    {"protected",        TokenType::KW_PROTECTED},
    {"virtual",          TokenType::KW_VIRTUAL},
    {"override",         TokenType::KW_OVERRIDE},
    {"final",            TokenType::KW_FINAL},
    {"friend",           TokenType::KW_FRIEND},
    {"this",             TokenType::KW_THIS},

    // Memory
    {"new",              TokenType::KW_NEW},
    {"delete",           TokenType::KW_DELETE},
    {"sizeof",           TokenType::KW_SIZEOF},
    {"nullptr",          TokenType::KW_NULLPTR},

    // Modifiers
    {"const",            TokenType::KW_CONST},
    {"static",           TokenType::KW_STATIC},
    {"inline",           TokenType::KW_INLINE},
    {"extern",           TokenType::KW_EXTERN},
    {"register",         TokenType::KW_REGISTER},
    {"volatile",         TokenType::KW_VOLATILE},
    {"explicit",         TokenType::KW_EXPLICIT},
    {"mutable",          TokenType::KW_MUTABLE},
    {"constexpr",        TokenType::KW_CONSTEXPR},
    {"consteval",        TokenType::KW_CONSTEVAL},
    {"constinit",        TokenType::KW_CONSTINIT},

    // Templates / namespaces
    {"template",         TokenType::KW_TEMPLATE},
    {"typename",         TokenType::KW_TYPENAME},
    {"namespace",        TokenType::KW_NAMESPACE},
    {"using",            TokenType::KW_USING},
    {"typedef",          TokenType::KW_TYPEDEF},

    // Exceptions
    {"try",              TokenType::KW_TRY},
    {"catch",            TokenType::KW_CATCH},
    {"throw",            TokenType::KW_THROW},
    {"noexcept",         TokenType::KW_NOEXCEPT},

    // Casts
    {"static_cast",      TokenType::KW_STATIC_CAST},
    {"dynamic_cast",     TokenType::KW_DYNAMIC_CAST},
    {"const_cast",       TokenType::KW_CONST_CAST},
    {"reinterpret_cast", TokenType::KW_REINTERPRET_CAST},

    // Bool literals
    {"true",             TokenType::BOOL_LITERAL},
    {"false",            TokenType::BOOL_LITERAL},
};

// ══════════════════════════════════════════════════════════
//  Constructor
// ══════════════════════════════════════════════════════════

Lexer::Lexer(const std::string& source)
    : source_(source), pos_(0), line_(1), col_(1) {}

// ══════════════════════════════════════════════════════════
//  Character navigation
// ══════════════════════════════════════════════════════════

char Lexer::current() const {
    if (isAtEnd()) return '\0';
    return source_[pos_];
}

char Lexer::peek() const {
    if (pos_ + 1 >= source_.size()) return '\0';
    return source_[pos_ + 1];
}

char Lexer::peekNext() const {
    if (pos_ + 2 >= source_.size()) return '\0';
    return source_[pos_ + 2];
}

char Lexer::advance() {
    char c = source_[pos_++];
    if (c == '\n') { line_++; col_ = 1; }
    else           { col_++; }
    return c;
}

bool Lexer::isAtEnd() const {
    return pos_ >= source_.size();
}

Token Lexer::makeToken(TokenType type, const std::string& value,
                       int line, int col) {
    return Token(type, value, line, col);
}

void Lexer::addError(const std::string& msg) {
    errors_.push_back({ msg, line_, col_ });
}

// ══════════════════════════════════════════════════════════
//  Skippers
// ══════════════════════════════════════════════════════════

void Lexer::skipWhitespace() {
    while (!isAtEnd() && std::isspace(current()))
        advance();
}

void Lexer::skipLineComment() {
    // consume everything until newline
    while (!isAtEnd() && current() != '\n')
        advance();
}

void Lexer::skipBlockComment() {
    advance(); advance(); // consume /*
    int depth = 1;        // support nested /* /* */ */

    while (!isAtEnd() && depth > 0) {
        if (current() == '/' && peek() == '*') {
            advance(); advance();
            depth++;
        } else if (current() == '*' && peek() == '/') {
            advance(); advance();
            depth--;
        } else {
            advance();
        }
    }

    if (depth > 0)
        addError("Unterminated block comment");
}

// ══════════════════════════════════════════════════════════
//  Number reader
//  Handles: 42  3.14  3.14f  0xFF  0b1010  1'000'000  1e10
// ══════════════════════════════════════════════════════════

Token Lexer::readNumber() {
    int startLine = line_, startCol = col_;
    std::string val;
    TokenType   type = TokenType::INTEGER_LITERAL;

    // Hex: 0x...
    if (current() == '0' && (peek() == 'x' || peek() == 'X')) {
        val += advance(); // 0
        val += advance(); // x
        while (!isAtEnd() && (std::isxdigit(current()) || current() == '\''))
            val += advance();
        return makeToken(type, val, startLine, startCol);
    }

    // Binary: 0b...
    if (current() == '0' && (peek() == 'b' || peek() == 'B')) {
        val += advance(); // 0
        val += advance(); // b
        while (!isAtEnd() && (current() == '0' || current() == '1'
                               || current() == '\''))
            val += advance();
        return makeToken(type, val, startLine, startCol);
    }

    // Decimal integer or float
    while (!isAtEnd() && (std::isdigit(current()) || current() == '\''))
        val += advance();

    // Fractional part
    if (!isAtEnd() && current() == '.' && std::isdigit(peek())) {
        type = TokenType::DOUBLE_LITERAL;
        val += advance(); // .
        while (!isAtEnd() && (std::isdigit(current()) || current() == '\''))
            val += advance();
    }

    // Exponent: e10 / E-5
    if (!isAtEnd() && (current() == 'e' || current() == 'E')) {
        type = TokenType::DOUBLE_LITERAL;
        val += advance();
        if (!isAtEnd() && (current() == '+' || current() == '-'))
            val += advance();
        while (!isAtEnd() && std::isdigit(current()))
            val += advance();
    }

    // Suffix: f/F → float,  l/L → long,  u/U → unsigned
    if (!isAtEnd()) {
        char s = current();
        if (s == 'f' || s == 'F') {
            type = TokenType::FLOAT_LITERAL;
            val += advance();
        } else if (s == 'l' || s == 'L') {
            val += advance();
            // ll / LL
            if (!isAtEnd() && (current() == 'l' || current() == 'L'))
                val += advance();
        } else if (s == 'u' || s == 'U') {
            val += advance();
            if (!isAtEnd() && (current() == 'l' || current() == 'L'))
                val += advance();
        }
    }

    return makeToken(type, val, startLine, startCol);
}

// ══════════════════════════════════════════════════════════
//  Char literal reader:  'a'  '\n'  '\x41'
// ══════════════════════════════════════════════════════════

Token Lexer::readChar() {
    int startLine = line_, startCol = col_;
    std::string val = "'";
    advance(); // consume opening '

    if (isAtEnd()) {
        addError("Unterminated character literal");
        return makeToken(TokenType::CHAR_LITERAL, val, startLine, startCol);
    }

    if (current() == '\\') {
        val += advance(); // backslash
        if (!isAtEnd()) val += advance(); // escape char
    } else {
        val += advance(); // normal char
    }

    if (!isAtEnd() && current() == '\'') {
        val += advance(); // closing '
    } else {
        addError("Unterminated character literal");
    }

    return makeToken(TokenType::CHAR_LITERAL, val, startLine, startCol);
}

// ══════════════════════════════════════════════════════════
//  String literal reader:  "hello\nworld"
// ══════════════════════════════════════════════════════════

Token Lexer::readString() {
    int startLine = line_, startCol = col_;
    std::string val = "\"";
    advance(); // consume opening "

    while (!isAtEnd() && current() != '"') {
        if (current() == '\n') {
            addError("Unterminated string literal");
            break;
        }
        if (current() == '\\') {
            val += advance(); // backslash
            if (!isAtEnd()) val += advance(); // escape char
        } else {
            val += advance();
        }
    }

    if (!isAtEnd() && current() == '"') {
        val += advance(); // closing "
    } else if (isAtEnd()) {
        addError("Unterminated string literal");
    }

    return makeToken(TokenType::STRING_LITERAL, val, startLine, startCol);
}

// ══════════════════════════════════════════════════════════
//  Raw string literal:  R"(hello "world")"
// ══════════════════════════════════════════════════════════

Token Lexer::readRawString() {
    int startLine = line_, startCol = col_;
    std::string val = "R\"";
    advance(); advance(); // consume R"

    // Read optional delimiter
    std::string delim = ")";
    while (!isAtEnd() && current() != '(') {
        delim = std::string(1, current()) + ")";
        val  += advance();
    }
    if (!isAtEnd()) val += advance(); // consume (

    // Read until )"delimiter"
    std::string closing = ")" + delim.substr(1) + "\"";
    while (!isAtEnd()) {
        if (source_.substr(pos_, closing.size()) == closing) {
            for (size_t i = 0; i < closing.size(); i++)
                val += advance();
            break;
        }
        val += advance();
    }

    return makeToken(TokenType::STRING_LITERAL, val, startLine, startCol);
}

// ══════════════════════════════════════════════════════════
//  Identifier / keyword reader
// ══════════════════════════════════════════════════════════

Token Lexer::readIdentOrKeyword() {
    int startLine = line_, startCol = col_;
    std::string val;

    while (!isAtEnd() && (std::isalnum(current()) || current() == '_'))
        val += advance();

    // Keyword lookup
    auto it = KEYWORDS.find(val);
    if (it != KEYWORDS.end())
        return makeToken(it->second, val, startLine, startCol);

    return makeToken(TokenType::IDENTIFIER, val, startLine, startCol);
}

// ══════════════════════════════════════════════════════════
//  Preprocessor directive reader:  #include  #define  etc.
// ══════════════════════════════════════════════════════════

Token Lexer::readPreprocessor() {
    int startLine = line_, startCol = col_;
    advance(); // consume #

    // Skip spaces after #
    while (!isAtEnd() && current() == ' ')
        advance();

    std::string directive;
    while (!isAtEnd() && std::isalpha(current()))
        directive += advance();

    TokenType type = TokenType::HASH;
    if      (directive == "include") type = TokenType::KW_INCLUDE;
    else if (directive == "define")  type = TokenType::KW_DEFINE;
    else if (directive == "ifdef")   type = TokenType::KW_IFDEF;
    else if (directive == "ifndef")  type = TokenType::KW_IFNDEF;
    else if (directive == "endif")   type = TokenType::KW_ENDIF;
    else if (directive == "pragma")  type = TokenType::KW_PRAGMA;

    // Read rest of line as value
    std::string rest;
    while (!isAtEnd() && current() != '\n')
        rest += advance();

    return makeToken(type, "#" + directive + rest, startLine, startCol);
}

// ══════════════════════════════════════════════════════════
//  Operator readers (multi-char disambiguation)
// ══════════════════════════════════════════════════════════

Token Lexer::readPlus() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '+') { advance(); return makeToken(TokenType::OP_INC,          "++", l, c); }
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_PLUS_ASSIGN,  "+=", l, c); }
    return makeToken(TokenType::OP_PLUS, "+", l, c);
}

Token Lexer::readMinus() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '-') { advance(); return makeToken(TokenType::OP_DEC,          "--",  l, c); }
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_MINUS_ASSIGN, "-=",  l, c); }
    if (!isAtEnd() && current() == '>') {
        advance();
        if (!isAtEnd() && current() == '*') { advance(); return makeToken(TokenType::OP_ARROW_STAR, "->*", l, c); }
        return makeToken(TokenType::OP_ARROW, "->", l, c);
    }
    return makeToken(TokenType::OP_MINUS, "-", l, c);
}

Token Lexer::readStar() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_STAR_ASSIGN, "*=", l, c); }
    return makeToken(TokenType::OP_STAR, "*", l, c);
}

Token Lexer::readSlash() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_SLASH_ASSIGN, "/=", l, c); }
    return makeToken(TokenType::OP_SLASH, "/", l, c);
}

Token Lexer::readPercent() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_PERCENT_ASSIGN, "%=", l, c); }
    return makeToken(TokenType::OP_PERCENT, "%", l, c);
}

Token Lexer::readEqual() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_EQ,     "==", l, c); }
    return makeToken(TokenType::OP_ASSIGN, "=", l, c);
}

Token Lexer::readBang() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_NEQ,          "!=", l, c); }
    return makeToken(TokenType::OP_LOGICAL_NOT, "!", l, c);
}

Token Lexer::readLess() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '<') {
        advance();
        if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_LSHIFT_ASSIGN, "<<=", l, c); }
        return makeToken(TokenType::OP_LSHIFT, "<<", l, c);
    }
    if (!isAtEnd() && current() == '=') {
        advance();
        if (!isAtEnd() && current() == '>') { advance(); return makeToken(TokenType::OP_SPACESHIP, "<=>", l, c); }
        return makeToken(TokenType::OP_LTE, "<=", l, c);
    }
    return makeToken(TokenType::OP_LT, "<", l, c);
}

Token Lexer::readGreater() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '>') {
        advance();
        if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_RSHIFT_ASSIGN, ">>=", l, c); }
        return makeToken(TokenType::OP_RSHIFT, ">>", l, c);
    }
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_GTE, ">=", l, c); }
    return makeToken(TokenType::OP_GT, ">", l, c);
}

Token Lexer::readAmpersand() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '&') { advance(); return makeToken(TokenType::OP_LOGICAL_AND, "&&", l, c); }
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_AND_ASSIGN,  "&=", l, c); }
    return makeToken(TokenType::OP_BIT_AND, "&", l, c);
}

Token Lexer::readPipe() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '|') { advance(); return makeToken(TokenType::OP_LOGICAL_OR, "||", l, c); }
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_OR_ASSIGN,  "|=", l, c); }
    return makeToken(TokenType::OP_BIT_OR, "|", l, c);
}

Token Lexer::readCaret() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == '=') { advance(); return makeToken(TokenType::OP_XOR_ASSIGN, "^=", l, c); }
    return makeToken(TokenType::OP_BIT_XOR, "^", l, c);
}

Token Lexer::readDot() {
    int l = line_, c = col_; advance();
    // Ellipsis: ...
    if (!isAtEnd() && current() == '.' && peek() == '.') {
        advance(); advance();
        return makeToken(TokenType::OP_ELLIPSIS, "...", l, c);
    }
    // Dot-star: .*
    if (!isAtEnd() && current() == '*') {
        advance();
        return makeToken(TokenType::OP_DOT_STAR, ".*", l, c);
    }
    // Float starting with dot: .5
    if (!isAtEnd() && std::isdigit(current())) {
        std::string val = ".";
        while (!isAtEnd() && std::isdigit(current()))
            val += advance();
        return makeToken(TokenType::DOUBLE_LITERAL, val, l, c);
    }
    return makeToken(TokenType::OP_DOT, ".", l, c);
}

Token Lexer::readColon() {
    int l = line_, c = col_; advance();
    if (!isAtEnd() && current() == ':') { advance(); return makeToken(TokenType::OP_SCOPE, "::", l, c); }
    return makeToken(TokenType::OP_COLON, ":", l, c);
}

// ══════════════════════════════════════════════════════════
//  JSON escape helper
// ══════════════════════════════════════════════════════════

std::string Lexer::escapeString(const std::string& s) const {
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

// ══════════════════════════════════════════════════════════
//  Main tokenize loop
// ══════════════════════════════════════════════════════════

std::vector<Token> Lexer::tokenize() {
    tokens_.clear();
    errors_.clear();

    while (!isAtEnd()) {

        // Skip whitespace
        skipWhitespace();
        if (isAtEnd()) break;

        char c = current();

        // ── Comments ──────────────────────────────────────
        if (c == '/' && peek() == '/') { skipLineComment();  continue; }
        if (c == '/' && peek() == '*') { skipBlockComment(); continue; }

        // ── Preprocessor directives ───────────────────────
        if (c == '#') { tokens_.push_back(readPreprocessor()); continue; }

        // ── Numbers ───────────────────────────────────────
        if (std::isdigit(c)) { tokens_.push_back(readNumber()); continue; }

        // ── Char literals ─────────────────────────────────
        if (c == '\'') { tokens_.push_back(readChar()); continue; }

        // ── String literals ───────────────────────────────
        if (c == '"') { tokens_.push_back(readString()); continue; }

        // ── Raw string: R"(...)" ──────────────────────────
        if (c == 'R' && peek() == '"') {
            tokens_.push_back(readRawString()); continue;
        }

        // ── Identifiers / keywords ────────────────────────
        if (std::isalpha(c) || c == '_') {
            tokens_.push_back(readIdentOrKeyword()); continue;
        }

        // ── Operators & delimiters ────────────────────────
        switch (c) {
            case '+': tokens_.push_back(readPlus());      break;
            case '-': tokens_.push_back(readMinus());     break;
            case '*': tokens_.push_back(readStar());      break;
            case '/': tokens_.push_back(readSlash());     break;
            case '%': tokens_.push_back(readPercent());   break;
            case '=': tokens_.push_back(readEqual());     break;
            case '!': tokens_.push_back(readBang());      break;
            case '<': tokens_.push_back(readLess());      break;
            case '>': tokens_.push_back(readGreater());   break;
            case '&': tokens_.push_back(readAmpersand()); break;
            case '|': tokens_.push_back(readPipe());      break;
            case '^': tokens_.push_back(readCaret());     break;
            case '.': tokens_.push_back(readDot());       break;
            case ':': tokens_.push_back(readColon());     break;
            case '~': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::OP_BIT_NOT,  "~",  l, cl)); break; }
            case '?': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::OP_TERNARY,  "?",  l, cl)); break; }
            case '(': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::LPAREN,      "(",  l, cl)); break; }
            case ')': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::RPAREN,      ")",  l, cl)); break; }
            case '{': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::LBRACE,      "{",  l, cl)); break; }
            case '}': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::RBRACE,      "}",  l, cl)); break; }
            case '[': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::LBRACKET,    "[",  l, cl)); break; }
            case ']': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::RBRACKET,    "]",  l, cl)); break; }
            case ';': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::SEMICOLON,   ";",  l, cl)); break; }
            case ',': { int l=line_,cl=col_; advance(); tokens_.push_back(makeToken(TokenType::COMMA,       ",",  l, cl)); break; }
            default: {
                int l=line_, cl=col_;
                std::string unknown(1, advance());
                addError("Unexpected character '" + unknown + "'");
                tokens_.push_back(makeToken(TokenType::UNKNOWN, unknown, l, cl));
            }
        }
    }

    tokens_.push_back(makeToken(TokenType::EOF_TOKEN, "", line_, col_));
    return tokens_;
}

// ══════════════════════════════════════════════════════════
//  JSON output
// ══════════════════════════════════════════════════════════

std::string Lexer::toJSON() const {
    std::ostringstream out;
    out << "{\n  \"tokens\": [\n";

    for (size_t i = 0; i < tokens_.size(); i++) {
        const auto& t = tokens_[i];
        out << "    {"
            << "\"type\": \""     << escapeString(tokenTypeName(t.type))  << "\", "
            << "\"category\": \"" << escapeString(t.category)             << "\", "
            << "\"value\": \""    << escapeString(t.value)                << "\", "
            << "\"line\": "       << t.line                               << ", "
            << "\"col\": "        << t.col
            << "}";
        if (i + 1 < tokens_.size()) out << ",";
        out << "\n";
    }

    out << "  ],\n  \"lexer_errors\": [\n";

    for (size_t i = 0; i < errors_.size(); i++) {
        const auto& e = errors_[i];
        out << "    {"
            << "\"message\": \"" << escapeString(e.message) << "\", "
            << "\"line\": "      << e.line                  << ", "
            << "\"col\": "       << e.col
            << "}";
        if (i + 1 < errors_.size()) out << ",";
        out << "\n";
    }

    out << "  ],\n"
        << "  \"token_count\": " << (tokens_.size() > 0 ? tokens_.size() - 1 : 0) << "\n"
        << "}";

    return out.str();
}
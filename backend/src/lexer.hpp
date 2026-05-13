#pragma once
#include "token.hpp"
#include <string>
#include <vector>

// ── Lexer error struct ─────────────────────────────────────
struct LexerError {
    std::string message;
    int         line;
    int         col;
};

// ── Lexer class ────────────────────────────────────────────
class Lexer {
public:
    explicit Lexer(const std::string& source);

    // Main function — call this to get all tokens
    std::vector<Token>      tokenize();

    // Get errors encountered during tokenization
    std::vector<LexerError> errors() const { return errors_; }

    // Output full result as JSON (sent to Flask → React)
    std::string             toJSON() const;

private:
    std::string             source_;
    size_t                  pos_;
    int                     line_;
    int                     col_;
    std::vector<Token>      tokens_;
    std::vector<LexerError> errors_;

    // ── Character navigation ───────────────────────────────
    char    current()       const;
    char    peek()          const;
    char    peekNext()      const;
    char    advance();
    bool    isAtEnd()       const;

    // ── Skippers ──────────────────────────────────────────
    void    skipWhitespace();
    void    skipLineComment();
    void    skipBlockComment();

    // ── Readers ───────────────────────────────────────────
    Token   readNumber();
    Token   readChar();
    Token   readString();
    Token   readRawString();
    Token   readIdentOrKeyword();
    Token   readPreprocessor();

    // ── Operator readers ──────────────────────────────────
    Token   readPlus();
    Token   readMinus();
    Token   readStar();
    Token   readSlash();
    Token   readPercent();
    Token   readEqual();
    Token   readBang();
    Token   readLess();
    Token   readGreater();
    Token   readAmpersand();
    Token   readPipe();
    Token   readCaret();
    Token   readDot();
    Token   readColon();

    // ── Helpers ───────────────────────────────────────────
    bool        isKeyword(const std::string& word, TokenType& out);
    std::string escapeString(const std::string& s) const ;
    void        addError(const std::string& msg);

    // Make token at current position
    Token makeToken(TokenType type, const std::string& value,
                    int line, int col);
};
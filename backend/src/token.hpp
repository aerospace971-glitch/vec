#pragma once
#include <string>

enum class TokenType {

    // ── Literals ──────────────────────────────────────────
    INTEGER_LITERAL,        // 42
    FLOAT_LITERAL,          // 3.14
    DOUBLE_LITERAL,         // 3.14 (default)
    CHAR_LITERAL,           // 'a'
    STRING_LITERAL,         // "hello"
    BOOL_LITERAL,           // true / false
    NULLPTR_LITERAL,        // nullptr

    // ── Identifiers ───────────────────────────────────────
    IDENTIFIER,             // variable names, function names

    // ── Data type keywords ────────────────────────────────
    KW_INT,                 // int
    KW_FLOAT,               // float
    KW_DOUBLE,              // double
    KW_CHAR,                // char
    KW_BOOL,                // bool
    KW_VOID,                // void
    KW_LONG,                // long
    KW_SHORT,               // short
    KW_UNSIGNED,            // unsigned
    KW_SIGNED,              // signed
    KW_AUTO,                // auto
    KW_STRING,              // string (std::string)

    // ── Control flow keywords ─────────────────────────────
    KW_IF,                  // if
    KW_ELSE,                // else
    KW_WHILE,               // while
    KW_FOR,                 // for
    KW_DO,                  // do
    KW_SWITCH,              // switch
    KW_CASE,                // case
    KW_DEFAULT,             // default
    KW_BREAK,               // break
    KW_CONTINUE,            // continue
    KW_RETURN,              // return
    KW_GOTO,                // goto

    // ── Class / struct keywords ───────────────────────────
    KW_CLASS,               // class
    KW_STRUCT,              // struct
    KW_ENUM,                // enum
    KW_UNION,               // union
    KW_PUBLIC,              // public
    KW_PRIVATE,             // private
    KW_PROTECTED,           // protected
    KW_VIRTUAL,             // virtual
    KW_OVERRIDE,            // override
    KW_FINAL,               // final
    KW_ABSTRACT,            // abstract
    KW_FRIEND,              // friend
    KW_THIS,                // this
    KW_OPERATOR,            // operator

    // ── Memory keywords ───────────────────────────────────
    KW_NEW,                 // new
    KW_DELETE,              // delete
    KW_SIZEOF,              // sizeof
    KW_TYPEOF,              // typeof
    KW_NULLPTR,             // nullptr

    // ── Modifier keywords ─────────────────────────────────
    KW_CONST,               // const
    KW_STATIC,              // static
    KW_INLINE,              // inline
    KW_EXTERN,              // extern
    KW_REGISTER,            // register
    KW_VOLATILE,            // volatile
    KW_EXPLICIT,            // explicit
    KW_MUTABLE,             // mutable
    KW_CONSTEXPR,           // constexpr
    KW_CONSTEVAL,           // consteval  (C++20)
    KW_CONSTINIT,           // constinit  (C++20)

    // ── Template keywords ─────────────────────────────────
    KW_TEMPLATE,            // template
    KW_TYPENAME,            // typename
    KW_NAMESPACE,           // namespace
    KW_USING,               // using
    KW_TYPEDEF,             // typedef

    // ── Exception keywords ────────────────────────────────
    KW_TRY,                 // try
    KW_CATCH,               // catch
    KW_THROW,               // throw
    KW_NOEXCEPT,            // noexcept

    // ── Cast keywords ─────────────────────────────────────
    KW_STATIC_CAST,         // static_cast
    KW_DYNAMIC_CAST,        // dynamic_cast
    KW_CONST_CAST,          // const_cast
    KW_REINTERPRET_CAST,    // reinterpret_cast

    // ── I/O keywords ──────────────────────────────────────
    KW_INCLUDE,             // #include  (preprocessor)
    KW_DEFINE,              // #define
    KW_IFDEF,               // #ifdef
    KW_IFNDEF,              // #ifndef
    KW_ENDIF,               // #endif
    KW_PRAGMA,              // #pragma

    // ── Operators: Arithmetic ─────────────────────────────
    OP_PLUS,                // +
    OP_MINUS,               // -
    OP_STAR,                // *
    OP_SLASH,               // /
    OP_PERCENT,             // %

    // ── Operators: Assignment ─────────────────────────────
    OP_ASSIGN,              // =
    OP_PLUS_ASSIGN,         // +=
    OP_MINUS_ASSIGN,        // -=
    OP_STAR_ASSIGN,         // *=
    OP_SLASH_ASSIGN,        // /=
    OP_PERCENT_ASSIGN,      // %=
    OP_AND_ASSIGN,          // &=
    OP_OR_ASSIGN,           // |=
    OP_XOR_ASSIGN,          // ^=
    OP_LSHIFT_ASSIGN,       // <<=
    OP_RSHIFT_ASSIGN,       // >>=

    // ── Operators: Comparison ─────────────────────────────
    OP_EQ,                  // ==
    OP_NEQ,                 // !=
    OP_LT,                  // 
    OP_GT,                  // >
    OP_LTE,                 // <=
    OP_GTE,                 // >=
    OP_SPACESHIP,           // <=> (C++20 three-way comparison)

    // ── Operators: Logical ────────────────────────────────
    OP_LOGICAL_AND,         // &&
    OP_LOGICAL_OR,          // ||
    OP_LOGICAL_NOT,         // !

    // ── Operators: Bitwise ────────────────────────────────
    OP_BIT_AND,             // &
    OP_BIT_OR,              // |
    OP_BIT_XOR,             // ^
    OP_BIT_NOT,             // ~
    OP_LSHIFT,              // 
    OP_RSHIFT,              // >>

    // ── Operators: Increment / Decrement ──────────────────
    OP_INC,                 // ++
    OP_DEC,                 // --

    // ── Operators: Member access ──────────────────────────
    OP_DOT,                 // .
    OP_ARROW,               // ->
    OP_DOT_STAR,            // .*
    OP_ARROW_STAR,          // ->*
    OP_SCOPE,               // ::

    // ── Operators: Misc ───────────────────────────────────
    OP_TERNARY,             // ?
    OP_COLON,               // :
    OP_ELLIPSIS,            // ...

    // ── Delimiters ────────────────────────────────────────
    LPAREN,                 // (
    RPAREN,                 // )
    LBRACE,                 // {
    RBRACE,                 // }
    LBRACKET,               // [
    RBRACKET,               // ]
    SEMICOLON,              // ;
    COMMA,                  // ,
    HASH,                   // #

    // ── Special ───────────────────────────────────────────
    EOF_TOKEN,              // end of file
    UNKNOWN,                // unrecognized character
    NEWLINE,                // \n  (for preprocessor)
};

// ── Token type → readable string ──────────────────────────
inline std::string tokenTypeName(TokenType t) {
    switch (t) {
        // Literals
        case TokenType::INTEGER_LITERAL:     return "INTEGER";
        case TokenType::FLOAT_LITERAL:       return "FLOAT";
        case TokenType::DOUBLE_LITERAL:      return "DOUBLE";
        case TokenType::CHAR_LITERAL:        return "CHAR";
        case TokenType::STRING_LITERAL:      return "STRING";
        case TokenType::BOOL_LITERAL:        return "BOOL";
        case TokenType::NULLPTR_LITERAL:     return "NULLPTR";

        // Identifiers
        case TokenType::IDENTIFIER:          return "IDENTIFIER";

        // Type keywords
        case TokenType::KW_INT:              return "KW_INT";
        case TokenType::KW_FLOAT:            return "KW_FLOAT";
        case TokenType::KW_DOUBLE:           return "KW_DOUBLE";
        case TokenType::KW_CHAR:             return "KW_CHAR";
        case TokenType::KW_BOOL:             return "KW_BOOL";
        case TokenType::KW_VOID:             return "KW_VOID";
        case TokenType::KW_LONG:             return "KW_LONG";
        case TokenType::KW_SHORT:            return "KW_SHORT";
        case TokenType::KW_UNSIGNED:         return "KW_UNSIGNED";
        case TokenType::KW_SIGNED:           return "KW_SIGNED";
        case TokenType::KW_AUTO:             return "KW_AUTO";
        case TokenType::KW_STRING:           return "KW_STRING";

        // Control flow
        case TokenType::KW_IF:               return "KW_IF";
        case TokenType::KW_ELSE:             return "KW_ELSE";
        case TokenType::KW_WHILE:            return "KW_WHILE";
        case TokenType::KW_FOR:              return "KW_FOR";
        case TokenType::KW_DO:               return "KW_DO";
        case TokenType::KW_SWITCH:           return "KW_SWITCH";
        case TokenType::KW_CASE:             return "KW_CASE";
        case TokenType::KW_DEFAULT:          return "KW_DEFAULT";
        case TokenType::KW_BREAK:            return "KW_BREAK";
        case TokenType::KW_CONTINUE:         return "KW_CONTINUE";
        case TokenType::KW_RETURN:           return "KW_RETURN";
        case TokenType::KW_GOTO:             return "KW_GOTO";

        // Class / struct
        case TokenType::KW_CLASS:            return "KW_CLASS";
        case TokenType::KW_STRUCT:           return "KW_STRUCT";
        case TokenType::KW_ENUM:             return "KW_ENUM";
        case TokenType::KW_UNION:            return "KW_UNION";
        case TokenType::KW_PUBLIC:           return "KW_PUBLIC";
        case TokenType::KW_PRIVATE:          return "KW_PRIVATE";
        case TokenType::KW_PROTECTED:        return "KW_PROTECTED";
        case TokenType::KW_VIRTUAL:          return "KW_VIRTUAL";
        case TokenType::KW_OVERRIDE:         return "KW_OVERRIDE";
        case TokenType::KW_FINAL:            return "KW_FINAL";
        case TokenType::KW_FRIEND:           return "KW_FRIEND";
        case TokenType::KW_THIS:             return "KW_THIS";
        case TokenType::KW_OPERATOR:         return "KW_OPERATOR";

        // Memory
        case TokenType::KW_NEW:              return "KW_NEW";
        case TokenType::KW_DELETE:           return "KW_DELETE";
        case TokenType::KW_SIZEOF:           return "KW_SIZEOF";
        case TokenType::KW_NULLPTR:          return "KW_NULLPTR";

        // Modifiers
        case TokenType::KW_CONST:            return "KW_CONST";
        case TokenType::KW_STATIC:           return "KW_STATIC";
        case TokenType::KW_INLINE:           return "KW_INLINE";
        case TokenType::KW_EXTERN:           return "KW_EXTERN";
        case TokenType::KW_VOLATILE:         return "KW_VOLATILE";
        case TokenType::KW_EXPLICIT:         return "KW_EXPLICIT";
        case TokenType::KW_MUTABLE:          return "KW_MUTABLE";
        case TokenType::KW_CONSTEXPR:        return "KW_CONSTEXPR";
        case TokenType::KW_CONSTEVAL:        return "KW_CONSTEVAL";
        case TokenType::KW_CONSTINIT:        return "KW_CONSTINIT";

        // Templates / namespaces
        case TokenType::KW_TEMPLATE:         return "KW_TEMPLATE";
        case TokenType::KW_TYPENAME:         return "KW_TYPENAME";
        case TokenType::KW_NAMESPACE:        return "KW_NAMESPACE";
        case TokenType::KW_USING:            return "KW_USING";
        case TokenType::KW_TYPEDEF:          return "KW_TYPEDEF";

        // Exceptions
        case TokenType::KW_TRY:              return "KW_TRY";
        case TokenType::KW_CATCH:            return "KW_CATCH";
        case TokenType::KW_THROW:            return "KW_THROW";
        case TokenType::KW_NOEXCEPT:         return "KW_NOEXCEPT";

        // Casts
        case TokenType::KW_STATIC_CAST:      return "KW_STATIC_CAST";
        case TokenType::KW_DYNAMIC_CAST:     return "KW_DYNAMIC_CAST";
        case TokenType::KW_CONST_CAST:       return "KW_CONST_CAST";
        case TokenType::KW_REINTERPRET_CAST: return "KW_REINTERPRET_CAST";

        // Preprocessor
        case TokenType::KW_INCLUDE:          return "KW_INCLUDE";
        case TokenType::KW_DEFINE:           return "KW_DEFINE";
        case TokenType::KW_IFDEF:            return "KW_IFDEF";
        case TokenType::KW_IFNDEF:           return "KW_IFNDEF";
        case TokenType::KW_ENDIF:            return "KW_ENDIF";
        case TokenType::KW_PRAGMA:           return "KW_PRAGMA";

        // Arithmetic operators
        case TokenType::OP_PLUS:             return "OP_PLUS";
        case TokenType::OP_MINUS:            return "OP_MINUS";
        case TokenType::OP_STAR:             return "OP_STAR";
        case TokenType::OP_SLASH:            return "OP_SLASH";
        case TokenType::OP_PERCENT:          return "OP_PERCENT";

        // Assignment operators
        case TokenType::OP_ASSIGN:           return "OP_ASSIGN";
        case TokenType::OP_PLUS_ASSIGN:      return "OP_PLUS_ASSIGN";
        case TokenType::OP_MINUS_ASSIGN:     return "OP_MINUS_ASSIGN";
        case TokenType::OP_STAR_ASSIGN:      return "OP_STAR_ASSIGN";
        case TokenType::OP_SLASH_ASSIGN:     return "OP_SLASH_ASSIGN";
        case TokenType::OP_PERCENT_ASSIGN:   return "OP_PERCENT_ASSIGN";
        case TokenType::OP_AND_ASSIGN:       return "OP_AND_ASSIGN";
        case TokenType::OP_OR_ASSIGN:        return "OP_OR_ASSIGN";
        case TokenType::OP_XOR_ASSIGN:       return "OP_XOR_ASSIGN";
        case TokenType::OP_LSHIFT_ASSIGN:    return "OP_LSHIFT_ASSIGN";
        case TokenType::OP_RSHIFT_ASSIGN:    return "OP_RSHIFT_ASSIGN";

        // Comparison operators
        case TokenType::OP_EQ:               return "OP_EQ";
        case TokenType::OP_NEQ:              return "OP_NEQ";
        case TokenType::OP_LT:               return "OP_LT";
        case TokenType::OP_GT:               return "OP_GT";
        case TokenType::OP_LTE:              return "OP_LTE";
        case TokenType::OP_GTE:              return "OP_GTE";
        case TokenType::OP_SPACESHIP:        return "OP_SPACESHIP";

        // Logical operators
        case TokenType::OP_LOGICAL_AND:      return "OP_LOGICAL_AND";
        case TokenType::OP_LOGICAL_OR:       return "OP_LOGICAL_OR";
        case TokenType::OP_LOGICAL_NOT:      return "OP_LOGICAL_NOT";

        // Bitwise operators
        case TokenType::OP_BIT_AND:          return "OP_BIT_AND";
        case TokenType::OP_BIT_OR:           return "OP_BIT_OR";
        case TokenType::OP_BIT_XOR:          return "OP_BIT_XOR";
        case TokenType::OP_BIT_NOT:          return "OP_BIT_NOT";
        case TokenType::OP_LSHIFT:           return "OP_LSHIFT";
        case TokenType::OP_RSHIFT:           return "OP_RSHIFT";

        // Increment / Decrement
        case TokenType::OP_INC:              return "OP_INC";
        case TokenType::OP_DEC:              return "OP_DEC";

        // Member access
        case TokenType::OP_DOT:              return "OP_DOT";
        case TokenType::OP_ARROW:            return "OP_ARROW";
        case TokenType::OP_DOT_STAR:         return "OP_DOT_STAR";
        case TokenType::OP_ARROW_STAR:       return "OP_ARROW_STAR";
        case TokenType::OP_SCOPE:            return "OP_SCOPE";

        // Misc operators
        case TokenType::OP_TERNARY:          return "OP_TERNARY";
        case TokenType::OP_COLON:            return "OP_COLON";
        case TokenType::OP_ELLIPSIS:         return "OP_ELLIPSIS";

        // Delimiters
        case TokenType::LPAREN:              return "LPAREN";
        case TokenType::RPAREN:              return "RPAREN";
        case TokenType::LBRACE:              return "LBRACE";
        case TokenType::RBRACE:              return "RBRACE";
        case TokenType::LBRACKET:            return "LBRACKET";
        case TokenType::RBRACKET:            return "RBRACKET";
        case TokenType::SEMICOLON:           return "SEMICOLON";
        case TokenType::COMMA:               return "COMMA";
        case TokenType::HASH:                return "HASH";
        case TokenType::NEWLINE:             return "NEWLINE";

        // Special
        case TokenType::EOF_TOKEN:           return "EOF";
        default:                             return "UNKNOWN";
    }
}

// ── Token category (for UI color coding) ──────────────────
inline std::string tokenCategory(TokenType t) {
    switch (t) {
        case TokenType::INTEGER_LITERAL:
        case TokenType::FLOAT_LITERAL:
        case TokenType::DOUBLE_LITERAL:
        case TokenType::CHAR_LITERAL:
        case TokenType::STRING_LITERAL:
        case TokenType::BOOL_LITERAL:
        case TokenType::NULLPTR_LITERAL:     return "LITERAL";

        case TokenType::IDENTIFIER:          return "IDENTIFIER";

        case TokenType::KW_INT:    case TokenType::KW_FLOAT:
        case TokenType::KW_DOUBLE: case TokenType::KW_CHAR:
        case TokenType::KW_BOOL:   case TokenType::KW_VOID:
        case TokenType::KW_LONG:   case TokenType::KW_SHORT:
        case TokenType::KW_UNSIGNED: case TokenType::KW_SIGNED:
        case TokenType::KW_AUTO:   case TokenType::KW_STRING:  return "TYPE";

        case TokenType::KW_IF:     case TokenType::KW_ELSE:
        case TokenType::KW_WHILE:  case TokenType::KW_FOR:
        case TokenType::KW_DO:     case TokenType::KW_SWITCH:
        case TokenType::KW_CASE:   case TokenType::KW_DEFAULT:
        case TokenType::KW_BREAK:  case TokenType::KW_CONTINUE:
        case TokenType::KW_RETURN: case TokenType::KW_GOTO:    return "CONTROL";

        case TokenType::KW_CLASS:  case TokenType::KW_STRUCT:
        case TokenType::KW_ENUM:   case TokenType::KW_UNION:
        case TokenType::KW_PUBLIC: case TokenType::KW_PRIVATE:
        case TokenType::KW_PROTECTED: case TokenType::KW_VIRTUAL:
        case TokenType::KW_OVERRIDE: case TokenType::KW_FRIEND:
        case TokenType::KW_THIS:   case TokenType::KW_OPERATOR: return "OOP";

        case TokenType::KW_NEW:    case TokenType::KW_DELETE:
        case TokenType::KW_SIZEOF: case TokenType::KW_NULLPTR: return "MEMORY";

        case TokenType::KW_CONST:  case TokenType::KW_STATIC:
        case TokenType::KW_INLINE: case TokenType::KW_EXTERN:
        case TokenType::KW_VOLATILE: case TokenType::KW_CONSTEXPR:
        case TokenType::KW_MUTABLE: case TokenType::KW_EXPLICIT: return "MODIFIER";

        case TokenType::KW_TEMPLATE: case TokenType::KW_TYPENAME:
        case TokenType::KW_NAMESPACE: case TokenType::KW_USING:
        case TokenType::KW_TYPEDEF:                            return "TEMPLATE";

        case TokenType::KW_TRY:    case TokenType::KW_CATCH:
        case TokenType::KW_THROW:  case TokenType::KW_NOEXCEPT: return "EXCEPTION";

        case TokenType::KW_INCLUDE: case TokenType::KW_DEFINE:
        case TokenType::KW_IFDEF:   case TokenType::KW_IFNDEF:
        case TokenType::KW_ENDIF:   case TokenType::KW_PRAGMA:
        case TokenType::HASH:                                  return "PREPROCESSOR";

        case TokenType::OP_PLUS:   case TokenType::OP_MINUS:
        case TokenType::OP_STAR:   case TokenType::OP_SLASH:
        case TokenType::OP_PERCENT:                            return "ARITHMETIC";

        case TokenType::OP_ASSIGN:
        case TokenType::OP_PLUS_ASSIGN: case TokenType::OP_MINUS_ASSIGN:
        case TokenType::OP_STAR_ASSIGN: case TokenType::OP_SLASH_ASSIGN:
        case TokenType::OP_PERCENT_ASSIGN:                     return "ASSIGNMENT";

        case TokenType::OP_EQ:     case TokenType::OP_NEQ:
        case TokenType::OP_LT:     case TokenType::OP_GT:
        case TokenType::OP_LTE:    case TokenType::OP_GTE:
        case TokenType::OP_SPACESHIP:                          return "COMPARISON";

        case TokenType::OP_LOGICAL_AND: case TokenType::OP_LOGICAL_OR:
        case TokenType::OP_LOGICAL_NOT:                        return "LOGICAL";

        case TokenType::OP_BIT_AND: case TokenType::OP_BIT_OR:
        case TokenType::OP_BIT_XOR: case TokenType::OP_BIT_NOT:
        case TokenType::OP_LSHIFT:  case TokenType::OP_RSHIFT: return "BITWISE";

        case TokenType::OP_INC:    case TokenType::OP_DEC:    return "INCDEC";

        case TokenType::OP_DOT:    case TokenType::OP_ARROW:
        case TokenType::OP_SCOPE:                              return "MEMBER";

        case TokenType::LPAREN:    case TokenType::RPAREN:
        case TokenType::LBRACE:    case TokenType::RBRACE:
        case TokenType::LBRACKET:  case TokenType::RBRACKET:   return "DELIMITER";

        case TokenType::SEMICOLON: case TokenType::COMMA:      return "PUNCTUATION";

        default:                                               return "OTHER";
    }
}

// ── Token struct ───────────────────────────────────────────
struct Token {
    TokenType   type;
    std::string value;
    std::string category;
    int         line;
    int         col;

    Token(TokenType t, std::string v, int l, int c)
        : type(t), value(std::move(v)),
          category(tokenCategory(t)),
          line(l), col(c) {}
};
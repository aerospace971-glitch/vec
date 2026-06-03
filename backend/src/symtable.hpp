#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <algorithm>

// ── Symbol kinds ───────────────────────────────────────────
enum class SymbolKind {
    VARIABLE,
    PARAMETER,
    FUNCTION,
    CLASS,
    STRUCT,
    ENUM,
    ENUM_VALUE,
    NAMESPACE,
    TYPEDEF,
    UNKNOWN
};

inline std::string symbolKindName(SymbolKind k) {
    switch (k) {
        case SymbolKind::VARIABLE:   return "variable";
        case SymbolKind::PARAMETER:  return "parameter";
        case SymbolKind::FUNCTION:   return "function";
        case SymbolKind::CLASS:      return "class";
        case SymbolKind::STRUCT:     return "struct";
        case SymbolKind::ENUM:       return "enum";
        case SymbolKind::ENUM_VALUE: return "enum_value";
        case SymbolKind::NAMESPACE:  return "namespace";
        case SymbolKind::TYPEDEF:    return "typedef";
        default:                     return "unknown";
    }
}

// ── Single symbol entry ────────────────────────────────────
struct Symbol {
    std::string name;
    std::string type;
    SymbolKind  kind;
    int         scopeLevel;
    int         line;
    int         col;
    bool        isUsed;
    bool        isInitialized;
    bool        isForwardDecl;  // declared without body
    std::string paramTypes;     // comma-separated param types (functions only)
    std::string mangledName;    // simplified GCC-style mangled name

    Symbol(std::string n, std::string t, SymbolKind k,
           int scope, int l, int c)
        : name(std::move(n)), type(std::move(t)), kind(k),
          scopeLevel(scope), line(l), col(c),
          isUsed(false), isInitialized(false), isForwardDecl(false) {}

    std::string toJSON() const {
        std::string out =
            "{"
            "\"name\": \""          + escape(name)              + "\", "
            "\"type\": \""          + escape(type)              + "\", "
            "\"kind\": \""          + symbolKindName(kind)      + "\", "
            "\"scopeLevel\": "      + std::to_string(scopeLevel)+ ", "
            "\"line\": "            + std::to_string(line)      + ", "
            "\"col\": "             + std::to_string(col)       + ", "
            "\"isUsed\": "          + (isUsed        ? "true" : "false") + ", "
            "\"isInitialized\": "   + (isInitialized ? "true" : "false");
        if (!paramTypes.empty())
            out += ", \"paramTypes\": \"" + escape(paramTypes) + "\"";
        if (!mangledName.empty())
            out += ", \"mangledName\": \"" + escape(mangledName) + "\"";
        if (isForwardDecl)
            out += ", \"isForwardDecl\": true";
        out += "}";
        return out;
    }

    static std::string escape(const std::string& s) {
        std::string out;
        for (char c : s) {
            if (c == '"')  out += "\\\"";
            else if (c == '\\') out += "\\\\";
            else out += c;
        }
        return out;
    }
};

// ── Scope — one level of the symbol table ──────────────────
struct Scope {
    std::string                            name;
    int                                    level;
    std::unordered_map<std::string,Symbol> symbols;
    Scope*                                 parent;

    Scope(std::string n, int lvl, Scope* p)
        : name(std::move(n)), level(lvl), parent(p) {}

    bool declare(const Symbol& sym) {
        if (sym.kind == SymbolKind::FUNCTION) {
            // Functions keyed as name#paramTypes to support overloading
            std::string key = sym.name + "#" + sym.paramTypes;
            auto it = symbols.find(key);
            if (it != symbols.end()) {
                // Allow forward decl → definition promotion
                if (it->second.isForwardDecl && !sym.isForwardDecl) {
                    it->second.isForwardDecl  = false;
                    it->second.isInitialized  = true;
                    it->second.mangledName     = sym.mangledName;
                    return true;
                }
                return false; // true duplicate
            }
            symbols.emplace(key, sym);
            return true;
        }
        if (symbols.count(sym.name)) return false;
        symbols.emplace(sym.name, sym);
        return true;
    }

    Symbol* lookup(const std::string& name) {
        // Direct key (non-function or known overload key)
        auto it = symbols.find(name);
        if (it != symbols.end()) return &it->second;
        // Scan for function overload prefix
        for (auto& [key, sym] : symbols) {
            if (sym.kind == SymbolKind::FUNCTION) {
                size_t h = key.find('#');
                if (h != std::string::npos && key.substr(0, h) == name)
                    return &sym;
            }
        }
        if (parent) return parent->lookup(name);
        return nullptr;
    }

    Symbol* lookupLocal(const std::string& name) {
        auto it = symbols.find(name);
        if (it != symbols.end()) return &it->second;
        for (auto& [key, sym] : symbols) {
            if (sym.kind == SymbolKind::FUNCTION) {
                size_t h = key.find('#');
                if (h != std::string::npos && key.substr(0, h) == name)
                    return &sym;
            }
        }
        return nullptr;
    }
};

// ── Symbol table — manages all scopes ─────────────────────
class SymbolTable {
public:
    SymbolTable() {
        // Global scope
        auto global = std::make_unique<Scope>("global", 0, nullptr);
        current_    = global.get();
        scopes_.push_back(std::move(global));
        allScopes_.push_back(current_);

        // Pre-declare common C++ standard names
        declareBuiltins();
    }

    // ── Scope management ──────────────────────────────────
    void enterScope(const std::string& name = "") {
        int   level = current_->level + 1;
        auto  scope = std::make_unique<Scope>(
            name.empty() ? "block_" + std::to_string(level) : name,
            level, current_);
        current_ = scope.get();
        allScopes_.push_back(current_);
        scopes_.push_back(std::move(scope));
    }

    void exitScope() {
        if (current_->parent)
            current_ = current_->parent;
    }

    // ── Symbol operations ──────────────────────────────────
    bool declare(const Symbol& sym) {
        return current_->declare(sym);
    }

    Symbol* lookup(const std::string& name) {
        return current_->lookup(name);
    }

    Symbol* lookupLocal(const std::string& name) {
        return current_->lookupLocal(name);
    }

    Symbol* lookupInScope(const std::string& scopeName,
                          const std::string& symName) {
        for (auto* scope : allScopes_) {
            if (scope->name == scopeName)
                return scope->lookupLocal(symName);
        }
        return nullptr;
    }

    int currentLevel() const { return current_->level; }

    // ── Collect all symbols for JSON output ───────────────
    std::vector<Symbol> allSymbols() const {
        std::vector<Symbol> result;
        for (auto* scope : allScopes_) {
            for (auto& [name, sym] : scope->symbols) {
                // Skip builtins for cleaner output
                if (sym.line == 0) continue;
                result.push_back(sym);
            }
        }
        // Sort by line number
        std::sort(result.begin(), result.end(),
            [](const Symbol& a, const Symbol& b) {
                return a.line < b.line;
            });
        return result;
    }

    std::string toJSON() const {
        auto syms = allSymbols();
        std::string out = "[\n";
        for (size_t i = 0; i < syms.size(); i++) {
            out += "    " + syms[i].toJSON();
            if (i + 1 < syms.size()) out += ",";
            out += "\n";
        }
        out += "  ]";
        return out;
    }

private:
    std::vector<std::unique_ptr<Scope>> scopes_;
    std::vector<Scope*>                 allScopes_;
    Scope*                              current_;

    void declareBuiltins() {
        // Common standard identifiers
        std::vector<std::pair<std::string,std::string>> builtins = {
            {"cout",  "ostream"}, {"cin",   "istream"},
            {"cerr",  "ostream"}, {"endl",  "ostream_manip"},
            {"string","type"},    {"vector","type"},
            {"map",   "type"},    {"set",   "type"},
            {"printf","function"},{"scanf", "function"},
            {"malloc","function"},{"free",  "function"},
            {"NULL",  "macro"},   {"size_t","type"},
        };
        for (auto& [name, type] : builtins) {
            Symbol s(name, type, SymbolKind::VARIABLE, 0, 0, 0);
            s.isInitialized = true;
            s.isUsed        = true;
            current_->declare(s);
        }
    }
};
#include <iostream>
#include <fstream>
#include <sstream>
#include "lexer.hpp"
#include "parser.hpp"
#include "semantic.hpp"
#include "irgen.hpp"

std::string readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open())
        throw std::runtime_error("Cannot open file: " + path);
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

std::string readStdin() {
    std::ostringstream ss;
    ss << std::cin.rdbuf();
    return ss.str();
}

std::string getPhase(int argc, char* argv[]) {
    for (int i = 2; i < argc; i++) {
        std::string arg = argv[i];
        if (arg.rfind("--phase=", 0) == 0)
            return arg.substr(8);
    }
    return "all";
}

std::string escapeJSON(const std::string& s) {
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

int main(int argc, char* argv[]) {
    std::string source;
    std::string phase = getPhase(argc, argv);

    if (argc >= 2 && std::string(argv[1]) != "--stdin") {
        try { source = readFile(argv[1]); }
        catch (const std::exception& e) {
            std::cout << "{\"error\": \""
                      << escapeJSON(e.what()) << "\"}\n";
            return 1;
        }
    } else {
        source = readStdin();
    }

    // Strip UTF-8 BOM
    if (source.size() >= 3 &&
        (unsigned char)source[0] == 0xEF &&
        (unsigned char)source[1] == 0xBB &&
        (unsigned char)source[2] == 0xBF)
        source = source.substr(3);

    // ── Phase 1: Lexer ─────────────────────────────────────
    Lexer lexer(source);
    auto  tokens = lexer.tokenize();

    // ── Phase 2: Parser ────────────────────────────────────
    Parser parser(tokens);
    auto   ast = parser.parse();

    // ── Phase 3: Semantic Analysis ─────────────────────────
    SemanticAnalyzer semantic;
    semantic.analyze(ast);

    // ── Phase 4: IR Generation ─────────────────────────────
    IRGenerator irgen;
    irgen.generate(ast);

    // ── Collect results ────────────────────────────────────
    auto lexErrors  = lexer.errors();
    auto parseErrs  = parser.errors();
    auto semSymbols = semantic.symbolTable().allSymbols();
    auto semErrors  = semantic.errors();
    auto tacInstrs  = irgen.instructions();

    // ── Build JSON ─────────────────────────────────────────
    std::ostringstream json;
    json << "{\n";

    // Tokens
    json << "  \"tokens\": [\n";
    for (size_t i = 0; i < tokens.size(); i++) {
        const auto& t = tokens[i];
        json << "    {"
             << "\"type\": \""     << escapeJSON(tokenTypeName(t.type)) << "\", "
             << "\"category\": \"" << escapeJSON(t.category)            << "\", "
             << "\"value\": \""    << escapeJSON(t.value)               << "\", "
             << "\"line\": "       << t.line                            << ", "
             << "\"col\": "        << t.col << "}";
        if (i + 1 < tokens.size()) json << ",";
        json << "\n";
    }
    json << "  ],\n";
    json << "  \"token_count\": "
         << (tokens.size() > 0 ? tokens.size() - 1 : 0) << ",\n";

    // Lexer errors
    json << "  \"lexer_errors\": [\n";
    for (size_t i = 0; i < lexErrors.size(); i++) {
        const auto& e = lexErrors[i];
        json << "    {\"message\": \"" << escapeJSON(e.message)
             << "\", \"line\": " << e.line
             << ", \"col\": "    << e.col << "}";
        if (i + 1 < lexErrors.size()) json << ",";
        json << "\n";
    }
    json << "  ],\n";

    // AST
    json << "  \"ast\": ";
    if (ast) json << ast->toJSON(1);
    else     json << "null";
    json << ",\n";

    // Parse errors
    json << "  \"parse_errors\": [\n";
    for (size_t i = 0; i < parseErrs.size(); i++) {
        const auto& e = parseErrs[i];
        json << "    {\"message\": \"" << escapeJSON(e.message)
             << "\", \"line\": " << e.line
             << ", \"col\": "    << e.col << "}";
        if (i + 1 < parseErrs.size()) json << ",";
        json << "\n";
    }
    json << "  ],\n";

    // Symbols
    json << "  \"symbols\": [\n";
    for (size_t i = 0; i < semSymbols.size(); i++) {
        json << "    " << semSymbols[i].toJSON();
        if (i + 1 < semSymbols.size()) json << ",";
        json << "\n";
    }
    json << "  ],\n";

    // Semantic errors
    json << "  \"semantic_errors\": [\n";
    for (size_t i = 0; i < semErrors.size(); i++) {
        const auto& e = semErrors[i];
        json << "    {\"message\": \"" << escapeJSON(e.message)
             << "\", \"severity\": \"" << e.severity
             << "\", \"line\": " << e.line
             << ", \"col\": "    << e.col << "}";
        if (i + 1 < semErrors.size()) json << ",";
        json << "\n";
    }
    json << "  ],\n";

    // TAC
    json << "  \"tac\": [\n";
    for (size_t i = 0; i < tacInstrs.size(); i++) {
        json << "    " << tacInstrs[i].toJSON();
        if (i + 1 < tacInstrs.size()) json << ",";
        json << "\n";
    }
    json << "  ],\n";

    // Placeholders
    json << "  \"optimized_tac\": null,\n";
    json << "  \"assembly\":      null,\n";

    // Phase status
    json << "  \"phase_status\": {\n";
    json << "    \"lex\":      true,\n";
    json << "    \"parse\":    true,\n";
    json << "    \"semantic\": true,\n";
    json << "    \"ir\":       true,\n";
    json << "    \"opt\":      false,\n";
    json << "    \"codegen\":  false\n";
    json << "  }\n}\n";

    std::cout << json.str();
    return 0;
}
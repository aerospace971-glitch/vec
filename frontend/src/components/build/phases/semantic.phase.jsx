export default {
  id:     "semantic",
  num:    "03",
  label:  "Semantic — Type Checker",
  color:  "#44aaff",
  icon:   "⊕",
  tagline:"Add meaning — types, scopes, symbols",

  theory: {
    what: "Semantic Analysis checks if the program makes sense. It builds a symbol table, checks types, and verifies that every variable is declared before use.",

    files: [
      {
        name: "symboltable.hpp",
        content: `#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <stdexcept>

struct Symbol {
  std::string name;
  std::string type;        // "int", "float", "void"
  int         scopeLevel;
  bool        initialized = false;
};

class SymbolTable {
public:
  // Enter a new nested scope (e.g. block, function body)
  void enterScope() { scopes.push_back({}); }

  // Exit current scope — symbols go out of visibility
  void exitScope()  { scopes.pop_back(); }

  int currentLevel() const { return (int)scopes.size() - 1; }

  // Declare a symbol in the current (innermost) scope
  void declare(const std::string& name,
               const std::string& type) {
    auto& cur = scopes.back();
    if (cur.count(name))
      throw std::runtime_error(
        "Already declared in this scope: " + name);
    cur[name] = { name, type,
                  (int)scopes.size()-1, false };
  }

  // Look up a symbol — searches from inner to outer scope
  Symbol& lookup(const std::string& name) {
    for (int i = (int)scopes.size()-1; i >= 0; i--)
      if (scopes[i].count(name))
        return scopes[i][name];
    throw std::runtime_error("Undeclared identifier: " + name);
  }

  bool exists(const std::string& name) const {
    for (int i = (int)scopes.size()-1; i >= 0; i--)
      if (scopes[i].count(name)) return true;
    return false;
  }

private:
  std::vector<
    std::unordered_map<std::string, Symbol>
  > scopes;
};`,
      },
      {
        name: "semantic.hpp",
        content: `#pragma once
#include <string>
#include "ast.hpp"
#include "symboltable.hpp"

class SemanticAnalyzer {
public:
  SemanticAnalyzer();

  // Walk the AST; returns deduced type of the node.
  // Throws std::runtime_error on semantic errors.
  std::string analyze(ASTPtr node);

  const SymbolTable& symbols() const { return symTable; }

private:
  SymbolTable symTable;

  std::string analyzeProgram(ASTPtr node);
  std::string analyzeVarDecl(ASTPtr node);
  std::string analyzeBlock(ASTPtr node);
  std::string analyzeBinOp(ASTPtr node);
  std::string analyzeIdent(ASTPtr node);
  std::string analyzeNumber(ASTPtr node);
  std::string analyzeIfStmt(ASTPtr node);

  // Check that two types are compatible for an operation
  std::string unify(const std::string& a,
                    const std::string& b,
                    const std::string& op);
};`,
      },
      {
        name: "semantic.cpp",
        content: `#include "semantic.hpp"
#include <stdexcept>
#include <iostream>

SemanticAnalyzer::SemanticAnalyzer() {
  symTable.enterScope(); // global scope
}

std::string SemanticAnalyzer::analyze(ASTPtr node) {
  if (!node) return "void";
  const auto& t = node->type;
  if (t == "Program")    return analyzeProgram(node);
  if (t == "VarDecl")    return analyzeVarDecl(node);
  if (t == "Block")      return analyzeBlock(node);
  if (t == "BinOp")      return analyzeBinOp(node);
  if (t == "Identifier") return analyzeIdent(node);
  if (t == "Number")     return analyzeNumber(node);
  if (t == "IfStmt")     return analyzeIfStmt(node);
  return "void";
}

std::string SemanticAnalyzer::analyzeProgram(ASTPtr node) {
  for (auto& child : node->children) analyze(child);
  return "void";
}

std::string SemanticAnalyzer::analyzeVarDecl(ASTPtr node) {
  // children[0] = Type node, children[1] = init expr (opt)
  std::string declType = node->children[0]->value;
  symTable.declare(node->value, declType);
  if (node->children.size() > 1) {
    std::string initType = analyze(node->children[1]);
    unify(declType, initType, "=");
    symTable.lookup(node->value).initialized = true;
  }
  std::cout << "[DECLARE] " << node->value
            << " : " << declType
            << " @ scope " << symTable.currentLevel() << "\\n";
  return "void";
}

std::string SemanticAnalyzer::analyzeBlock(ASTPtr node) {
  symTable.enterScope();
  for (auto& child : node->children) analyze(child);
  symTable.exitScope();
  return "void";
}

std::string SemanticAnalyzer::analyzeBinOp(ASTPtr node) {
  std::string lt = analyze(node->children[0]);
  std::string rt = analyze(node->children[1]);
  return unify(lt, rt, node->value);
}

std::string SemanticAnalyzer::analyzeIdent(ASTPtr node) {
  auto& sym = symTable.lookup(node->value);
  return sym.type;
}

std::string SemanticAnalyzer::analyzeNumber(ASTPtr node) {
  // Decide int vs float by presence of '.'
  for (char c : node->value)
    if (c == '.') return "float";
  return "int";
}

std::string SemanticAnalyzer::analyzeIfStmt(ASTPtr node) {
  analyze(node->children[0]); // condition
  analyze(node->children[1]); // body
  return "void";
}

std::string SemanticAnalyzer::unify(const std::string& a,
                                     const std::string& b,
                                     const std::string& op) {
  if (a == b) return a;
  if ((a=="int"||a=="float") && (b=="int"||b=="float"))
    return "float"; // implicit widening
  throw std::runtime_error(
    "Type mismatch for '" + op + "': " + a + " vs " + b);
}`,
      },
    ],

    steps: [
      "Build a SymbolTable with scope stack",
      "enterScope() on each block {",
      "exitScope() on each block }",
      "declare() each variable/function",
      "lookup() to verify var is declared",
      "Check types match in expressions",
      "Return deduced type from analyze()",
      "Verify function call argument counts",
    ],
    tips: [
      "Use stack of hash maps for scope chain",
      "First pass: collect all declarations",
      "Second pass: type check expressions",
      "Return type from analyze() enables type inference",
    ],
  },

  workspaceFiles: [
    {
      name: "my_symtable.hpp",
      content: `#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <stdexcept>

struct Symbol {
  std::string name, type;
  int         scope;
};

class MySymbolTable {
public:
  MySymbolTable() { scopes.push_back({}); }

  void enterScope() { scopes.push_back({}); }
  void exitScope()  { scopes.pop_back();    }

  void declare(const std::string& name,
               const std::string& type) {
    if (scopes.back().count(name))
      throw std::runtime_error("Redeclared: " + name);
    scopes.back()[name] = { name, type, (int)scopes.size()-1 };
  }

  std::string lookup(const std::string& name) {
    for (int i = (int)scopes.size()-1; i >= 0; i--)
      if (scopes[i].count(name))
        return scopes[i][name].type;
    throw std::runtime_error("Undeclared: " + name);
  }

private:
  std::vector<std::unordered_map<std::string, Symbol>> scopes;
};`,
    },
    {
      name: "my_semantic.hpp",
      content: `#pragma once
#include <string>
#include "my_symtable.hpp"

// Forward declare your ASTNode type here
struct ASTNode;

class MySemanticAnalyzer {
public:
  std::string analyze(ASTNode* node);

private:
  MySymbolTable symTable;

  // TODO: Add one method per node type
  std::string analyzeVarDecl(ASTNode* node);
  std::string analyzeBinOp(ASTNode* node);
};`,
    },
    {
      name: "my_semantic.cpp",
      content: `#include "my_semantic.hpp"
#include <iostream>
#include <string>
#include <vector>
using namespace std;

// Inline ASTNode for demo purposes
struct ASTNode {
  string type, value;
  vector<ASTNode*> children;
};

string MySemanticAnalyzer::analyze(ASTNode* node) {
  if (!node) return "void";

  // TODO: Dispatch on node->type
  if (node->type == "Number")     return "int";
  if (node->type == "Identifier") {
    return symTable.lookup(node->value);
  }
  if (node->type == "BinOp") {
    string lt = analyze(node->children[0]);
    string rt = analyze(node->children[1]);
    if (lt != rt) {
      cerr << "[TYPE ERROR] " << lt << " vs " << rt << "\\n";
      return "error";
    }
    return lt;
  }
  // TODO: handle VarDecl, IfStmt, WhileStmt, Block
  return "void";
}

string MySemanticAnalyzer::analyzeVarDecl(ASTNode* node) {
  // TODO: extract type, declare in symTable
  return "void";
}

string MySemanticAnalyzer::analyzeBinOp(ASTNode* node) {
  // TODO: check left and right types match
  return "int";
}

int main() {
  MySemanticAnalyzer sa;
  // Build a small test AST and analyze it
  ASTNode num{ "Number", "42", {} };
  string type = sa.analyze(&num);
  cout << "Type: " << type << endl;
  return 0;
}`,
    },
  ],

  outputSample: `Semantic analysis: "int x = 3; float y = x + 1.5;"

[SCOPE] enter global
[DECLARE] x : int   @ scope 0
[TYPE]    3         → int
[DECLARE] y : float @ scope 0
[TYPE]    x         → int  (lookup)
[TYPE]    1.5       → float
[TYPE]    x + 1.5   → float  (widening int → float)
[ASSIGN]  float ← float  ✓
[SCOPE] exit global

✓  Semantic pass complete (0 errors, 0 warnings)`,

  template: `// MY LANGUAGE SEMANTIC ANALYZER
#include <iostream>
#include <unordered_map>
#include <string>
#include <vector>
using namespace std;

struct Symbol { string name, type; int scope; };
class MySymbolTable {
  vector<unordered_map<string,Symbol>> scopes;
public:
  MySymbolTable() { scopes.push_back({}); }
  void enterScope() { scopes.push_back({}); }
  void exitScope()  { scopes.pop_back(); }
  void declare(string name, string type) {
    scopes.back()[name] = {name, type, (int)scopes.size()-1};
    cout << "Declared: " << name << " : " << type << endl;
  }
  string lookup(string name) {
    for (int i=scopes.size()-1; i>=0; i--)
      if (scopes[i].count(name)) return scopes[i][name].type;
    throw runtime_error("Undeclared: " + name);
  }
};
int main() {
  MySymbolTable st;
  st.declare("x", "int");
  st.declare("y", "float");
  cout << "x type: " << st.lookup("x") << endl;
}`,
};

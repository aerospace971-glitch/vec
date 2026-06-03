export default {
  id:     "ir",
  num:    "04",
  label:  "IR Gen — Three Address Code",
  color:  "#44ffaa",
  icon:   "→",
  tagline:"Generate platform-independent IR",

  theory: {
    what: "IR Generation translates the type-checked AST into Three-Address Code (TAC). Each instruction has at most one operator and three operands.",

    files: [
      {
        name: "tac.hpp",
        content: `#pragma once
#include <string>
#include <iostream>

// Three-Address Code instruction:
//   result = arg1 op arg2   (binary)
//   result = op arg1        (unary)
//   GOTO / IF / LABEL       (control flow)
struct TACInstr {
  std::string result; // destination / label name
  std::string op;     // operator or directive
  std::string arg1;   // left operand
  std::string arg2;   // right operand (may be empty)

  void print() const {
    if (result.back() == ':') {
      // Label line
      std::cout << result << "\\n";
      return;
    }
    if (op == "GOTO" || op == "IF") {
      std::cout << "  " << op << " " << arg1;
      if (!arg2.empty()) std::cout << " GOTO " << arg2;
      std::cout << "\\n";
      return;
    }
    if (op == "PARAM" || op == "CALL") {
      std::cout << "  " << op << " " << arg1 << "\\n";
      return;
    }
    std::cout << "  " << result << " = ";
    if (arg2.empty())
      std::cout << op << " " << arg1;
    else
      std::cout << arg1 << " " << op << " " << arg2;
    std::cout << "\\n";
  }
};`,
      },
      {
        name: "irgen.hpp",
        content: `#pragma once
#include <string>
#include <vector>
#include "ast.hpp"
#include "tac.hpp"

class IRGenerator {
public:
  // Walk the AST and emit TAC instructions.
  // Returns the name of the result variable/temp.
  std::string generate(ASTPtr node);

  void dump() const;
  const std::vector<TACInstr>& instructions() const;

private:
  std::vector<TACInstr> code;
  int tempCount  = 0;
  int labelCount = 0;

  std::string newTemp();   // t1, t2, t3 ...
  std::string newLabel();  // L1, L2, L3 ...
  void        emit(TACInstr instr);

  std::string genNumber(ASTPtr node);
  std::string genIdent(ASTPtr node);
  std::string genBinOp(ASTPtr node);
  std::string genVarDecl(ASTPtr node);
  std::string genIfStmt(ASTPtr node);
  std::string genWhile(ASTPtr node);
};`,
      },
      {
        name: "irgen.cpp",
        content: `#include "irgen.hpp"
#include <stdexcept>
#include <iostream>

std::string IRGenerator::newTemp() {
  return "t" + std::to_string(++tempCount);
}
std::string IRGenerator::newLabel() {
  return "L" + std::to_string(++labelCount);
}
void IRGenerator::emit(TACInstr i) { code.push_back(i); }

const std::vector<TACInstr>& IRGenerator::instructions() const {
  return code;
}
void IRGenerator::dump() const {
  std::cout << "; Generated TAC\\n";
  for (auto& i : code) i.print();
}

std::string IRGenerator::generate(ASTPtr node) {
  if (!node) return "";
  const auto& t = node->type;
  if (t == "Program") {
    for (auto& c : node->children) generate(c);
    return "";
  }
  if (t == "Number")    return genNumber(node);
  if (t == "Identifier")return genIdent(node);
  if (t == "BinOp")     return genBinOp(node);
  if (t == "VarDecl")   return genVarDecl(node);
  if (t == "IfStmt")    return genIfStmt(node);
  if (t == "WhileStmt") return genWhile(node);
  return "";
}

std::string IRGenerator::genNumber(ASTPtr node) {
  return "#" + node->value;  // immediate constant
}
std::string IRGenerator::genIdent(ASTPtr node) {
  return node->value;         // use variable name directly
}
std::string IRGenerator::genBinOp(ASTPtr node) {
  std::string l = generate(node->children[0]);
  std::string r = generate(node->children[1]);
  std::string t = newTemp();
  emit({ t, node->value, l, r });
  return t;
}
std::string IRGenerator::genVarDecl(ASTPtr node) {
  if (node->children.size() > 1) {
    std::string val = generate(node->children[1]);
    emit({ node->value, "=", val, "" });
  }
  return "";
}
std::string IRGenerator::genIfStmt(ASTPtr node) {
  std::string cond   = generate(node->children[0]);
  std::string lTrue  = newLabel();
  std::string lFalse = newLabel();
  emit({ "",      "IF",   cond,   lTrue  });
  emit({ "",      "GOTO", lFalse, ""     });
  emit({ lTrue+":", "", "", ""           });
  generate(node->children[1]);  // body
  emit({ lFalse+":", "", "", ""          });
  return "";
}
std::string IRGenerator::genWhile(ASTPtr node) {
  std::string lStart = newLabel();
  std::string lEnd   = newLabel();
  emit({ lStart+":", "", "", ""       });
  std::string cond = generate(node->children[0]);
  emit({ "",       "IF",   cond,   lEnd });
  emit({ "",       "GOTO", lEnd,   ""   });
  generate(node->children[1]);  // body
  emit({ "",       "GOTO", lStart, ""   });
  emit({ lEnd+":", "",     "",     ""   });
  return "";
}`,
      },
    ],

    steps: [
      "Traverse AST recursively",
      "Leaf nodes (Number, ID) → return their value",
      "BinOp → emit  t = a op b  and return t",
      "Create a new temp for each sub-expression",
      "Assignment → emit  dst = src",
      "If/While → use conditional jumps + labels",
      "Function call → PARAM + CALL instructions",
    ],
    tips: [
      "Each instruction has at most 1 operator",
      "Temporaries t1, t2 … hold intermediate values",
      "Labels L1, L2 … anchor control flow jumps",
      "PARAM + CALL for function calls",
    ],
  },

  workspaceFiles: [
    {
      name: "my_tac.hpp",
      content: `#pragma once
#include <string>
#include <iostream>

// Three-Address Code instruction
struct TAC {
  std::string result, op, arg1, arg2;

  void print() const {
    if (arg2.empty())
      std::cout << "  " << result << " = "
                << op << " " << arg1 << "\\n";
    else
      std::cout << "  " << result << " = "
                << arg1 << " " << op
                << " " << arg2 << "\\n";
  }
};`,
    },
    {
      name: "my_irgen.hpp",
      content: `#pragma once
#include <string>
#include <vector>
#include "my_tac.hpp"

class MyIRGen {
public:
  // TODO: Accept ASTNode* and walk the tree
  std::string genBinOp(const std::string& op,
                        const std::string& a,
                        const std::string& b);
  void genAssign(const std::string& dst,
                 const std::string& src);
  void dump() const;

private:
  std::vector<TAC> code;
  int tempN = 0;
  std::string newTemp();
};`,
    },
    {
      name: "my_irgen.cpp",
      content: `#include "my_irgen.hpp"
#include <iostream>
using namespace std;

string MyIRGen::newTemp() {
  return "t" + to_string(++tempN);
}

string MyIRGen::genBinOp(const string& op,
                           const string& a,
                           const string& b) {
  string t = newTemp();
  code.push_back({ t, op, a, b });
  return t;
}

void MyIRGen::genAssign(const string& dst,
                         const string& src) {
  code.push_back({ dst, "=", src, "" });
}

void MyIRGen::dump() const {
  cout << "; Generated TAC:\\n";
  for (auto& i : code) i.print();
}

int main() {
  MyIRGen gen;
  // Example: x = 3 + 4 * 2
  // Step 1: compute 4 * 2
  string t1 = gen.genBinOp("*", "#4", "#2");
  // Step 2: compute 3 + t1
  string t2 = gen.genBinOp("+", "#3", t1);
  // Step 3: assign to x
  gen.genAssign("x", t2);
  gen.dump();

  // TODO: Replace manual calls with AST traversal
  return 0;
}`,
    },
  ],

  outputSample: `Generating TAC for: "x = 3 + 4 * 2"

; Generated TAC
  t1 = #4 * #2
  t2 = #3 + t1
  x  = t2

; Control flow example: "if (a > b) { y = 1; }"
  t3 = a > b
  IF t3 GOTO L1
  GOTO L2
L1:
  y = #1
L2:

✓  6 TAC instructions emitted`,

  template: `// MY LANGUAGE IR GENERATOR
#include <iostream>
#include <vector>
#include <string>
using namespace std;

struct TAC {
  string result, op, arg1, arg2;
  void print() const {
    if (arg2.empty()) cout << result<<"="<<op<<" "<<arg1<<"\\n";
    else cout << result<<"="<<arg1<<" "<<op<<" "<<arg2<<"\\n";
  }
};
class MyIRGen {
  vector<TAC> code; int tempN=0;
  string newTemp() { return "t"+to_string(++tempN); }
public:
  string genBinOp(string op,string a,string b) {
    string t=newTemp(); code.push_back({t,op,a,b}); return t;
  }
  void dump() { for(auto& i:code) i.print(); }
};
int main() {
  MyIRGen g;
  string t1=g.genBinOp("*","4","2");
  string t2=g.genBinOp("+","3",t1);
  g.dump();
}`,
};

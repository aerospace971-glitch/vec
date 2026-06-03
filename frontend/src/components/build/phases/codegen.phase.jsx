export default {
  id:     "codegen",
  num:    "06",
  label:  "CodeGen — Assembly",
  color:  "#ff4488",
  icon:   "⚙",
  tagline:"Generate target machine instructions",

  theory: {
    what: "Code Generation translates optimized IR into target machine instructions. It allocates registers, selects instruction patterns, and produces the final assembly output.",

    files: [
      {
        name: "codegen.hpp",
        content: `#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include "tac.hpp"

// Targets the VRM virtual register machine
// Registers: R0–R7  (R0 = return value by convention)
class CodeGenerator {
public:
  CodeGenerator();

  void generate(const std::vector<TACInstr>& ir);
  void dump() const;

  const std::vector<std::string>& output() const;

private:
  std::vector<std::string>         asm_out;
  std::unordered_map<std::string,
                     std::string>  regMap;
  std::vector<std::string>         regPool;
  size_t                           regIdx = 0;

  void        emit(const std::string& line);
  std::string alloc(const std::string& var);
  std::string load(const std::string& val);
  void        freeTemp(const std::string& var);

  void genAssign(const TACInstr& t);
  void genBinOp(const TACInstr& t);
  void genConditional(const TACInstr& t);
  void genLabel(const TACInstr& t);
  void genCall(const TACInstr& t);
  void genReturn(const TACInstr& t);
};`,
      },
      {
        name: "codegen.cpp",
        content: `#include "codegen.hpp"
#include <stdexcept>
#include <iostream>

CodeGenerator::CodeGenerator()
  : regPool({"R0","R1","R2","R3","R4","R5","R6","R7"}) {}

const std::vector<std::string>& CodeGenerator::output() const {
  return asm_out;
}
void CodeGenerator::emit(const std::string& line) {
  asm_out.push_back(line);
}
void CodeGenerator::dump() const {
  for (auto& line : asm_out) std::cout << line << "\\n";
}

std::string CodeGenerator::alloc(const std::string& var) {
  auto it = regMap.find(var);
  if (it != regMap.end()) return it->second;
  std::string reg = regPool[regIdx % regPool.size()];
  regIdx++;
  regMap[var] = reg;
  return reg;
}
std::string CodeGenerator::load(const std::string& val) {
  if (!val.empty() && val[0] == '#') return val; // immediate
  return alloc(val);
}
void CodeGenerator::freeTemp(const std::string& var) {
  auto it = regMap.find(var);
  if (it != regMap.end() && var[0] == 't') regMap.erase(it);
}

void CodeGenerator::genAssign(const TACInstr& t) {
  std::string dst = alloc(t.result);
  std::string src = load(t.arg1);
  emit("  MOV " + dst + ", " + src);
}
void CodeGenerator::genBinOp(const TACInstr& t) {
  std::string dst = alloc(t.result);
  std::string a   = load(t.arg1);
  std::string b   = load(t.arg2);
  std::string ins;
  if      (t.op == "+") ins = "ADD";
  else if (t.op == "-") ins = "SUB";
  else if (t.op == "*") ins = "MUL";
  else if (t.op == "/") ins = "DIV";
  else if (t.op == "%") ins = "MOD";
  else throw std::runtime_error("Unknown op: " + t.op);
  emit("  MOV " + dst + ", " + a);
  emit("  " + ins + " " + dst + ", " + b);
}
void CodeGenerator::genConditional(const TACInstr& t) {
  // IF cond GOTO label
  std::string src = load(t.arg1);
  emit("  CMP " + src + ", #0");
  emit("  JNZ " + t.arg2);
}
void CodeGenerator::genLabel(const TACInstr& t) {
  emit(t.result);  // e.g. "L1:"
}
void CodeGenerator::genCall(const TACInstr& t) {
  emit("  CALL " + t.arg1);
  if (!t.result.empty()) {
    std::string dst = alloc(t.result);
    emit("  MOV " + dst + ", R0");  // R0 = return value
  }
}
void CodeGenerator::genReturn(const TACInstr& t) {
  if (!t.arg1.empty())
    emit("  MOV R0, " + load(t.arg1));
  emit("  RET");
}

void CodeGenerator::generate(const std::vector<TACInstr>& ir) {
  emit("; Generated Assembly");
  for (const auto& t : ir) {
    if (!t.result.empty() && t.result.back() == ':')
      genLabel(t);
    else if (t.op == "=")
      genAssign(t);
    else if (t.op=="+"||t.op=="-"||t.op=="*"||t.op=="/"||t.op=="%")
      genBinOp(t);
    else if (t.op == "IF")
      genConditional(t);
    else if (t.op == "CALL")
      genCall(t);
    else if (t.op == "RETURN")
      genReturn(t);
  }
}`,
      },
    ],

    steps: [
      "Map IR variables to physical registers (R0–R7)",
      "Handle register spilling when registers run out",
      "MOV for assignments and loads",
      "ADD/SUB/MUL/DIV for arithmetic ops",
      "CMP + JMP for conditionals",
      "CALL/RET for function calls",
      "PUSH/POP for stack management",
    ],
    tips: [
      "R0 is the return value register by convention",
      "Spill to memory stack when registers run out",
      "Graph coloring for optimal allocation",
      "Instruction scheduling reduces pipeline stalls",
    ],
  },

  workspaceFiles: [
    {
      name: "my_codegen.hpp",
      content: `#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <iostream>

// Reuse your TAC struct from IR Gen phase
struct TAC { std::string res, op, a1, a2; };

class MyCodeGen {
public:
  MyCodeGen();
  void generate(const std::string& res,
                const std::string& op,
                const std::string& a1,
                const std::string& a2 = "");
  void dump() const;

private:
  std::unordered_map<std::string, std::string> regMap;
  std::vector<std::string> regs;
  size_t regIdx = 0;
  std::vector<std::string> output;

  std::string alloc(const std::string& var);
  std::string load(const std::string& val);
  void        emit(const std::string& s);
};`,
    },
    {
      name: "my_codegen.cpp",
      content: `#include "my_codegen.hpp"
#include <iostream>
using namespace std;

MyCodeGen::MyCodeGen()
  : regs({"R0","R1","R2","R3","R4","R5"}) {}

string MyCodeGen::alloc(const string& var) {
  if (!regMap.count(var))
    regMap[var] = regs[regIdx++ % regs.size()];
  return regMap[var];
}

string MyCodeGen::load(const string& val) {
  // Immediate constant?
  bool isNum = !val.empty();
  for (char c : val) if (!isdigit(c)) { isNum = false; break; }
  return isNum ? "#" + val : alloc(val);
}

void MyCodeGen::emit(const string& s) {
  output.push_back("  " + s);
  cout << "  " << s << "\\n";
}

void MyCodeGen::generate(const string& res,
                          const string& op,
                          const string& a1,
                          const string& a2) {
  if (op == "=") {
    // Assignment
    emit("MOV " + alloc(res) + ", " + load(a1));
  } else {
    // Binary op — TODO: add more operators
    string ins = op=="+"?"ADD": op=="-"?"SUB":
                 op=="*"?"MUL": op=="/"?"DIV":"???";
    string r = alloc(res);
    emit("MOV " + r + ", " + load(a1));
    emit(ins + " " + r + ", " + load(a2));
  }
}

void MyCodeGen::dump() const {
  cout << "; Full assembly output:\\n";
  for (auto& line : output) cout << line << "\\n";
}

int main() {
  MyCodeGen gen;
  // From TAC: t1 = 5 * 2 | t2 = 3 + t1 | x = t2
  cout << "; Assembly Output:\\n";
  gen.generate("t1", "*", "5", "2");
  gen.generate("t2", "+", "3", "t1");
  gen.generate("x",  "=", "t2");
  return 0;
}`,
    },
  ],

  outputSample: `Generating assembly for: "x = 3 + 4 * 2"

TAC input:
  t1 = #4 * #2
  t2 = #3 + t1
  x  = t2

; Assembly Output
  MOV R0, #4
  MUL R0, #2        ; R0 = 8  (t1)
  MOV R1, #3
  ADD R1, R0        ; R1 = 11 (t2)
  MOV R2, R1        ; R2 = x

Register allocation:
  t1 → R0
  t2 → R1
  x  → R2

✓  5 instructions emitted, 3 registers allocated`,

  template: `// MY LANGUAGE CODE GENERATOR
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
using namespace std;

class MyCodeGen {
  unordered_map<string,string> regMap;
  vector<string> regs={"R0","R1","R2","R3"};
  int regIdx=0;
  string alloc(string v) {
    if(!regMap.count(v)) regMap[v]=regs[regIdx++%regs.size()];
    return regMap[v];
  }
  string load(string v) {
    bool n=!v.empty(); for(char c:v) if(!isdigit(c)){n=false;break;}
    return n?"#"+v:alloc(v);
  }
  void emit(string s) { cout<<"  "<<s<<endl; }
public:
  void gen(string r,string op,string a,string b) {
    if(op=="=") { emit("MOV "+alloc(r)+","+load(a)); return; }
    string ins=op=="+"?"ADD":op=="-"?"SUB":op=="*"?"MUL":"DIV";
    string rg=alloc(r);
    emit("MOV "+rg+","+load(a));
    emit(ins+" "+rg+","+load(b));
  }
};
int main() {
  MyCodeGen g;
  cout<<"; Assembly:"<<endl;
  g.gen("t1","*","5","2");
  g.gen("t2","+","3","t1");
  g.gen("x","=","t2","");
}`,
};

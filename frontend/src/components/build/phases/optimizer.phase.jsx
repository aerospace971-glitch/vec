export default {
  id:     "optimizer",
  num:    "05",
  label:  "Optimizer — Passes",
  color:  "#ffaa44",
  icon:   "⚡",
  tagline:"Transform IR to make code faster",

  theory: {
    what: "The Optimizer applies transformation passes to the IR. It improves performance without changing the observable behavior of the program.",

    files: [
      {
        name: "optimizer.hpp",
        content: `#pragma once
#include <vector>
#include <string>
#include <unordered_map>
#include "tac.hpp"

class Optimizer {
public:
  explicit Optimizer(std::vector<TACInstr>& ir);

  // Run all passes to a fixed point (until stable)
  void optimize();

  // Individual passes — public for testing / composability
  bool foldConstants();      // t1 = 3*4  →  t1 = 12
  bool propagateConstants(); // x=12; y=x →  y=12
  bool copyPropagate();      // t1=a; t2=t1 → t2=a
  bool eliminateDeadCode();  // remove unused temps

private:
  std::vector<TACInstr>& ir;

  static bool isNumber(const std::string& s);
  static bool isTemp(const std::string& s);

  std::unordered_map<std::string, std::string> buildUseDef();
};`,
      },
      {
        name: "optimizer.cpp",
        content: `#include "optimizer.hpp"
#include <algorithm>
#include <unordered_set>
#include <iostream>

Optimizer::Optimizer(std::vector<TACInstr>& ir) : ir(ir) {}

bool Optimizer::isNumber(const std::string& s) {
  if (s.empty()) return false;
  size_t i = (s[0] == '#') ? 1 : 0;
  if (i == s.size()) return false;
  for (; i < s.size(); i++)
    if (!std::isdigit(s[i]) && s[i] != '.') return false;
  return true;
}
bool Optimizer::isTemp(const std::string& s) {
  return !s.empty() && s[0] == 't' && s.size() > 1;
}

bool Optimizer::foldConstants() {
  bool changed = false;
  for (auto& t : ir) {
    if (!isNumber(t.arg1) || !isNumber(t.arg2)) continue;
    double a = std::stod(t.arg1.substr(t.arg1[0]=='#'?1:0));
    double b = std::stod(t.arg2.substr(t.arg2[0]=='#'?1:0));
    double r = 0;
    if      (t.op == "+") r = a + b;
    else if (t.op == "-") r = a - b;
    else if (t.op == "*") r = a * b;
    else if (t.op == "/" && b != 0) r = a / b;
    else continue;
    std::string rv = std::to_string((long long)r);
    std::cout << "[FOLD] " << t.result << " = "
              << t.arg1 << " " << t.op << " " << t.arg2
              << "  →  " << rv << "\\n";
    t.op = "="; t.arg1 = rv; t.arg2 = "";
    changed = true;
  }
  return changed;
}

bool Optimizer::propagateConstants() {
  std::unordered_map<std::string,std::string> constMap;
  bool changed = false;
  for (auto& t : ir) {
    // Substitute known constants into operands
    auto sub = [&](std::string& s) {
      if (constMap.count(s)) { s = constMap[s]; changed = true; }
    };
    sub(t.arg1); sub(t.arg2);
    // Record newly constant assignments
    if (t.op == "=" && isNumber(t.arg1))
      constMap[t.result] = t.arg1;
  }
  return changed;
}

bool Optimizer::copyPropagate() {
  std::unordered_map<std::string,std::string> copies;
  bool changed = false;
  for (auto& t : ir) {
    auto sub = [&](std::string& s) {
      if (copies.count(s)) { s = copies[s]; changed = true; }
    };
    sub(t.arg1); sub(t.arg2);
    if (t.op == "=" && !isNumber(t.arg1))
      copies[t.result] = t.arg1;
  }
  return changed;
}

bool Optimizer::eliminateDeadCode() {
  std::unordered_set<std::string> used;
  for (auto& t : ir) { used.insert(t.arg1); used.insert(t.arg2); }
  size_t before = ir.size();
  ir.erase(
    std::remove_if(ir.begin(), ir.end(),
      [&](const TACInstr& t) {
        bool dead = !t.result.empty()
                 && !used.count(t.result)
                 && isTemp(t.result);
        if (dead)
          std::cout << "[DEAD] removed: " << t.result << "\\n";
        return dead;
      }),
    ir.end());
  return ir.size() != before;
}

void Optimizer::optimize() {
  bool changed;
  do {
    changed  = foldConstants();
    changed |= propagateConstants();
    changed |= copyPropagate();
    changed |= eliminateDeadCode();
  } while (changed);
}`,
      },
    ],

    steps: [
      "Constant Folding: evaluate constants at compile time",
      "Constant Propagation: replace vars with known values",
      "Copy Propagation: replace t1=a; y=t1 with y=a",
      "Dead Code Elimination: remove unused assignments",
      "Run all passes in a loop until no more changes",
      "Each pass is independent and composable",
    ],
    tips: [
      "Run multiple passes until stable (fixed point)",
      "Order matters — fold before propagate",
      "Don't optimize across function call boundaries",
      "SSA form makes many optimizations easier",
    ],
  },

  workspaceFiles: [
    {
      name: "my_optimizer.hpp",
      content: `#pragma once
#include <vector>
#include <string>
#include <unordered_map>

// Reuse your TAC struct from the IR Gen phase
struct TAC {
  std::string res, op, a1, a2;
};

class MyOptimizer {
public:
  explicit MyOptimizer(std::vector<TAC>& ir);
  void optimize();

  bool foldConstants();
  // TODO: propagateConstants(), eliminateDeadCode()

private:
  std::vector<TAC>& ir;
  static bool isNum(const std::string& s);
};`,
    },
    {
      name: "my_optimizer.cpp",
      content: `#include "my_optimizer.hpp"
#include <iostream>
#include <algorithm>
using namespace std;

MyOptimizer::MyOptimizer(vector<TAC>& ir) : ir(ir) {}

bool MyOptimizer::isNum(const string& s) {
  if (s.empty()) return false;
  for (char c : s)
    if (!isdigit(c) && c != '.') return false;
  return true;
}

// Pass 1: Evaluate constant expressions at compile time
bool MyOptimizer::foldConstants() {
  bool changed = false;
  for (auto& t : ir) {
    if (!isNum(t.a1) || !isNum(t.a2)) continue;
    int a = stoi(t.a1), b = stoi(t.a2), r = 0;
    if      (t.op == "+") r = a + b;
    else if (t.op == "-") r = a - b;
    else if (t.op == "*") r = a * b;
    else if (t.op == "/" && b != 0) r = a / b;
    else continue;
    cout << "[FOLD] " << t.res << " = "
         << t.a1 << t.op << t.a2 << "  →  " << r << "\\n";
    t.op = "="; t.a1 = to_string(r); t.a2 = "";
    changed = true;
  }
  return changed;
}

// TODO: Implement propagateConstants()
// TODO: Implement eliminateDeadCode()

void MyOptimizer::optimize() {
  bool changed;
  do {
    changed = foldConstants();
    // changed |= propagateConstants();
    // changed |= eliminateDeadCode();
  } while (changed);
}

int main() {
  vector<TAC> ir = {
    {"t1", "*", "5", "2"},
    {"t2", "+", "3", "t1"},
    {"x",  "=", "t2", ""},
  };
  MyOptimizer opt(ir);
  opt.optimize();
  for (auto& t : ir)
    cout << t.res << " = " << t.a1
         << (t.a2.empty() ? "" : " "+t.op+" "+t.a2) << "\\n";
  return 0;
}`,
    },
  ],

  outputSample: `Optimizing TAC:

Before:
  t1 = 5 * 2
  t2 = 3 + t1
  x  = t2

[FOLD] t1 = 5 * 2    →  10
[FOLD] t2 = 3 + 10   →  13
[PROP] x  = t2       →  x = 13
[DEAD] removed: t1
[DEAD] removed: t2

After (2 passes):
  x = 13

✓  Optimized: 3 instructions → 1`,

  template: `// MY LANGUAGE OPTIMIZER
#include <iostream>
#include <vector>
#include <string>
#include <unordered_map>
using namespace std;

struct TAC { string res,op,a1,a2; bool dead=false; };

bool isNum(const string& s) {
  if (s.empty()) return false;
  for (char c:s) if(!isdigit(c)) return false;
  return true;
}

class MyOptimizer {
  vector<TAC>& ir;
public:
  MyOptimizer(vector<TAC>& code):ir(code){}
  void foldConstants() {
    for(auto& t:ir) {
      if(isNum(t.a1)&&isNum(t.a2)) {
        int a=stoi(t.a1),b=stoi(t.a2),r;
        if(t.op=="+") r=a+b; else if(t.op=="*") r=a*b; else continue;
        cout<<"[FOLD] "<<t.res<<"="<<t.a1<<t.op<<t.a2<<"→"<<r<<endl;
        t.op="="; t.a1=to_string(r); t.a2="";
      }
    }
  }
};
int main() {
  vector<TAC> ir={{"t1","*","5","2"},{"t2","+","3","t1"},{"x","=","t2",""}};
  MyOptimizer o(ir); o.foldConstants();
}`,
};

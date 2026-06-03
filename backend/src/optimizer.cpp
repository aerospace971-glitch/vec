#include "optimizer.hpp"
#include <sstream>
#include <cmath>
#include <algorithm>
#include <stdexcept>
#include <map>
#include <tuple>

// ══════════════════════════════════════════════════════════
//  Constructor
// ══════════════════════════════════════════════════════════

Optimizer::Optimizer() {}

// ══════════════════════════════════════════════════════════
//  Main entry
// ══════════════════════════════════════════════════════════

void Optimizer::optimize(const std::vector<TACInstr>& instrs) {
    original_  = instrs;
    optimized_ = instrs;
    changes_.clear();

    // Run passes in order — multiple iterations until stable
    bool changed = true;
    int  maxIter = 5;

    while (changed && maxIter-- > 0) {
        changed = false;
        size_t before = optimized_.size();
        std::string beforeCode;
        for (auto& i : optimized_) beforeCode += i.toString();

        optimized_ = passLoopUnrolling         (optimized_);
        optimized_ = passFunctionInlining      (optimized_);
        optimized_ = passConstantFolding       (optimized_);
        optimized_ = passConstantPropagation   (optimized_);
        optimized_ = passCopyPropagation       (optimized_);
        optimized_ = passCSE                   (optimized_);
        optimized_ = passStrengthReduction     (optimized_);
        optimized_ = passDeadCodeElimination   (optimized_);
        optimized_ = passPeephole              (optimized_);

        std::string afterCode;
        for (auto& i : optimized_) afterCode += i.toString();

        if (beforeCode != afterCode || optimized_.size() != before)
            changed = true;
    }
}

// ══════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════

bool Optimizer::isConstant(const std::string& val) const {
    if (val.empty()) return false;
    // Integer: optional minus then digits
    size_t start = (val[0] == '-') ? 1 : 0;
    if (start >= val.size()) return false;
    for (size_t i = start; i < val.size(); i++) {
        char c = val[i];
        if (!std::isdigit(c) && c != '.' && c != 'f' && c != 'F')
            return false;
    }
    return true;
}

bool Optimizer::isNumeric(const std::string& val) const {
    return isConstant(val);
}

double Optimizer::toNumber(const std::string& val) const {
    try {
        std::string v = val;
        // Remove float suffix
        if (!v.empty() && (v.back() == 'f' || v.back() == 'F'))
            v.pop_back();
        return std::stod(v);
    } catch (...) {
        return 0.0;
    }
}

std::string Optimizer::foldBinary(const std::string& op,
                                   const std::string& a,
                                   const std::string& b) const {
    double lhs = toNumber(a);
    double rhs = toNumber(b);
    double result = 0.0;

    if      (op == "+")  result = lhs + rhs;
    else if (op == "-")  result = lhs - rhs;
    else if (op == "*")  result = lhs * rhs;
    else if (op == "/") {
        if (rhs == 0.0) return ""; // division by zero — don't fold
        result = lhs / rhs;
    }
    else if (op == "%") {
        if (rhs == 0.0) return "";
        result = std::fmod(lhs, rhs);
    }
    else if (op == "==") result = (lhs == rhs) ? 1.0 : 0.0;
    else if (op == "!=") result = (lhs != rhs) ? 1.0 : 0.0;
    else if (op == "<")  result = (lhs <  rhs) ? 1.0 : 0.0;
    else if (op == ">")  result = (lhs >  rhs) ? 1.0 : 0.0;
    else if (op == "<=") result = (lhs <= rhs) ? 1.0 : 0.0;
    else if (op == ">=") result = (lhs >= rhs) ? 1.0 : 0.0;
    else if (op == "&&") result = (lhs && rhs) ? 1.0 : 0.0;
    else if (op == "||") result = (lhs || rhs) ? 1.0 : 0.0;
    else return ""; // unknown op

    // Return as integer string if whole number
    if (result == std::floor(result) &&
        std::abs(result) < 1e9)
        return std::to_string((long long)result);

    // Float
    std::ostringstream ss;
    ss << result;
    return ss.str();
}

bool Optimizer::isTempVar(const std::string& name) const {
    if (name.empty() || name[0] != 't') return false;
    size_t i = 1;
    while (i < name.size() && std::isdigit(name[i])) i++;
    return i > 1; // t + at least one digit, optional suffix (_u0, _i1, etc.)
}

void Optimizer::recordChange(int id,
                              const std::string& before,
                              const std::string& after,
                              const std::string& pass,
                              const std::string& reason) {
    changes_.push_back({ id, before, after, pass, reason });
}

// ══════════════════════════════════════════════════════════
//  Pass 1 — Constant Folding
//  t1 = 3 + 4  →  t1 = 7
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Pass 1 — Constant Folding
//  t1 = 3 + 4  →  t1 = 7
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passConstantFolding(
    const std::vector<TACInstr>& in) {

    std::vector<TACInstr> out;

    for (auto instr : in) {
        // Binary op jahan dono args constant hain
        if (!instr.result.empty() &&
            !instr.arg1.empty()   &&
            !instr.arg2.empty()   &&
            isConstant(instr.arg1) &&
            isConstant(instr.arg2)) {

            std::string op = tacOpName(instr.op);
            std::string folded = foldBinary(op, instr.arg1, instr.arg2);

            if (!folded.empty()) {
                std::string before = instr.toString();
                std::string oldArg1 = instr.arg1;
                std::string oldArg2 = instr.arg2;

                // Instruction ko simple ASSIGN mein badlo
                instr.op   = TACOp::ASSIGN;
                instr.arg1 = folded;
                instr.arg2 = "";

                recordChange(instr.id, before, instr.toString(),
                    "Constant Folding",
                    oldArg1 + " " + op + " " + oldArg2 +
                    " evaluated at compile time");
            }
        }

        out.push_back(instr);
    }
    return out;
}

std::vector<TACInstr> Optimizer::passConstantPropagation(
    const std::vector<TACInstr>& in) {

    // ── Step 1: Count ALL assignments to each variable ──
    std::unordered_map<std::string, int> assignCount;
    for (const auto& instr : in) {
        if (!instr.result.empty() &&
            instr.op != TACOp::FUNC_BEGIN &&
            instr.op != TACOp::FUNC_END   &&
            instr.op != TACOp::LABEL      &&
            instr.op != TACOp::PARAM      &&
            instr.op != TACOp::JUMP       &&    // ← yeh
            instr.op != TACOp::JUMP_IF    &&    // ← yeh
            instr.op != TACOp::JUMP_IFNOT &&    // ← yeh
            instr.op != TACOp::PRINT) {         // ← yeh
            assignCount[instr.result]++;
        }
    }

    // ── Step 2: Only propagate variables assigned EXACTLY ONCE ──
    std::unordered_map<std::string, std::string> constMap;
    for (const auto& instr : in) {
        if (!instr.result.empty() &&
            isConstant(instr.arg1) &&
            instr.arg2.empty() &&                  // ← sirf pure copy
            instr.arg1 != instr.result &&          // ← self-reference nahi
            assignCount[instr.result] == 1) {
            constMap[instr.result] = instr.arg1;
        }
    }

    // ── Step 3: Propagate ──
    std::vector<TACInstr> out;
    for (auto instr : in) {

        // Replace arg1
        if (!instr.arg1.empty() &&
            constMap.count(instr.arg1) &&
            instr.op != TACOp::FUNC_BEGIN &&
            instr.op != TACOp::FUNC_END   &&
            instr.op != TACOp::LABEL) {
            std::string before = instr.toString();
            std::string oldVal = instr.arg1;
            instr.arg1 = constMap[instr.arg1];
            recordChange(instr.id, before, instr.toString(),
                "Constant Propagation",
                "Replaced '" + oldVal + "' with constant " + instr.arg1);
        }

        // Replace arg2
        if (!instr.arg2.empty() &&
            constMap.count(instr.arg2) &&
            instr.op != TACOp::FUNC_BEGIN &&
            instr.op != TACOp::FUNC_END   &&
            instr.op != TACOp::LABEL) {
            std::string before = instr.toString();
            std::string oldVal = instr.arg2;
            instr.arg2 = constMap[instr.arg2];
            recordChange(instr.id, before, instr.toString(),
                "Constant Propagation",
                "Replaced '" + oldVal + "' with constant " + instr.arg2);
        }

        out.push_back(instr);
    }
    return out;
}
// ══════════════════════════════════════════════════════════
//  Pass 3 — Copy Propagation
//  t1 = x; y = t1 + 2  →  y = x + 2
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passCopyPropagation(
    const std::vector<TACInstr>& in) {

    // Map: temp → what it copies from
    std::unordered_map<std::string, std::string> copyMap;
    std::vector<TACInstr> out;

    for (auto instr : in) {
        // Record copy: t1 = x (where x is not a constant)
        if (instr.op == TACOp::COPY &&
            !instr.result.empty()   &&
            !instr.arg1.empty()     &&
            !isConstant(instr.arg1)) {
            copyMap[instr.result] = instr.arg1;
        }

        // Invalidate if result is overwritten
        if (!instr.result.empty() &&
            instr.op != TACOp::COPY) {
            copyMap.erase(instr.result);
        }

        // Propagate arg1
        if (!instr.arg1.empty() && copyMap.count(instr.arg1)) {
            std::string before = instr.toString();
            std::string old    = instr.arg1;
            instr.arg1 = copyMap[instr.arg1];
            recordChange(instr.id, before, instr.toString(),
                "Copy Propagation",
                "Replaced copy '" + old + "' with original '" +
                instr.arg1 + "'");
        }

        // Propagate arg2
        if (!instr.arg2.empty() && copyMap.count(instr.arg2)) {
            std::string before = instr.toString();
            std::string old    = instr.arg2;
            instr.arg2 = copyMap[instr.arg2];
            recordChange(instr.id, before, instr.toString(),
                "Copy Propagation",
                "Replaced copy '" + old + "' with original '" +
                instr.arg2 + "'");
        }

        out.push_back(instr);
    }
    return out;
}

// ══════════════════════════════════════════════════════════
//  Pass 4 — Dead Code Elimination
//  Remove instructions whose result is never used
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passDeadCodeElimination(
    const std::vector<TACInstr>& in) {

    // First collect all uses of every variable
    std::unordered_set<std::string> used;

    for (const auto& instr : in) {
        if (!instr.arg1.empty())   used.insert(instr.arg1);
        if (!instr.arg2.empty())   used.insert(instr.arg2);
        // Return value is always considered used
        if (instr.op == TACOp::RETURN && !instr.arg1.empty())
            used.insert(instr.arg1);
        // Function call result may be used later
        if (instr.op == TACOp::CALL)
            used.insert(instr.result);
    }

    std::vector<TACInstr> out;
    for (auto instr : in) {
        // Only eliminate temp variable assignments
        bool isTemp      = isTempVar(instr.result);
        bool resultUsed  = used.count(instr.result) > 0;
        bool isImportantOp = (
                            instr.op == TACOp::ADD   ||
                            instr.op == TACOp::SUB   ||
                            instr.op == TACOp::MUL   ||
                            instr.op == TACOp::DIV   ||
                            instr.op == TACOp::MOD   ||

                            instr.op == TACOp::COPY  ||
                            instr.op == TACOp::EQ    ||
                            instr.op == TACOp::NEQ   ||
                            instr.op == TACOp::LT    ||
                            instr.op == TACOp::GT    ||
                            instr.op == TACOp::LTE   ||
                            instr.op == TACOp::GTE

                        );
           
        if(
            instr.op == TACOp::PRINT ||
            instr.op == TACOp::CALL  ||
            instr.op == TACOp::RETURN  
         
        ){
            out.push_back(instr);
            continue;
        }  

        if (isTemp && !resultUsed && isImportantOp) {
            recordChange(instr.id,
                instr.toString(), "-- REMOVED --",
                "Dead Code Elimination",
                "Result '" + instr.result +
                "' is assigned but never used");
            continue; // skip this instruction
        }

        out.push_back(instr);
    }
    return out;
}

// ══════════════════════════════════════════════════════════
//  Pass 5 — Common Subexpression Elimination
//  t1 = a + b; t2 = a + b  →  t2 = t1
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passCSE(const std::vector<TACInstr>& in) {
    using Key = std::tuple<std::string, std::string, std::string>;
    std::map<Key, std::string> exprMap;

    std::vector<TACInstr> out;
    for (auto instr : in) {
        bool eligible =
            !instr.result.empty()   &&
            isTempVar(instr.result) &&
            !instr.arg1.empty()     &&
            !instr.arg2.empty()     &&
            instr.op != TACOp::CALL      &&
            instr.op != TACOp::ASSIGN    &&
            instr.op != TACOp::COPY      &&
            instr.op != TACOp::FUNC_BEGIN&&
            instr.op != TACOp::FUNC_END  &&
            instr.op != TACOp::LABEL;

        if (eligible) {
            Key key = { tacOpName(instr.op), instr.arg1, instr.arg2 };
            auto it = exprMap.find(key);
            if (it != exprMap.end()) {
                std::string before = instr.toString();
                instr.op   = TACOp::COPY;
                instr.arg1 = it->second;
                instr.arg2 = "";
                recordChange(instr.id, before, instr.toString(),
                    "Common Subexpression Elimination",
                    "Already computed in " + it->second);
            } else {
                exprMap[key] = instr.result;
            }
        }

        // Invalidate expressions that depend on a non-temp being reassigned
        if (!instr.result.empty() && !isTempVar(instr.result)) {
            for (auto it = exprMap.begin(); it != exprMap.end(); ) {
                if (std::get<1>(it->first) == instr.result ||
                    std::get<2>(it->first) == instr.result)
                    it = exprMap.erase(it);
                else
                    ++it;
            }
        }

        out.push_back(instr);
    }
    return out;
}

// ══════════════════════════════════════════════════════════
//  Pass 6 — Strength Reduction
//  x * 2 → x + x,  x * 4 → x << 2,  x / 2 → x >> 1
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passStrengthReduction(const std::vector<TACInstr>& in) {
    std::vector<TACInstr> out;
    for (auto instr : in) {
        std::string before = instr.toString();
        bool changed = false;

        if (instr.op == TACOp::MUL) {
            if (instr.arg2 == "0" || instr.arg1 == "0") {
                instr.op = TACOp::COPY; instr.arg1 = "0"; instr.arg2 = "";
                changed = true;
            } else if (instr.arg2 == "1") {
                instr.op = TACOp::COPY; instr.arg2 = "";
                changed = true;
            } else if (instr.arg1 == "1") {
                instr.op = TACOp::COPY; instr.arg1 = instr.arg2; instr.arg2 = "";
                changed = true;
            } else if (instr.arg2 == "2") {
                instr.op = TACOp::ADD; instr.arg2 = instr.arg1;
                changed = true;
            } else if (instr.arg2 == "4") {
                instr.op = TACOp::LSHIFT; instr.arg2 = "2";
                changed = true;
            } else if (instr.arg2 == "8") {
                instr.op = TACOp::LSHIFT; instr.arg2 = "3";
                changed = true;
            }
        } else if (instr.op == TACOp::DIV) {
            if (instr.arg2 == "1") {
                instr.op = TACOp::COPY; instr.arg2 = "";
                changed = true;
            } else if (instr.arg2 == "2") {
                instr.op = TACOp::RSHIFT; instr.arg2 = "1";
                changed = true;
            } else if (instr.arg2 == "4") {
                instr.op = TACOp::RSHIFT; instr.arg2 = "2";
                changed = true;
            }
        } else if (instr.op == TACOp::ADD) {
            if (instr.arg2 == "0") {
                instr.op = TACOp::COPY; instr.arg2 = "";
                changed = true;
            } else if (instr.arg1 == "0") {
                instr.op = TACOp::COPY; instr.arg1 = instr.arg2; instr.arg2 = "";
                changed = true;
            }
        } else if (instr.op == TACOp::SUB && instr.arg2 == "0") {
            instr.op = TACOp::COPY; instr.arg2 = "";
            changed = true;
        }

        if (changed)
            recordChange(instr.id, before, instr.toString(),
                "Strength Reduction",
                "Replaced expensive operation with cheaper equivalent");

        out.push_back(instr);
    }
    return out;
}

// ══════════════════════════════════════════════════════════
//  Pass 7 — Loop Unrolling
//  for (i=0; i<N; i++) { body }  with N ≤ 4 → N copies of body
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passLoopUnrolling(const std::vector<TACInstr>& in) {
    static const long long MAX_TRIP = 4;

    for (size_t i = 0; i + 5 < in.size(); i++) {
        // [i]   counter = const_init
        if ((in[i].op != TACOp::ASSIGN && in[i].op != TACOp::COPY) ||
            isTempVar(in[i].result) || !isConstant(in[i].arg1) || !in[i].arg2.empty())
            continue;
        std::string counter = in[i].result;
        long long initVal;
        try { initVal = std::stoll(in[i].arg1); } catch (...) { continue; }
        if (initVal < 0) continue;

        // [i+1] L_start:
        size_t j = i + 1;
        if (in[j].op != TACOp::LABEL) continue;
        std::string loopStartLabel = in[j].result;

        // [i+2] t_cmp = counter < bound
        size_t k = j + 1;
        if (k >= in.size() || in[k].op != TACOp::LT ||
            in[k].arg1 != counter || !isConstant(in[k].arg2)) continue;
        long long bound;
        try { bound = std::stoll(in[k].arg2); } catch (...) { continue; }
        long long tripCount = bound - initVal;
        if (tripCount <= 0 || tripCount > MAX_TRIP) continue;
        std::string cmpTemp = in[k].result;

        // [i+3] ifnot t_cmp goto L_end
        size_t l = k + 1;
        if (l >= in.size() || in[l].op != TACOp::JUMP_IFNOT || in[l].arg1 != cmpTemp) continue;
        std::string loopEndLabel = in[l].arg2;

        // Find: counter = counter + 1, goto L_start, L_end:
        size_t incIdx = in.size(), backJumpIdx = in.size(), endLabelIdx = in.size();
        for (size_t m = l + 1; m < in.size(); m++) {
            if (incIdx == in.size() && in[m].op == TACOp::ADD &&
                in[m].result == counter && in[m].arg1 == counter && in[m].arg2 == "1")
                incIdx = m;
            if (in[m].op == TACOp::JUMP && in[m].arg1 == loopStartLabel) {
                backJumpIdx = m; break;
            }
            if (in[m].op == TACOp::FUNC_BEGIN || in[m].op == TACOp::FUNC_END) break;
        }
        if (incIdx == in.size() || backJumpIdx == in.size() || incIdx > backJumpIdx) continue;

        for (size_t m = backJumpIdx + 1; m < in.size(); m++) {
            if (in[m].op == TACOp::LABEL && in[m].result == loopEndLabel) {
                endLabelIdx = m; break;
            }
        }
        if (endLabelIdx == in.size()) continue;

        // Collect body (between branch and increment, skip inner labels)
        std::vector<TACInstr> body;
        bool safeBody = true;
        for (size_t m = l + 1; m < incIdx; m++) {
            auto op = in[m].op;
            if (op == TACOp::CALL || op == TACOp::RETURN ||
                op == TACOp::JUMP || op == TACOp::JUMP_IF || op == TACOp::JUMP_IFNOT) {
                safeBody = false; break;
            }
            if (in[m].result == counter) { safeBody = false; break; }
            if (op != TACOp::LABEL) body.push_back(in[m]);
        }
        if (!safeBody) continue;

        // Build unrolled instructions
        recordChange(in[i].id,
            "loop " + counter + "=[" + std::to_string(initVal) + "," + std::to_string(bound) + ")",
            "unrolled " + std::to_string(tripCount) + " copies",
            "Loop Unrolling",
            "Trip count " + std::to_string(tripCount) + " ≤ " + std::to_string(MAX_TRIP));

        std::vector<TACInstr> result;
        for (size_t m = 0; m < i; m++) result.push_back(in[m]);

        for (long long iter = initVal; iter < bound; iter++) {
            std::string iterStr = std::to_string(iter);
            std::string suffix  = "_u" + std::to_string(iter);
            for (auto bi : body) {
                if (bi.arg1 == counter) bi.arg1 = iterStr;
                if (bi.arg2 == counter) bi.arg2 = iterStr;
                auto ren = [&](std::string& s) { if (isTempVar(s)) s += suffix; };
                ren(bi.result); ren(bi.arg1); ren(bi.arg2);
                result.push_back(bi);
            }
        }

        for (size_t m = endLabelIdx + 1; m < in.size(); m++) result.push_back(in[m]);
        for (size_t m = 0; m < result.size(); m++) result[m].id = (int)(m + 1);
        return result;
    }
    return in;
}

// ══════════════════════════════════════════════════════════
//  Pass 8 — Function Inlining
//  Replace call to small functions with their body inline
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passFunctionInlining(const std::vector<TACInstr>& in) {
    static const int MAX_BODY = 8;

    // Build function table: name → (params, body)
    struct FuncInfo {
        std::vector<std::string> params;
        std::vector<std::string> paramTypes;
        std::vector<TACInstr>    body;
    };
    std::unordered_map<std::string, FuncInfo> funcs;

    std::string cur;
    FuncInfo curInfo;
    bool inFunc = false;
    for (const auto& instr : in) {
        if (instr.op == TACOp::FUNC_BEGIN) {
            cur = instr.result; curInfo = {}; inFunc = true;
        } else if (instr.op == TACOp::FUNC_END) {
            funcs[cur] = curInfo; inFunc = false;
        } else if (inFunc) {
            // PARAM with result = parameter name (declaration, not argument push)
            if (instr.op == TACOp::PARAM && !instr.result.empty()) {
                curInfo.params.push_back(instr.result);
                curInfo.paramTypes.push_back(instr.arg1);
            } else {
                curInfo.body.push_back(instr);
            }
        }
    }

    std::vector<TACInstr> out;
    for (size_t i = 0; i < in.size(); i++) {
        if (in[i].op != TACOp::CALL) { out.push_back(in[i]); continue; }

        std::string funcName = in[i].arg1;
        int argCount = 0;
        try { argCount = std::stoi(in[i].arg2); } catch (...) {}

        auto it = funcs.find(funcName);
        bool eligible = it != funcs.end() &&
                        funcName != "main" &&
                        (int)it->second.body.size() <= MAX_BODY &&
                        argCount == (int)it->second.params.size();

        if (eligible) {
            // Last argCount instructions in out must all be argument PARAMs (result == "")
            bool simpleArgs = (int)out.size() >= argCount;
            for (int k = 0; simpleArgs && k < argCount; k++) {
                auto& p = out[out.size() - argCount + k];
                if (p.op != TACOp::PARAM || !p.result.empty()) simpleArgs = false;
            }

            if (simpleArgs) {
                std::vector<std::string> argVals;
                size_t paramStart = out.size() - argCount;
                for (size_t k = paramStart; k < out.size(); k++)
                    argVals.push_back(out[k].arg1);
                out.erase(out.begin() + paramStart, out.end());

                auto& fi = it->second;
                std::string suffix = "_i" + std::to_string(++inlineCount_);
                std::unordered_map<std::string, std::string> pmap;
                for (size_t k = 0; k < fi.params.size(); k++) {
                    bool byRef = k < fi.paramTypes.size() &&
                                 !fi.paramTypes[k].empty() &&
                                 fi.paramTypes[k].back() == '&';
                    if (byRef) {
                        pmap[fi.params[k]] = argVals[k];
                    } else {
                        std::string localParam = fi.params[k] + suffix;
                        pmap[fi.params[k]] = localParam;
                        out.emplace_back(
                            0,
                            TACOp::COPY,
                            localParam,
                            argVals[k],
                            "",
                            "inline param copy " + fi.params[k],
                            in[i].line
                        );
                    }
                }

                for (auto bi : fi.body) {
                    auto sub = [&](std::string& s) {
                        auto p = pmap.find(s);
                        if (p != pmap.end()) s = p->second;
                        else if (isTempVar(s)) s += suffix;
                    };
                    sub(bi.result); sub(bi.arg1); sub(bi.arg2);

                    if (bi.op == TACOp::RETURN) {
                        if (!in[i].result.empty() && !bi.arg1.empty()) {
                            bi.op = TACOp::COPY;
                            bi.result = in[i].result;
                            bi.arg2   = "";
                            out.push_back(bi);
                        }
                    } else {
                        out.push_back(bi);
                    }
                }

                recordChange(in[i].id, in[i].toString(),
                    "[inlined " + funcName + "]",
                    "Function Inlining",
                    "Inlined " + funcName + " (" + std::to_string(fi.body.size()) + " instrs)");
                continue;
            }
        }
        out.push_back(in[i]);
    }

    for (size_t k = 0; k < out.size(); k++) out[k].id = (int)(k + 1);
    return out;
}

// ══════════════════════════════════════════════════════════
//  Pass 9 — Peephole Optimization
//  Window-based local patterns: useless jumps, dead branches
// ══════════════════════════════════════════════════════════

std::vector<TACInstr> Optimizer::passPeephole(const std::vector<TACInstr>& in) {
    std::vector<TACInstr> out = in;
    bool changed = true;

    while (changed) {
        changed = false;
        for (size_t i = 0; i < out.size(); i++) {

            // x = x  (self-assignment) → remove
            if ((out[i].op == TACOp::ASSIGN || out[i].op == TACOp::COPY) &&
                !out[i].result.empty() && out[i].result == out[i].arg1 &&
                out[i].arg2.empty()) {
                recordChange(out[i].id, out[i].toString(), "-- REMOVED (self-assign) --",
                    "Peephole", out[i].result + " = " + out[i].result + " is a no-op");
                out.erase(out.begin() + i);
                changed = true; break;
            }

            // goto L immediately followed by L: → remove goto
            if (out[i].op == TACOp::JUMP &&
                i + 1 < out.size() &&
                out[i+1].op == TACOp::LABEL &&
                out[i+1].result == out[i].arg1) {
                recordChange(out[i].id, out[i].toString(), "-- REMOVED (jump to next) --",
                    "Peephole", "goto jumps to the immediately following label");
                out.erase(out.begin() + i);
                changed = true; break;
            }

            // if 1 goto L → goto L  (always taken)
            if (out[i].op == TACOp::JUMP_IF && out[i].arg1 == "1") {
                std::string before = out[i].toString();
                out[i].op = TACOp::JUMP; out[i].arg1 = out[i].arg2; out[i].arg2 = "";
                recordChange(out[i].id, before, out[i].toString(),
                    "Peephole", "if 1 → unconditional jump");
                changed = true;
            }

            // ifnot 0 goto L → goto L  (always taken)
            if (out[i].op == TACOp::JUMP_IFNOT && out[i].arg1 == "0") {
                std::string before = out[i].toString();
                out[i].op = TACOp::JUMP; out[i].arg1 = out[i].arg2; out[i].arg2 = "";
                recordChange(out[i].id, before, out[i].toString(),
                    "Peephole", "ifnot 0 → unconditional jump");
                changed = true;
            }

            // if 0 goto L → remove  (never taken)
            if (out[i].op == TACOp::JUMP_IF && out[i].arg1 == "0") {
                recordChange(out[i].id, out[i].toString(), "-- REMOVED (never taken) --",
                    "Peephole", "if 0 is never taken");
                out.erase(out.begin() + i);
                changed = true; break;
            }

            // ifnot 1 goto L → remove  (never taken)
            if (out[i].op == TACOp::JUMP_IFNOT && out[i].arg1 == "1") {
                recordChange(out[i].id, out[i].toString(), "-- REMOVED (never taken) --",
                    "Peephole", "ifnot 1 is never taken");
                out.erase(out.begin() + i);
                changed = true; break;
            }

            // t = x; immediately followed by t2 = t (COPY of a temp used only once)
            if (i + 1 < out.size() &&
                !out[i].result.empty() && isTempVar(out[i].result) &&
                out[i+1].op == TACOp::COPY &&
                out[i+1].arg1 == out[i].result) {
                // Count all uses of out[i].result
                int uses = 0;
                for (size_t k = i + 1; k < out.size(); k++) {
                    if (out[k].arg1 == out[i].result || out[k].arg2 == out[i].result) uses++;
                    if (out[k].result == out[i].result) break; // redefined
                }
                if (uses == 1) {
                    std::string before = out[i+1].toString();
                    out[i+1].op   = out[i].op;
                    out[i+1].arg1 = out[i].arg1;
                    out[i+1].arg2 = out[i].arg2;
                    recordChange(out[i+1].id, before, out[i+1].toString(),
                        "Peephole", "eliminated single-use temp " + out[i].result);
                    out.erase(out.begin() + i);
                    changed = true; break;
                }
            }
        }
    }

    for (size_t k = 0; k < out.size(); k++) out[k].id = (int)(k + 1);
    return out;
}

// ══════════════════════════════════════════════════════════
//  JSON escape
// ══════════════════════════════════════════════════════════

std::string Optimizer::escapeJSON(const std::string& s) const {
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
//  JSON output
// ══════════════════════════════════════════════════════════

std::string Optimizer::toJSON() const {
    std::ostringstream out;
    out << "{\n";

    // Optimized instructions
    out << "  \"optimized_tac\": [\n";
    for (size_t i = 0; i < optimized_.size(); i++) {
        out << "    " << optimized_[i].toJSON();
        if (i + 1 < optimized_.size()) out << ",";
        out << "\n";
    }
    out << "  ],\n";

    // Changes log
    out << "  \"opt_changes\": [\n";
    for (size_t i = 0; i < changes_.size(); i++) {
        const auto& c = changes_[i];
        out << "    {"
            << "\"instrId\": " << c.instrId          << ", "
            << "\"before\": \""  << escapeJSON(c.before) << "\", "
            << "\"after\": \""   << escapeJSON(c.after)  << "\", "
            << "\"pass\": \""    << escapeJSON(c.pass)   << "\", "
            << "\"reason\": \""  << escapeJSON(c.reason) << "\""
            << "}";
        if (i + 1 < changes_.size()) out << ",";
        out << "\n";
    }
    out << "  ],\n";

    // Stats
    out << "  \"opt_stats\": {\n";
    out << "    \"original_count\": "  << original_.size()   << ",\n";
    out << "    \"optimized_count\": " << optimized_.size()  << ",\n";
    out << "    \"removed_count\": "   << (original_.size() > optimized_.size()
                                           ? original_.size() - optimized_.size()
                                           : 0)              << ",\n";
    out << "    \"changes_count\": "   << changes_.size()    << "\n";
    out << "  }\n";
    out << "}";
    return out.str();
}

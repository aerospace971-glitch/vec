#pragma once
#include "irgen.hpp"
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>

// ── Optimization pass types ────────────────────────────────
enum class OptPass {
    CONSTANT_FOLDING,
    CONSTANT_PROPAGATION,
    COPY_PROPAGATION,
    DEAD_CODE_ELIMINATION,
    COMMON_SUBEXPR_ELIMINATION,
    STRENGTH_REDUCTION,
};

// ── Single optimization change record ─────────────────────
struct OptChange {
    int         instrId;
    std::string before;
    std::string after;
    std::string pass;
    std::string reason;
};

// ── Optimizer ──────────────────────────────────────────────
class Optimizer {
public:
    Optimizer();

    // Main entry — pass TAC instructions
    void optimize(const std::vector<TACInstr>& instrs);

    // Results
    const std::vector<TACInstr>& optimized() const { return optimized_; }
    const std::vector<OptChange>& changes()  const { return changes_;   }

    // Stats
    int originalCount()  const { return original_.size();  }
    int optimizedCount() const { return optimized_.size(); }
    int removedCount()   const { return originalCount() - optimizedCount(); }

    // JSON output
    std::string toJSON() const;

private:
    std::vector<TACInstr>  original_;
    std::vector<TACInstr>  optimized_;
    std::vector<OptChange> changes_;
    int                    inlineCount_ = 0;

    // ── Pass implementations ───────────────────────────────
    std::vector<TACInstr> passConstantFolding       (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passConstantPropagation   (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passCopyPropagation       (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passDeadCodeElimination   (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passCSE                   (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passStrengthReduction     (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passLoopUnrolling         (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passFunctionInlining      (const std::vector<TACInstr>& in);
    std::vector<TACInstr> passPeephole              (const std::vector<TACInstr>& in);

    // ── Helpers ───────────────────────────────────────────
    bool        isConstant   (const std::string& val)  const;
    bool        isNumeric    (const std::string& val)  const;
    double      toNumber     (const std::string& val)  const;
    std::string foldBinary   (const std::string& op,
                              const std::string& a,
                              const std::string& b)    const;
    bool        isTempVar    (const std::string& name) const;
    std::string escapeJSON   (const std::string& s)    const;
    void        recordChange (int id,
                              const std::string& before,
                              const std::string& after,
                              const std::string& pass,
                              const std::string& reason);
};
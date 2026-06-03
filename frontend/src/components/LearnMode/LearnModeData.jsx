// src/components/LearnMode/LearnModeData.jsx
const PHASE_DATA = {
  lex: {
    title: "Lexical Analysis",
    label: "PHASE 01 — LEXICAL ANALYSIS",
    tagline: "The compiler's first reader — speaks characters, thinks tokens",
    tabs: ["Theory", "Concepts", "Description", "Interactive"],
    theory: {
      quote: "The lexer converts raw source text into a stream of typed tokens.",
      bigPicture: "Humans write code as free-form text. Compilers need structure. The lexer bridges this gap by scanning raw characters and grouping them into meaningful atomic units called tokens - the words of the programming language.",
      keyInsight: "The lexer is pattern-blind to grammar. It recognizes 'if' as a keyword and '123' as a number, but never asks whether they are used correctly.",
      howItWorks: [
        "Read source code one character at a time",
        "Try to match current characters against token patterns",
        "When a pattern matches, emit a token with type, value, and line position",
        "Skip whitespace and comments because they carry no semantic meaning",
        "On unrecognized character, emit a lexical error with location",
        "Return EOF_TOKEN when source code is fully consumed",
      ],
      input: "Raw source code string",
      output: "Stream of typed tokens",
      nextPhase: "parse",
      nextLabel: "Tokens flow into Parser →",
    },
    concepts: [
          {
            term: "Token",
            def: "Smallest meaningful unit - keyword, identifier, operator, literal",
            example: "[int] KEYWORD\n[main] IDENTIFIER\n[=] OPERATOR\n[10] INTEGER",
            detail: "A token has two parts: its type and its value. For example, type=KEYWORD, value='if'. The lexer emits one token per recognized pattern match.",
            misconception: "Tokens are not just keywords. Operators, literals, identifiers, and punctuation are all tokens."
          },

          {
            term: "Lexeme",
            def: "Actual character sequence from source that matched a token pattern",
            example: 'lexeme = "factorial" -> token type = IDENTIFIER',
            detail: "The lexeme is the raw string from source. The token is the structured representation of that lexeme with type information attached.",
            misconception: ""
          },

          {
            term: "Pattern",
            def: "Regular expression rule describing what a token looks like",
            example: "IDENTIFIER: [a-zA-Z_][a-zA-Z0-9_]*",
            detail: "Each token type has a recognition rule. The lexer tries patterns in priority order, such as keywords before identifiers.",
            misconception: ""
          },

          {
            term: "Lexical error",
            def: "Unrecognized character that matches no token pattern",
            example: "",
            detail: "When no pattern recognizes a character sequence, the lexer emits a lexical error with line and column, then tries to recover.",
            misconception: "Lexical errors are different from parse errors; they happen before grammar checking."
          },

          {
            term: "DFA",
            def: "Deterministic Finite Automaton - state machine that recognizes tokens",
            example: "START --letter--> IDENT --letter/digit--> IDENT\nSTART --digit--> INTEGER --digit--> INTEGER\nIDENT accept => IDENTIFIER or KEYWORD",
            detail: "A lexer can be implemented as a DFA with states like START, IDENT, INTEGER, and STRING. Accept states emit tokens. The key promise is determinism: for each state and next character, there is one clear transition.",
            misconception: ""
          },

          {
            term: "Whitespace handling",
            def: "Spaces, tabs, and newlines are skipped by the lexer",
            example: "int   x=10; -> same as int x = 10;",
            detail: "Whitespace helps humans read source code, but the parser usually only needs the token order. The lexer consumes whitespace to find the next real lexeme and updates line/column positions for error messages.",
            misconception: "Whitespace separates tokens but usually does not become a token itself."
          },

          {
            term: "Longest match rule",
            def: "Lexer always chooses the longest valid token",
            example: "== matches as EQ_OP, not two ASSIGN tokens",
            detail: "The scanner keeps reading while a longer valid token is possible. This prevents multi-character operators like <=, >=, ==, !=, ++, and -- from being split too early.",
            misconception: "The lexer does not stop at the first valid match if a longer one exists."
          },

          {
            term: "Keyword priority",
            def: "Keywords are recognized before identifiers",
            example: "if -> KW_IF (not IDENTIFIER)",
            detail: "Most keywords also fit the identifier regular expression, so lexer priority decides their final token type. After recognizing a word-like lexeme, the lexer checks the keyword table before emitting IDENTIFIER.",
            misconception: "You cannot use keywords as variable names because the lexer recognizes them as keywords first."
          },

          {
            term: "Token stream",
            def: "Sequence of tokens produced by the lexer",
            example: "[KW_INT][IDENT:x][ASSIGN][INT:10][SEMI]",
            detail: "The parser does not read raw characters. It advances through this stream, peeking at token types and values to decide which grammar rule applies next.",
            misconception: "The parser works on tokens, not directly on source code characters."
          },

          {
            term: "Tokenization error recovery",
            def: "Lexer continues scanning after encountering an invalid character",
            example: "int x$ = 10; -> error on '$', rest tokenized normally",
            detail: "Recovery keeps one typo from hiding every later token. The lexer records the bad character and location, then resumes at the next character so later phases can still show useful feedback.",
            misconception: "A lexical error does not necessarily stop compilation immediately."
          }
        ],
  },
  parse: {
    title: "Syntax Analysis",
    label: "PHASE 02 — SYNTAX ANALYSIS",
    tagline: "Grammar enforcer — speaks tokens, thinks structure",
    tabs: ["Theory", "Concepts", "Description", "Interactive"],
    theory: {
      quote: "The parser checks grammar and builds an Abstract Syntax Tree.",
      bigPicture: "The parser receives a flat stream of tokens and checks whether they form a grammatically valid program. If valid, it builds an Abstract Syntax Tree - a hierarchical data structure capturing the meaning and structure of the program. Every subsequent compiler phase works with this tree.",
      keyInsight: "The AST removes syntactic noise. 'int x = 5 + 3;' becomes a VarDecl node containing a BinaryExpr node. Semicolons, spaces, and parentheses disappear - only structure and meaning remain.",
      howItWorks: ["Receive token stream from lexer", "Apply grammar rules using recursive descent parsing","Each grammar rule becomes one parsing function",
                   "On valid input, build and return an AST node with children", "On invalid token, emit parse error and attempt recovery", "Return root Program node containing top-level declarations",],
      input: "Token stream from Lexer",
      output: "Abstract Syntax Tree (AST)",
      nextPhase: "semantic",
      nextLabel: "AST flows into Semantic Analysis →",
    },
    concepts:[
      {
        term: "Grammar",
        def: "Formal rules defining valid token sequences",
        example: "VarDecl -> TYPE IDENTIFIER = Expr ;",
        detail: "A grammar is a set of production rules. The parser applies these rules recursively to check and structure the token stream.",
        misconception: ""
      },

      {
        term: "AST",
        def: "Hierarchical representation of program structure",
        example: "",
        detail: "The AST captures essential structure without syntactic details. Each node represents a construct such as FunctionDecl, BinaryExpr, or VarDecl.",
        misconception: "AST is not the same as parse tree. AST removes redundant grammar nodes."
      },

      {
        term: "Recursive descent",
        def: "Parsing strategy where each grammar rule is one function",
        example: "parseFunctionDecl() -> parseParamList()",
        detail: "Each grammar rule is implemented as a function. Functions call one another following the grammar hierarchy, making the parser intuitive and easy to debug.",
        misconception: ""
      },

      {
        term: "Parse error",
        def: "Token that violates grammar at that position",
        example: "int = x;",
        detail: "When the parser expects one token but finds another, it emits a parse error and may skip to a safe synchronization point.",
        misconception: "Parse errors occur after tokenization. The lexer may succeed even when parsing fails."
      },

      {
        term: "Node",
        def: "Single AST element representing one construct",
        example: "BinaryExpr(+), VarDecl(x), FunctionDecl(main)",
        detail: "Every AST node has a type, optional value, source location, and children. The root node is usually Program.",
        misconception: "A node is not a token. Nodes represent higher-level language constructs."
      }
    ],
  },
  semantic: {
    title: "Semantic Analysis",
    label: "PHASE 03 — SEMANTIC ANALYSIS",
    tagline: "Meaning checker — types, scopes, and symbols",
    tabs: ["Theory", "Concepts", "Description", "Interactive"],
    theory: {
      quote: "Semantic analysis checks meaning - things grammar cannot check.",
      bigPicture: "Even syntactically correct programs can be semantically wrong. Adding a string to an integer, using a variable before declaring it, or returning the wrong type are semantic errors. The semantic analyzer walks the AST and checks that the program actually makes sense.",
      keyInsight: "Semantic analysis builds the Symbol Table - a directory of every declared name, its type, and its scope. Every subsequent phase consults this table to understand what each identifier means.",
      howItWorks: [
        "Walk the AST in depth-first order",
        "For every declaration, add a symbol with type and scope",
        "For every identifier use, look up the symbol table",
        "For every operation, check operand type compatibility",
        "For every return statement, verify function return type",
       "Report semantic errors with precise location and explanation",
      ], 
      input: "AST + empty symbol table",
      output: "Annotated AST + filled symbol table",
      nextPhase: "ir",
      nextLabel: "Annotated AST flows into IR Generation →",
    },
    concepts: [
        {
          term: "Symbol table",
          def: "Maps identifiers to type, scope, and attributes",
          example: "{ name: 'sum', kind: 'variable', type: 'int', scope: 1 }",
          detail: "The symbol table answers: Does this name exist? What type is it? Is it in scope? It is built during semantic analysis and used later.",
          misconception: ""
        },

        {
          term: "Type checking",
          def: "Verifies operations use compatible types",
          example: "int + int ✓\nstring + int ✗",
          detail: "Every expression is checked to ensure operands, assignments, function arguments, and return values use compatible types.",
          misconception: "Type checking covers variables, expressions, function arguments, and return statements."
        },

        {
          term: "Scope",
          def: "Region where a declared name is visible",
          example: "int x=1; { int x=2; }",
          detail: "C++ has nested scopes. Names declared in an inner scope are visible only within that scope and its children.",
          misconception: "Inner scope variables do not overwrite outer ones; they shadow them."
        },

        {
          term: "Semantic error",
          def: "Syntactically correct but meaningless program",
          example: "x = 10; // x not declared",
          detail: "Undeclared variables, wrong argument types, invalid assignments, and incorrect return statements pass parsing but fail semantic analysis.",
          misconception: "A program can have no syntax errors and still fail semantic analysis."
        }
      ],
  },
  ir: {
    title: "IR Generation",
    label: "PHASE 04 — INTERMEDIATE REPRESENTATION",
    tagline: "Flatten AST to three-address code",
    tabs: ["Theory", "Concepts", "Description", "Interactive"],
    theory: {
      quote: "The IR generator flattens the AST into simple three-address code.",
      bigPicture: "The IR generator translates the hierarchical AST into a linear sequence of simple instructions called Three-Address Code. Each TAC instruction has at most one operator and three operands, making the format much easier to optimize than a tree.",
      keyInsight: "TAC introduces temporary variables like t1 and t2. 'a + b * c' becomes multiple instructions. This looks inefficient but gives the optimizer room to reorganize and simplify.",
      howItWorks: [
      "Walk the AST recursively",
      "For expressions, generate temporaries and arithmetic instructions",
      "For if and while, generate labels and conditional jumps",
      "For function calls, emit param instructions followed by call",
      "For assignments, emit copy instruction to store result",
      "Return the complete TAC instruction list",
    ],
      input: "Annotated AST",
      output: "Three-Address Code instruction list",
      nextPhase: "opt",
      nextLabel: "TAC flows into Optimizer →",
    },
    concepts: [
      {
        term: "TAC",
        def: "Three-Address Code with max one operator and three names",
        example: "t1 = b * c\nx = a + t1",
        detail: "Complex expressions are decomposed into simple instructions.",
        misconception: ""
      },

      {
        term: "Temporary",
        def: "Compiler-generated variable for intermediate values",
        example: "t1 = b * c",
        detail: "Temporaries exist only in IR and are later assigned to registers, memory, or removed.",
        misconception: "Temporary variables are created by the compiler, not written by the programmer."
      },

      {
        term: "Label",
        def: "Named position in TAC for jumps and branches",
        example: "L1:\n  t1 = i <= 10\n  ifnot t1 goto L3",
        detail: "Labels mark targets of jump instructions and make structured control flow possible in flat TAC.",
        misconception: "Labels do not store values; they only identify code locations."
      },

      {
        term: "Basic block",
        def: "Maximal TAC sequence with no jumps except at ends",
        example: "t1 = a + b\nt2 = t1 * c\nif t2 goto L1",
        detail: "A basic block executes sequentially from start to finish without branching except at its entry and exit.",
        misconception: "A basic block can contain many instructions, but control cannot enter or leave in the middle."
      }
    ],
  },
  opt: {
    title: "Optimization",
    label: "PHASE 05 — OPTIMIZATION",
    tagline: "Make code faster without changing behavior",
    tabs: ["Theory", "Concepts", "Description", "Interactive"],
    theory: {
      quote: "The optimizer improves code without changing what it does.",
      bigPicture: "The optimizer applies transformation passes to TAC, each targeting a specific type of inefficiency. The same source code can run much faster after optimization without the programmer changing anything.",
      keyInsight: "Optimization passes compose. Constant propagation can enable constant folding, which can enable dead code elimination. Pass ordering matters enormously.",
      howItWorks: [
        "Receive unoptimized TAC instruction list",
        "Run Constant Propagation",
        "Run Constant Folding",
        "Run Dead Code Elimination",
        "Run Copy Propagation",
        "Emit optimized TAC with identical semantics",
      ],
      input: "Unoptimized TAC",
      output: "Optimized TAC",
      nextPhase: "codegen",
      nextLabel: "Optimized TAC flows into Code Generation →",
    },
    concepts: [
      {
        term: "Constant folding",
        def: "Evaluate constant expressions at compile time",
        example: "BEFORE: t1 = 3 + 4\nAFTER:  t1 = 7",
        detail: "If operands are constants, compute the result during compilation.",
        misconception: ""
      },

      {
        term: "Constant propagation",
        def: "Replace variables holding known constants",
        example: "x = 5\nt1 = x + 3 -> t1 = 5 + 3",
        detail: "If a variable is assigned a constant and never changed, uses can be replaced with that constant.",
        misconception: "Constant propagation does not evaluate expressions by itself; it only substitutes known constant values."
      },

      {
        term: "Dead code elimination",
        def: "Remove instructions whose results are never used",
        example: "t1 = a + b // never used\n→ removed",
        detail: "Reachable instructions can still be dead if their result is never consumed.",
        misconception: "Dead code does not only mean unreachable code."
      },

      {
        term: "Copy propagation",
        def: "Replace copy variables with original variables",
        example: "x = y\nz = x + 1\n→ z = y + 1",
        detail: "If x = y, later uses of x can often become y, exposing more dead code.",
        misconception: "Copy propagation does not remove copies directly; it simplifies later uses so other optimizations can remove them."
      }
    ],
  },
  codegen: {
    title: "Code Generation",
    label: "PHASE 06 — CODE GENERATION",
    tagline: "Target assembly and registers",
    tabs: ["Theory", "Concepts", "Description", "Interactive"],
    theory: {
      quote: "Code generation translates optimized TAC into target assembly.",
      bigPicture: "Code generation is the final phase. It translates optimized TAC into machine-like instructions. The key challenge is register allocation: deciding which values live in fast registers R0-R7 versus slower memory.",
      keyInsight: "Every TAC temporary must map to a register or memory. When registers are full, the generator spills to memory, which good allocation tries to minimize.",
      howItWorks: [
        "For each function, emit prologue instructions",
        "For each TAC instruction, select the VRM instruction",
        "Assign temporaries and variables to registers R0-R7",
        "When registers are full, spill to stack memory",
        "For function calls, push args and emit CALL",
        "Emit epilogue and return instructions",
      ],
      input: "Optimized TAC",
      output: "VRM assembly instructions",
      nextPhase: null,
      nextLabel: "Assembly runs in Runtime",
    },
    concepts: [
      {
        term: "Register allocation",
        def: "Assign variables to CPU registers",
        example: "t1 → R1\nt2 → R2",
        detail: "Registers are fastest. The code generator tries to keep frequently used values in CPU registers instead of memory.",
        misconception: "Not every variable gets its own register; registers are limited."
      },

      {
        term: "Instruction selection",
        def: "Choose machine instructions for each TAC operation",
        example: "t1 = a + b\n→ ADD R1, R2",
        detail: "TAC operations are translated into one or more target-machine instructions.",
        misconception: "One TAC instruction may require multiple machine instructions."
      },

      {
        term: "Spilling",
        def: "Store register values to memory when registers are full",
        example: "PUSH R3\nPOP R3",
        detail: "When there are more live variables than available registers, some values are temporarily moved to memory.",
        misconception: "Spilling is expensive because memory access is slower than register access."
      },

      {
        term: "Prologue/Epilogue",
        def: "Code emitted at function entry and exit",
        example: "PUSH BP\nMOV BP, SP\n...\nMOV SP, BP\nPOP BP\nRET",
        detail: "The prologue sets up the stack frame and saves state. The epilogue restores state and returns control to the caller.",
        misconception: "Prologue and epilogue are generated by the compiler, not written explicitly in most high-level code."
      }
    ],
  },
};

export default PHASE_DATA;

/**
 * VEC Compiler — C++ Error & Impact Database
 *
 * Each entry describes one class of error the VEC compiler can emit.
 * `pattern` matches against the raw error message string (case-insensitive).
 * `impact`  explains the downstream consequence of leaving this error unfixed.
 */

// ─────────────────────────────────────────────────────────────────
// LEXER ERRORS
// ─────────────────────────────────────────────────────────────────

export const LEXER_ERRORS = [
  {
    id: "LEX001",
    phase: "lex",
    category: "Unterminated Literal",
    pattern: /unterminated string literal/i,
    title: "Unterminated String Literal",
    description:
      'A string opened with `"` was never closed before the end of the line. C++ string literals cannot span multiple lines without a line-continuation character.',
    cause: 'Missing closing `"`, or accidental newline inside the string.',
    impact:
      "The lexer merges the rest of the line (and possibly more) into one broken token. All subsequent tokens become invalid, triggering a cascade of parser errors and making the entire file uncompilable.",
    fix: 'Add the closing `"` on the same line. For multi-line strings use raw literals: R"(...)".  ',
    example: 'cout << "Hello World;  // ← missing closing "',
    severity: "error",
  },
  {
    id: "LEX002",
    phase: "lex",
    category: "Unterminated Literal",
    pattern: /unterminated character literal/i,
    title: "Unterminated Character Literal",
    description:
      "A character literal opened with `'` was never closed. Character literals must contain exactly one character (or one escape sequence) between two single-quotes.",
    cause: "Missing closing `'`, or more than one character placed between the quotes.",
    impact:
      "The rest of the line is consumed as part of the broken token, corrupting the token stream and causing parse failures everywhere the code uses that character value.",
    fix: "Close with `'`. For special characters use escape sequences: `'\\n'`, `'\\t'`, `'\\\\'`.",
    example: "char c = 'A;  // ← missing closing '",
    severity: "error",
  },
  {
    id: "LEX003",
    phase: "lex",
    category: "Unterminated Comment",
    pattern: /unterminated block comment/i,
    title: "Unterminated Block Comment",
    description:
      "A block comment opened with `/*` was never closed with `*/`. The lexer treats everything from `/*` to the end of the file as comment text.",
    cause: "Missing `*/` to close the comment block.",
    impact:
      "The entire rest of the source file after `/*` is swallowed as comment content. No tokens are emitted for any of that code, so the parser sees an empty (or truncated) program and emits errors for every declaration it expected.",
    fix: 'Close every `/*` with a matching `*/`. Use `//` for single-line comments to avoid this entirely.',
    example: "/* This comment was never closed\nint x = 5;  // ← invisible to the compiler",
    severity: "error",
  },
  {
    id: "LEX004",
    phase: "lex",
    category: "Invalid Character",
    pattern: /unexpected character/i,
    title: "Unexpected Character",
    description:
      "The lexer encountered a character that cannot start or continue any valid C++ token at this position.",
    cause:
      "Copy-paste from a non-ASCII source (curly quotes, em-dashes, zero-width spaces), a typo, or a character from another language's character set.",
    impact:
      "The lexer skips the invalid character but the token it was part of is now broken. This typically causes the parser to see a wrong token type, leading to syntax errors on the same or nearby lines.",
    fix:
      "Delete the character and retype it. Enable 'Show invisibles' or change editor encoding to UTF-8 to spot hidden characters.",
    example: "int x = 5©;  // '©' is not valid C++",
    severity: "error",
  },
];

// ─────────────────────────────────────────────────────────────────
// PARSER / SYNTAX ERRORS
// ─────────────────────────────────────────────────────────────────

export const PARSER_ERRORS = [
  // ── Brackets & braces ──────────────────────────────────────────
  {
    id: "PARSE001",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected '\{'/i,
    title: "Missing Opening Brace `{`",
    description:
      "The parser expected an opening curly brace `{` to begin a block (function body, class body, if/while/for body) but found something else.",
    cause: "Forgot `{` after a function signature, control-flow keyword, or class declaration.",
    impact:
      "The parser cannot determine where the block begins. Subsequent statements are misinterpreted as being outside the block, generating a chain of 'unexpected token' errors for every line inside what was meant to be the block.",
    fix: "Add `{` immediately after the function/class/if/for/while header.",
    example: "void foo()\n    int x = 0;  // ← missing {",
    severity: "error",
  },
  {
    id: "PARSE002",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected '\}'/i,
    title: "Missing Closing Brace `}`",
    description:
      "The parser expected a closing curly brace `}` to end a block but reached the end of the file or a different token first.",
    cause: "Missing `}` to close a function, class, namespace, or control-flow body.",
    impact:
      "Everything after the unclosed `{` is treated as part of the open block. The parser may not report the error until the very end of the file, making the root cause hard to find. All code inside the 'infinite' block is parsed in the wrong scope.",
    fix: "Count `{` and `}` pairs. Use an IDE with bracket matching to find the unmatched one.",
    example: "void foo() {\n    int x = 0;\n// ← missing }",
    severity: "error",
  },
  {
    id: "PARSE003",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected '\('/i,
    title: "Missing Opening Parenthesis `(`",
    description:
      "The parser expected `(` to begin a parameter list, condition expression, or call argument list.",
    cause: "Missing `(` after `if`, `while`, `for`, `switch`, a function name, or `sizeof`.",
    impact:
      "The expression that follows is parsed as a statement rather than a condition or argument, producing type errors and unexpected-token errors on the affected line and the lines that follow.",
    fix: "Add the missing `(`.",
    example: "if x > 0) { ... }  // ← missing opening (",
    severity: "error",
  },
  {
    id: "PARSE004",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected '\)'/i,
    title: "Missing Closing Parenthesis `)`",
    description:
      "The parser expected `)` to close a parameter list, condition, or call argument list.",
    cause: "Missing `)` after an `if`/`while`/`for` condition, after function parameters, or after a function call's argument list.",
    impact:
      "Everything after the unclosed `(` is consumed as part of the expression, causing the code on following lines to be parsed incorrectly and generating multiple spurious errors.",
    fix: "Add the missing `)`. Use bracket matching in your editor.",
    example: "if (x > 0 {\n    // ...\n}  // ← missing )",
    severity: "error",
  },
  {
    id: "PARSE005",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected '\['/i,
    title: "Missing Opening Bracket `[`",
    description: "The parser expected `[` to begin an array size or index expression.",
    cause: "Incomplete array declaration or indexing expression.",
    impact: "The array size or index is not parsed, causing the array type or element access to be misinterpreted.",
    fix: "Add the missing `[` before the size or index expression.",
    example: "int arr]5];  // ← missing [",
    severity: "error",
  },
  {
    id: "PARSE006",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected '\]'/i,
    title: "Missing Closing Bracket `]`",
    description: "The parser expected `]` to close an array size or index expression.",
    cause: "Missing `]` after array size or subscript index.",
    impact:
      "The rest of the statement is parsed as part of the subscript expression, generating cascading type errors.",
    fix: "Add the missing `]`.",
    example: "int arr[5;  // ← missing ]",
    severity: "error",
  },

  // ── Semicolons ─────────────────────────────────────────────────
  {
    id: "PARSE007",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected ';'/i,
    title: "Missing Semicolon `;`",
    description:
      "C++ requires a semicolon `;` at the end of every statement and declaration. The parser found the next token instead.",
    cause:
      "Forgot `;` after a variable declaration, expression statement, return statement, or after a class/struct definition.",
    impact:
      "The parser merges the current statement with the next line, producing confusing 'unexpected token' errors on the following line rather than on the actual missing semicolon line.",
    fix: "Add `;` at the end of the statement. Note: class definitions also need `;` after the closing `}`.",
    example: "int x = 5  // ← missing ;\nint y = 6;",
    severity: "error",
  },
  {
    id: "PARSE008",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected ';' in for loop/i,
    title: "Missing Semicolon in `for` Loop",
    description:
      "A `for` loop requires exactly two semicolons separating its three clauses: `for (init; condition; update)`. One of them is missing.",
    cause: "Wrote a `for` loop with only one semicolon, or used a comma instead of `;`.",
    impact:
      "The for-loop clauses are parsed incorrectly, breaking the loop structure and likely causing the loop body to be treated as outside the loop.",
    fix: "Ensure the `for` header has exactly two semicolons: `for (int i = 0; i < n; i++)`.",
    example: "for (int i = 0, i < n; i++) { }  // ← comma instead of ;",
    severity: "error",
  },

  // ── Identifiers ────────────────────────────────────────────────
  {
    id: "PARSE009",
    phase: "parse",
    category: "Missing Identifier",
    pattern: /expected identifier after type/i,
    title: "Missing Variable / Function Name",
    description:
      "After a type keyword (e.g., `int`, `float`, `MyClass`), the parser expected the name (identifier) of the variable or function being declared.",
    cause: "Type written without a name, or a reserved keyword used as a name.",
    impact:
      "The declaration cannot be completed. The symbol is not added to the symbol table, so any later reference to it will produce 'undeclared identifier' errors.",
    fix: "Add a valid identifier after the type. Avoid reserved keywords as names.",
    example: "int = 5;   // ← variable name is missing",
    severity: "error",
  },

  // ── Keywords ───────────────────────────────────────────────────
  {
    id: "PARSE010",
    phase: "parse",
    category: "Missing Keyword",
    pattern: /expected 'while' after do body/i,
    title: "Missing `while` in `do…while` Loop",
    description: "A `do { … }` block must be followed by `while (condition);`. The `while` keyword is missing.",
    cause: "Wrote `do { }` without the trailing `while (…);`.",
    impact:
      "The parser cannot close the do-while loop. Code after the closing `}` is misinterpreted and errors cascade to end of scope.",
    fix: "Add `while (condition);` after the closing `}` of the do block.",
    example: "do {\n    x++;\n}  // ← missing while (x < 10);",
    severity: "error",
  },
  {
    id: "PARSE011",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected ':' after (case value|default)/i,
    title: "Missing Colon `:` in switch",
    description: "Each `case` value and `default` label in a `switch` statement must be followed by `:`.",
    cause: "Wrote `case 5` or `default` without the required `:`.",
    impact:
      "The parser cannot identify the case label boundary, treating subsequent statements as part of the case expression and generating multiple errors.",
    fix: "Add `:` after `case <value>` or `default`.",
    example: "case 5\n    break;  // ← missing :",
    severity: "error",
  },
  {
    id: "PARSE012",
    phase: "parse",
    category: "Missing Delimiter",
    pattern: /expected ':' in ternary/i,
    title: "Missing `:` in Ternary Expression",
    description: "The ternary operator `? :` requires both `?` (the true branch) and `:` (the false branch).",
    cause: "Wrote `condition ? value` without the `:` and false-branch expression.",
    impact: "The expression after `?` is parsed as the entire remaining expression, leading to type errors and broken assignment.",
    fix: "Complete the ternary: `condition ? trueValue : falseValue`.",
    example: "int x = a > 0 ? a;  // ← missing : and false-branch",
    severity: "error",
  },

  // ── Unexpected tokens ──────────────────────────────────────────
  {
    id: "PARSE013",
    phase: "parse",
    category: "Unexpected Token",
    pattern: /unexpected token .* in expression/i,
    title: "Unexpected Token in Expression",
    description:
      "While parsing an expression, the parser found a token that cannot legally appear at that position.",
    cause:
      "Operator missing between two operands, keyword in wrong position, unmatched delimiter, or expression left incomplete.",
    impact:
      "The expression cannot be evaluated. The surrounding statement is discarded and parsing resumes at the next statement boundary, often generating additional spurious errors.",
    fix: "Check for missing operators (`+`, `*`, `=`), misplaced keywords, or incomplete sub-expressions.",
    example: "int x = 3 5;  // ← missing operator between 3 and 5",
    severity: "error",
  },
];

// ─────────────────────────────────────────────────────────────────
// SEMANTIC ERRORS & WARNINGS
// ─────────────────────────────────────────────────────────────────

export const SEMANTIC_ERRORS = [
  // ── Redeclarations ─────────────────────────────────────────────
  {
    id: "SEM001",
    phase: "semantic",
    category: "Redeclaration",
    pattern: /function '.*' already declared with same signature/i,
    title: "Function Already Declared",
    description:
      "A function with the same name and parameter types was already declared in this scope. C++ does not allow duplicate function definitions with the same signature.",
    cause:
      "Defined the same function twice, or accidentally gave two different functions identical names and parameter lists.",
    impact:
      "Ambiguous function resolution — the linker cannot know which definition to use. IR generation may reference the wrong function, leading to undefined behavior or link errors at runtime.",
    fix:
      "Rename one function, change its parameter types to create a valid overload, or remove the duplicate definition.",
    example:
      "int add(int a, int b) { return a+b; }\nint add(int a, int b) { return a+b; }  // ← duplicate",
    severity: "error",
  },
  {
    id: "SEM002",
    phase: "semantic",
    category: "Redeclaration",
    pattern: /variable '.*' already declared/i,
    title: "Variable Already Declared",
    description:
      "A variable with this name already exists in the current scope. Each identifier must be unique within its scope.",
    cause: "Declared the same variable twice in the same function or block.",
    impact:
      "Subsequent assignments may target the wrong slot in the symbol table, producing incorrect values at runtime. The IR may generate double-initialization code.",
    fix: "Remove the duplicate declaration or rename one of the variables.",
    example: "int x = 5;\nint x = 10;  // ← x already declared",
    severity: "error",
  },
  {
    id: "SEM003",
    phase: "semantic",
    category: "Redeclaration",
    pattern: /parameter '.*' already declared/i,
    title: "Duplicate Parameter Name",
    description: "Two parameters in the same function signature share the same name.",
    cause: "Copy-paste of a parameter without renaming it.",
    impact:
      "Inside the function body, references to the parameter name are ambiguous. The generated code may always read from the first or last parameter slot, giving wrong results.",
    fix: "Give each parameter a unique name.",
    example: "void foo(int x, int x) { }  // ← x appears twice",
    severity: "error",
  },
  {
    id: "SEM004",
    phase: "semantic",
    category: "Redeclaration",
    pattern: /class '.*' already declared/i,
    title: "Class Already Declared",
    description: "A class with this name is declared more than once at the same scope level.",
    cause: "Duplicate class definition, often from accidentally including the same header twice without include guards.",
    impact:
      "The compiler cannot determine which class definition is authoritative. Member layouts, vtables, and any objects of this class type may be corrupted.",
    fix: "Remove the duplicate. For header files use `#pragma once` or `#ifndef` include guards.",
    example: "class Foo { };\nclass Foo { };  // ← duplicate class",
    severity: "error",
  },
  {
    id: "SEM005",
    phase: "semantic",
    category: "Redeclaration",
    pattern: /struct '.*' already declared/i,
    title: "Struct Already Declared",
    description: "A struct with this name is declared more than once at the same scope level.",
    cause: "Duplicate struct definition, often from multiple includes of the same header.",
    impact: "Same as class redeclaration — member layout is ambiguous, leading to memory corruption at runtime.",
    fix: "Remove the duplicate. Use include guards.",
    example: "struct Point { int x; };\nstruct Point { int y; };  // ← duplicate",
    severity: "error",
  },

  // ── Type issues ────────────────────────────────────────────────
  {
    id: "SEM006",
    phase: "semantic",
    category: "Type Mismatch",
    pattern: /possible type mismatch.*variable/i,
    title: "Type Mismatch — Variable Assignment",
    description:
      "The value being assigned to the variable has a different type than the variable was declared with, and the conversion is not guaranteed to be safe.",
    cause:
      "Assigning a `float` to an `int` (truncation), a pointer to an integer, or an incompatible class type.",
    impact:
      "Silent data loss (e.g., `3.9` becomes `3`) or undefined behavior if the types are structurally incompatible. The generated code may silently produce wrong results without any runtime error.",
    fix: "Add an explicit cast if truncation is intentional: `int x = (int)3.9;`. Otherwise fix the types to match.",
    example: "int x = 3.9;  // ← float assigned to int — loses .9",
    severity: "warning",
  },
  {
    id: "SEM007",
    phase: "semantic",
    category: "Type Mismatch",
    pattern: /assignment type mismatch/i,
    title: "Type Mismatch — Assignment",
    description:
      "The right-hand side of an assignment expression does not match the declared type of the left-hand variable.",
    cause: "Assigning a string to a numeric variable, a pointer to a value type, or incompatible struct types.",
    impact:
      "Data corruption at the assignment site. Subsequent uses of the variable read from an incorrectly typed memory slot, making computation results unpredictable.",
    fix: "Ensure both sides of `=` have compatible types, or add an explicit conversion.",
    example: 'int age = "twenty";  // ← string assigned to int',
    severity: "warning",
  },
  {
    id: "SEM008",
    phase: "semantic",
    category: "Type Mismatch",
    pattern: /return type mismatch/i,
    title: "Return Type Mismatch",
    description:
      "The value returned by the `return` statement does not match the declared return type of the function.",
    cause: "Function declared as returning `int` but returns a `float`, `bool`, or pointer.",
    impact:
      "The calling code reads a value of the wrong type from the return register. If the sizes differ (e.g., returning a pointer from an `int` function), partial bytes are read, corrupting the result.",
    fix: "Change the return type declaration, or cast the return value: `return (int)result;`.",
    example: "int compute() {\n    return 3.14;  // ← float returned from int function\n}",
    severity: "warning",
  },

  // ── Undeclared identifiers ─────────────────────────────────────
  {
    id: "SEM009",
    phase: "semantic",
    category: "Undeclared Identifier",
    pattern: /identifier '.*' may be undeclared/i,
    title: "Possibly Undeclared Identifier",
    description:
      "The name used here was not found in the current scope or any enclosing scope at the time of this reference.",
    cause:
      "Typo in the name, using a variable before declaring it, declaring in a narrower scope (e.g., inside an `if`) and then using it outside, or missing `#include` for a library symbol.",
    impact:
      "The IR generator emits a reference to an undefined symbol. At runtime the symbol resolves to address 0 or a garbage value, causing crashes or wrong output. All expressions that use this identifier are incorrect.",
    fix:
      "Check the spelling. Declare the variable before its first use. Move the declaration to the correct scope.",
    example: "cout << count;  // ← 'count' was never declared",
    severity: "warning",
  },

  // ── Return value issues ────────────────────────────────────────
  {
    id: "SEM010",
    phase: "semantic",
    category: "Missing Return",
    pattern: /return with no value in non-void function/i,
    title: "Return Without Value in Non-void Function",
    description:
      "A `return;` statement with no value was found inside a function whose declared return type is not `void`.",
    cause: "Forgot to provide a return value, or copied a `void` function pattern into a non-void function.",
    impact:
      "The function returns an undefined value (whatever happens to be in the return register). The caller receives garbage, corrupting any variable that stores the result.",
    fix: "Add a meaningful return value: `return 0;` or `return result;`.",
    example: "int getMax() {\n    int x = 5;\n    return;  // ← must return an int\n}",
    severity: "warning",
  },
];

// ─────────────────────────────────────────────────────────────────
// COMBINED EXPORT & LOOKUP
// ─────────────────────────────────────────────────────────────────

export const ALL_CPP_ERRORS = [
  ...LEXER_ERRORS,
  ...PARSER_ERRORS,
  ...SEMANTIC_ERRORS,
];

/**
 * Find the best matching error entry for a given error message.
 * Optionally restrict search to a specific phase ("lex" | "parse" | "semantic").
 * Returns null if no entry matches.
 */
export function lookupError(message, phase = null) {
  if (!message) return null;
  const candidates = phase
    ? ALL_CPP_ERRORS.filter(e => e.phase === phase)
    : ALL_CPP_ERRORS;
  return candidates.find(e => e.pattern.test(message)) ?? null;
}

/**
 * Return a short one-line impact summary for an error message.
 * Safe to call anywhere — returns empty string if no match.
 */
export function getImpact(message, phase = null) {
  const entry = lookupError(message, phase);
  return entry ? entry.impact : "";
}

/**
 * Color for each phase badge.
 */
export const PHASE_COLORS = {
  lex:      "#4488ff",
  parse:    "#aa44ff",
  semantic: "#44aaff",
};

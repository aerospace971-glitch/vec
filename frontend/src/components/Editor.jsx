const TOKEN_COLORS = {
  // Categories → colors
  LITERAL:      "#f78c6c",
  IDENTIFIER:   "#82aaff",
  TYPE:         "#c792ea",
  CONTROL:      "#c3e88d",
  OOP:          "#ffcb6b",
  MEMORY:       "#ff5370",
  MODIFIER:     "#89ddff",
  TEMPLATE:     "#f07178",
  EXCEPTION:    "#ff5370",
  PREPROCESSOR: "#546e7a",
  ARITHMETIC:   "#89ddff",
  ASSIGNMENT:   "#ffffff",
  COMPARISON:   "#89ddff",
  LOGICAL:      "#c3e88d",
  BITWISE:      "#f78c6c",
  INCDEC:       "#ffffff",
  MEMBER:       "#ffffff",
  DELIMITER:    "#ffcb6b",
  PUNCTUATION:  "#546e7a",
  OTHER:        "#546e7a",
};

export { TOKEN_COLORS };

export default function Editor({ value, onChange, errors }) {
  const lines      = value.split("\n");
  const errorLines = new Set(errors.map(e => e.line));

  return (
    <div className="editor-wrapper">

      {/* Line numbers */}
      <div className="line-numbers">
        {lines.map((_, i) => (
          <div
            key={i}
            className={`line-num ${errorLines.has(i + 1) ? "error-line" : ""}`}
            title={errorLines.has(i + 1) ? "Error on this line" : ""}
          >
            {errorLines.has(i + 1) ? "●" : i + 1}
          </div>
        ))}
      </div>

      {/* Source textarea */}
      <textarea
        className="source-editor"
        value={value}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder="Write C++ source code here..."
        onKeyDown={e => {
          // Tab key inserts 4 spaces instead of changing focus
          if (e.key === "Tab") {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end   = e.target.selectionEnd;
            const newVal = value.substring(0, start)
                         + "    "
                         + value.substring(end);
            onChange(newVal);
            // Move cursor after the inserted spaces
            setTimeout(() => {
              e.target.selectionStart = start + 4;
              e.target.selectionEnd   = start + 4;
            }, 0);
          }
        }}
      />
    </div>
  );
}
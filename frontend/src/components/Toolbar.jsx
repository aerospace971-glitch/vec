export default function Toolbar({ onCompile, onLoadExample, examples, loading }) {
  return (
    <div className="toolbar">
      <select
        className="example-select"
        onChange={e => {
          if (e.target.value) {
            onLoadExample(e.target.value);
            e.target.value = "";
          }
        }}
        value=""
      >
        <option value="" disabled>Load example...</option>
        {examples.map(ex => (
          <option key={ex} value={ex}>{ex}</option>
        ))}
      </select>

      <button
        className="compile-btn"
        onClick={onCompile}
        disabled={loading}
      >
        <span className="btn-icon">&#9654;</span>
        {loading ? "Compiling..." : "Compile"}
      </button>
    </div>
  );
}
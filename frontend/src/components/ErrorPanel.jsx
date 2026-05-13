export default function ErrorPanel({ errors, onClose }) {
  return (
    <div className="error-panel">

      {/* Header */}
      <div className="error-header">
        <span>
          &#9888;&nbsp;&nbsp;
          {errors.length} error{errors.length > 1 ? "s" : ""} detected
        </span>
        <button className="error-close" onClick={onClose}>✕</button>
      </div>

      {/* Error list */}
      <div className="error-list">
        {errors.map((e, i) => (
          <div key={i} className="error-item">
            <span className="error-loc">
              {e.line > 0
                ? `Line ${e.line}, Col ${e.col}`
                : "Server Error"}
            </span>
            <span className="error-msg">{e.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
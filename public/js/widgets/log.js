/**
 * log.js - Command Log Widget
 * 
 * Displays: Timestamped log of commands sent to BB
 * Controls: None (receives log entries from other widgets)
 */

(() => {
  // DOM references (set during init)
  let commandLogEl = null;
  let commandStatusEl = null;
  let statusTimer = null;

  // Max log entries to keep
  const MAX_LOG_ENTRIES = 30;

  /**
   * Add a line to the command log
   * @param {string} line - The message to log
   */
  function log(line) {
    if (!commandLogEl) return;

    const ts = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.textContent = `[${ts}] ${line}`;
    commandLogEl.appendChild(div);

    // Trim old entries
    while (commandLogEl.children.length > MAX_LOG_ENTRIES) {
      commandLogEl.removeChild(commandLogEl.firstChild);
    }

    // Auto-scroll to bottom
    commandLogEl.scrollTop = commandLogEl.scrollHeight;
  }

  /**
   * Show a temporary status pill
   * @param {string} text - Status text
   * @param {string} flavor - CSS class: "ok", "pending", "bad", "warn"
   * @param {number} autoClearMs - How long to show (ms)
   */
  function setStatus(text, flavor, autoClearMs = 2500) {
    if (!commandStatusEl) return;

    // Clear any existing timer
    if (statusTimer) clearTimeout(statusTimer);

    commandStatusEl.style.display = "inline-block";
    commandStatusEl.textContent = text;
    commandStatusEl.className = `status-pill ${flavor}`;

    statusTimer = setTimeout(() => {
      if (!commandStatusEl) return;
      commandStatusEl.style.display = "none";
      commandStatusEl.textContent = "";
    }, autoClearMs);
  }

  /**
   * Render function (Log widget doesn't use telemetry data)
   */
  function render() {
    // Log widget is event-driven, not data-driven
    // Nothing to render from telemetry
  }

  /**
   * Initialize the widget - grab DOM references
   */
  function init() {
    commandLogEl = document.getElementById("commandLog");
    commandStatusEl = document.getElementById("commandStatus");

    if (commandStatusEl) {
      commandStatusEl.style.display = "none";
      commandStatusEl.textContent = "";
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.LogWidget = {
    render,
    init,
    log,
    setStatus,
  };

})();

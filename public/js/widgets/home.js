/**
 * home.js - Home Server Widget
 * 
 * Displays: RAM (total/used/free), Active Scripts (filtered)
 * Controls: None (display only)
 */

(() => {
  const { formatRam } = window.FMT;

  /**
   * Render home server data to the widget
   * @param {Object} home - Home server data from telemetry
   */
  function render(home) {
    renderRam(home);
    renderScripts(home);
  }

  /**
   * Render RAM usage section
   */
  function renderRam(home) {
    const elTotal = document.getElementById("ram-total");
    const elUsed = document.getElementById("ram-used");
    const elFree = document.getElementById("ram-free");
    const elUsedPct = document.getElementById("ram-used-pct");
    const elFreePct = document.getElementById("ram-free-pct");

    if (!elTotal || !elUsed || !elFree) return;

    const used = home?.usedRam;
    const max = home?.maxRam;

    if (used == null || max == null) {
      elTotal.textContent = "--";
      elUsed.textContent = "--";
      elFree.textContent = "--";
      if (elUsedPct) elUsedPct.textContent = "--";
      if (elFreePct) elFreePct.textContent = "--";
      return;
    }

    const free = Math.max(0, max - used);
    const usedPct = max > 0 ? (used / max) * 100 : 0;
    const freePct = 100 - usedPct;

    elTotal.textContent = formatRam(max);
    elUsed.textContent = formatRam(used);
    elFree.textContent = formatRam(free);

    if (elUsedPct) elUsedPct.textContent = `(${usedPct.toFixed(2)}%)`;
    if (elFreePct) elFreePct.textContent = `(${freePct.toFixed(2)}%)`;
  }

  /**
   * Render active scripts list
   */
  function renderScripts(home) {
    const scriptsEl = document.getElementById("hud-scripts");
    if (!scriptsEl) return;

    const procs = Array.isArray(home?.procs) ? home.procs : [];

    scriptsEl.textContent = procs.length
      ? procs.map(p => `${p.filename} (${p.threads}t)`).join("\n")
      : "--";
  }

  /**
   * Initialize the widget
   * (Home widget has no interactive controls)
   */
  function init() {
    // Nothing to initialize - display only widget
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.HomeWidget = {
    render,
    init,
  };

})();

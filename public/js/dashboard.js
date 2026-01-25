/**
 * dashboard.js - Main Dashboard Orchestrator
 * 
 * Responsibilities:
 * - SSE connection with reconnection logic
 * - Initial data fetch
 * - Coordinating widget rendering
 * - Command sending to server
 * - HUD status updates
 */

(() => {
  const { runWhenDomReady } = window.UTIL;

  // ============================================================
  // SSE CONNECTION STATE
  // ============================================================

  let sse = null;
  let sseRetryMs = 1000;
  let sseRetryTimer = null;
  let sseState = "idle"; // idle | open | retrying | error

  // ============================================================
  // TELEMETRY STATE
  // ============================================================

  let lastSampleMs = null;
  let lastWarnSec = 10;

  // ============================================================
  // SSE CONNECTION
  // ============================================================

  function setSseState(next, msg = "") {
    sseState = next;
    // Optionally log state changes (would be a bit verbose)
    // LogWidget.log(`[SSE] ${next}${msg ? ` | ${msg}` : ""}`);
  }

  function startSse({ immediate = false } = {}) {
    // Cleanup old connection
    if (sse) {
      try { sse.close(); } catch (e) { /* ignore */ }
    }
    sse = null;

    // Clear any pending retry
    if (sseRetryTimer) clearTimeout(sseRetryTimer);

    const delay = immediate ? 0 : sseRetryMs;
    setSseState("retrying", `retry in ${delay}ms`);

    sseRetryTimer = setTimeout(() => {
      try {
        const es = new EventSource("/stream");
        sse = es;

        es.onopen = () => {
          sseRetryMs = 1000; // Reset backoff on success
          setSseState("open");
          window.LogWidget?.log("✓ SSE connected");
        };

        es.onerror = () => {
          try { es.close(); } catch (e) { /* ignore */ }
          sse = null;

          setSseState("retrying");
          window.LogWidget?.log(`✗ SSE error — reconnecting in ${Math.round(sseRetryMs / 1000)}s`);

          sseRetryMs = Math.min(sseRetryMs * 2, 15000); // Cap at 15s
          startSse();
        };

        es.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data);
            render(d);
          } catch (e) {
            window.LogWidget?.log(`✗ SSE bad JSON: ${String(e)}`);
          }
        };
      } catch (e) {
        setSseState("error", String(e));
        sseRetryMs = Math.min(sseRetryMs * 2, 15000);
        startSse();
      }
    }, delay);
  }

  // ============================================================
  // INITIAL FETCH
  // ============================================================

  async function fetchOnce() {
    const statusEl = document.getElementById("hud-status");
    if (!statusEl) return;

    try {
      const res = await fetch("/current", { cache: "no-store" });
      if (!res.ok) {
        statusEl.innerHTML = '<span class="warn-inline">No data yet</span>';
        return;
      }
      const d = await res.json();
      render(d);
    } catch (err) {
      statusEl.innerHTML = '<span class="warn-inline">Error: ' + String(err) + '</span>';
    }
  }

  // ============================================================
  // MAIN RENDER (delegates to widgets)
  // ============================================================

  function render(d) {
    // Delegate to each widget
    window.PlayerWidget?.render(d.player);
    window.SystemWidget?.render(d);
    window.HomeWidget?.render(d.home);
    window.WorkWidget?.render(d.player?.work);
    // LogWidget and ScriptsWidget don't need telemetry data

    // Update staleness tracking
    lastWarnSec = d.configEcho?.sampleWarnSec ?? lastWarnSec;
    lastSampleMs = typeof d.time === "number" ? d.time : Date.now();

    updateHudStatus();
  }

  // ============================================================
  // HUD STATUS
  // ============================================================

  function updateHudStatus() {
    const statusEl = document.getElementById("hud-status");
    if (!statusEl) return;

    if (!lastSampleMs) {
      statusEl.innerHTML = '<span class="warn-inline">No data yet</span>';
      return;
    }

    const ageSec = (Date.now() - lastSampleMs) / 1000;
    const ts = new Date(lastSampleMs).toLocaleTimeString();

    if (ageSec > lastWarnSec) {
      statusEl.innerHTML = `<span class="warn-inline">Stale</span> - Last Update: ${ts}`;
    } else {
      statusEl.innerHTML = `<span class="ok-inline">Live</span> - Last Update: ${ts}`;
    }
  }

  // ============================================================
  // COMMAND SENDING
  // ============================================================

  /**
   * Summarize a command for logging
   */
  function summarizeCommand(type, payload) {
    if (!payload || typeof payload !== "object") return String(type);

    if (type === "scriptAction") {
      const action = payload.action ?? "";
      const script = payload.script ?? "";
      const threads = payload.threads != null ? `${payload.threads} threads` : "";
      const host = payload.host ? `@${payload.host}` : "";
      return [action, script, threads, host].filter(Boolean).join(" | ");
    }

    if (type === "workAction") {
      const action = payload.action ?? "";
      const workType = payload.workType ?? "";
      const target =
        payload.companyName ||
        payload.factionName ||
        payload.crime ||
        payload.gymName ||
        payload.universityName ||
        "";
      const detail =
        payload.factionWorkType ||
        payload.stat ||
        payload.course ||
        "";
      const focus = payload.focus === true ? "Focus" : "Don't Focus";
      return [action, workType, target, detail, focus].filter(Boolean).join(" | ");
    }

    return `${type} ${(payload.action ?? "")}`.trim();
  }

  /**
   * Send a command to the server
   */
  async function sendCommand(type, payload, { timeoutMs = 4000 } = {}) {
    const summary = summarizeCommand(type, payload);
    window.LogWidget?.log(`→ ${summary}`);
    window.LogWidget?.setStatus("Sent", "pending", 800);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);

      const aborted = (err && String(err.name) === "AbortError");
      const msg = aborted ? `Timeout after ${timeoutMs}ms` : `Network error: ${String(err)}`;

      window.LogWidget?.setStatus(aborted ? "TIMEOUT" : "FAILED", "bad", 3500);
      window.LogWidget?.log(`✗ ${summary} | ${msg}`);
      return { ok: false, error: msg };
    } finally {
      clearTimeout(timer);
    }

    // Read body
    let text = "";
    try { text = await res.text(); } catch (e) { text = ""; }

    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }

    if (!res.ok) {
      const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
      window.LogWidget?.setStatus(`ERR ${res.status}`, "bad", 4500);
      window.LogWidget?.log(`✗ ${summary} | ${msg}`);
      return data ?? { ok: false, status: res.status, error: msg };
    }

    if (data && data.ok === false) {
      const msg = data.error || data.message || "Rejected";
      window.LogWidget?.setStatus("REJECT", "warn", 4500);
      window.LogWidget?.log(`⚠ ${summary} | ${msg}`);
      return data;
    }

    window.LogWidget?.setStatus("OK", "ok", 1200);
    return data ?? { ok: true };
  }

  // Make sendCommand globally available for widgets
  window.sendCommand = sendCommand;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function initDashboard() {
    // Initialize all widgets
    window.PlayerWidget?.init();
    window.SystemWidget?.init();
    window.HomeWidget?.init();
    window.WorkWidget?.init();
    window.ScriptsWidget?.init();
    window.LogWidget?.init();

    // Setup floating widget drag/resize
    window.FloatingWidgets?.setup();

    // Start data flow
    fetchOnce();
    startSse({ immediate: true });

    // Periodic status updates
    setInterval(updateHudStatus, 500);
  }

  // ============================================================
  // BOOT
  // ============================================================

  runWhenDomReady(initDashboard);

})();
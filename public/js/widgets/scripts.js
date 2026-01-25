/**
 * scripts.js - Script Controls Widget
 * 
 * Displays: List of configurable script rows
 * Controls: Run/Kill/Restart buttons, Add Script button, editable fields
 */

(() => {
  // ============================================================
  // CONSTANTS
  // ============================================================

  const STORAGE_KEY = "bb_script_controls_v2";
  const DEFAULT_HOST = "home";

  const DEFAULT_SCRIPTS = [
    { script: "overseer.js", threads: 1, argsText: "" },
    { script: "Singularity_Daemon.js", threads: 1, argsText: "" },
  ];

  // ============================================================
  // STATE
  // ============================================================

  let list = [];

  // ============================================================
  // PERSISTENCE
  // ============================================================

  function saveList() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function loadList() {
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(arr) && arr.length) {
        return arr.map(x => typeof x === "string"
          ? ({ script: x, threads: 1, argsText: "" })
          : ({
              script: String(x.script || ""),
              threads: Number(x.threads || 1),
              argsText: String(x.argsText || "")
            })
        );
      }
    } catch (e) {
      console.warn("Failed to load script list:", e);
    }
    return [...DEFAULT_SCRIPTS];
  }

  // ============================================================
  // ARGUMENT PARSING
  // ============================================================

  /**
   * Parse argument string into array
   * Handles quoted strings and comma/space separation
   */
  function parseArgs(text) {
    const s = (text || "").trim();
    if (!s) return [];
    
    const out = [];
    const re = /"([^"]*)"|'([^']*)'|([^,\s]+)/g;
    let m;
    while ((m = re.exec(s))) {
      out.push(m[1] ?? m[2] ?? m[3]);
    }
    return out;
  }

  // ============================================================
  // ROW RENDERING
  // ============================================================

  /**
   * Create a script row element
   */
  function makeRow(item, index, rerender) {
    const row = document.createElement("div");
    row.className = "script-row";

    // Script name input
    const input = document.createElement("input");
    input.className = "hoverin script-name";
    input.value = item.script || "";
    input.placeholder = ".js";

    // Threads input
    const threadsInput = document.createElement("input");
    threadsInput.className = "hoverin script-threads no-spin";
    threadsInput.type = "number";
    threadsInput.min = "1";
    threadsInput.step = "1";
    threadsInput.value = String(item.threads ?? 1);

    // Args input
    const argsInput = document.createElement("input");
    argsInput.className = "hoverin script-args mono";
    argsInput.placeholder = 'args e.g. joesguns 42 true';
    argsInput.value = item.argsText || "";

    // Action buttons
    const btnRun = document.createElement("button");
    btnRun.className = "btn script-btn run";
    btnRun.type = "button";
    btnRun.textContent = "Run";

    const btnKill = document.createElement("button");
    btnKill.className = "btn script-btn kill";
    btnKill.type = "button";
    btnKill.textContent = "Kill";

    const btnRestart = document.createElement("button");
    btnRestart.className = "btn script-btn restart";
    btnRestart.type = "button";
    btnRestart.textContent = "Restart";

    const btnRemove = document.createElement("button");
    btnRemove.className = "btn script-remove";
    btnRemove.type = "button";
    btnRemove.textContent = "✕";
    btnRemove.title = "Remove row";

    // ---- Debounced save on edit ----
    let saveTimer = null;
    const saveEdits = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        list[index] = {
          script: input.value.trim(),
          threads: Math.max(1, Number(threadsInput.value || 1)),
          argsText: argsInput.value
        };
        saveList();
      }, 150);
    };

    input.addEventListener("input", saveEdits);
    threadsInput.addEventListener("input", saveEdits);
    argsInput.addEventListener("input", saveEdits);

    // ---- Get current payload ----
    const getPayload = () => {
      const script = input.value.trim();
      const threads = Math.max(1, Number(threadsInput.value || 1));
      const args = parseArgs(argsInput.value);
      return { script, threads, args };
    };

    // ---- Button handlers ----
    btnRun.addEventListener("click", async () => {
      const { script, threads, args } = getPayload();
      if (!script) return;
      if (window.sendCommand) {
        await window.sendCommand("scriptAction", { 
          action: "run", 
          host: DEFAULT_HOST, 
          script, 
          threads, 
          args 
        });
      }
    });

    btnRestart.addEventListener("click", async () => {
      const { script, threads, args } = getPayload();
      if (!script) return;
      if (window.sendCommand) {
        await window.sendCommand("scriptAction", { 
          action: "restart", 
          host: DEFAULT_HOST, 
          script, 
          threads, 
          args 
        });
      }
    });

    btnKill.addEventListener("click", async () => {
      const { script } = getPayload();
      if (!script) return;
      if (window.sendCommand) {
        await window.sendCommand("scriptAction", { 
          action: "kill", 
          host: DEFAULT_HOST, 
          script 
        });
      }
    });

    btnRemove.addEventListener("click", () => {
      list.splice(index, 1);
      saveList();
      rerender();
    });

    // Assemble row
    row.append(input, threadsInput, argsInput, btnRun, btnKill, btnRestart, btnRemove);
    return row;
  }

  // ============================================================
  // WIDGET FUNCTIONS
  // ============================================================

  /**
   * Render function (Script widget doesn't use telemetry data)
   */
  function render() {
    // Script controls are user-driven, not data-driven
    // Nothing to render from telemetry
  }

  /**
   * Re-render the script list
   */
  function rerenderList() {
    const listEl = document.getElementById("scriptControlsList");
    if (!listEl) return;

    listEl.innerHTML = "";
    list.forEach((item, idx) => {
      listEl.appendChild(makeRow(item, idx, rerenderList));
    });
  }

  /**
   * Initialize the widget
   */
  function init() {
    const listEl = document.getElementById("scriptControlsList");
    const btnAdd = document.getElementById("btnAddScript");
    if (!listEl || !btnAdd) return;

    // Load saved scripts
    list = loadList();

    // Wire up Add button
    btnAdd.addEventListener("click", () => {
      list.push({ script: "", threads: 1, argsText: "" });
      saveList();
      rerenderList();

      // Focus the new row's script input
      const inputs = listEl.querySelectorAll(".script-name");
      const last = inputs[inputs.length - 1];
      if (last) {
        last.focus();
        last.select();
      }
    });

    // Initial render
    rerenderList();
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.ScriptsWidget = {
    render,
    init,
  };

})();

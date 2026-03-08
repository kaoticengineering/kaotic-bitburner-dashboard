/**
 * work.js - Current Work Widget
 * 
 * Displays: Current activity type, location, rates (rep/sec, exp/sec)
 * Controls: Work type selector, name selector, detail selector, focus toggle, Run button
 */

(() => {
  const { fmtPerSec, statLabel, titleCaseWord } = window.FMT;
  const { setText, fillSelect, enhanceSelect } = window.UTIL;
  const { WORK_LIBRARY } = window.DATA;

  // ============================================================
  // DISPLAY FUNCTIONS
  // ============================================================

  /**
   * Render current work info
   * @param {Object} work - Current work data from telemetry
   */
  function render(work) {
    if (!work) {
      setText("work-current-type", "IDLE |");
      setText("work-current-details", "—");
      return;
    }

    const type = String(work.type ?? "Unknown").toUpperCase();
    let displayType = type;
    let details = "—";

    const repRate = fmtPerSec(work.repPerSec, "Rep");

    switch (type) {
      case "COMPANY": {
        const name = work.companyName ?? work.company ?? "—";
        details = `${name}${repRate ? ` | ${repRate}` : ""}`;
        break;
      }
      case "FACTION": {
        const name = work.factionName ?? work.faction ?? "—";
        details = `${name}${repRate ? ` | ${repRate}` : ""}`;
        break;
      }
      case "CRIME": {
        const crime = work.crimeType ?? work.crime ?? "—";
        details = `${crime}`;
        break;
      }
      case "CLASS": {
        const where = work.location ?? work.classLocation ?? work.school ?? "—";
        const what = work.classType ?? work.course ?? work.stat ?? "—";

        const statKey = inferClassStatKey(what);

        // Decide GYM vs UNIVERSITY from the statKey
        const gymKeys = new Set(["str", "def", "dex", "agi"]);
        displayType = gymKeys.has(statKey) ? "GYM" : "UNIVERSITY";

        // Get exp rate for the relevant stat
        const expPerSec = work.expPerSec?.rate;
        const expStat = work.expPerSec?.stat;
        const statRate = (expStat && typeof expPerSec === "number" && isFinite(expPerSec))
          ? `${statLabel(expStat)} ${fmtPerSec(expPerSec, "Exp")}`
          : null;

        details = `${where}${statRate ? ` | ${statRate}` : ""}`;
        break;
      }
      case "GRAFTING": {
        const aug = work.augmentation ?? "Unknown";
        const cycles = work.cyclesWorked ?? 0;
        details = aug;
        break;
      }
      default: {
        details = JSON.stringify(work);
        break;
      }
    }

    setText("work-current-type", `${titleCaseWord(displayType)} |`);
    setText("work-current-details", details);
  }

  /**
   * Map class type string to stat key
   */
  function inferClassStatKey(what) {
    const s = String(what ?? "").toLowerCase().trim();

    // Gym workouts
    const gymMap = {
      strength: "str", str: "str",
      defense: "def", def: "def",
      dexterity: "dex", dex: "dex",
      agility: "agi", agi: "agi",
    };
    if (gymMap[s]) return gymMap[s];

    // University courses
    const uniMap = {
      leadership: "cha",
      management: "cha",
      algorithms: "hack",
      networks: "hack",
      "data structures": "hack",
      "computer science": "hack",
    };
    if (uniMap[s]) return uniMap[s];

    return null;
  }

  // ============================================================
  // CONTROL FUNCTIONS
  // ============================================================

  /**
   * Get names available for a work type
   */
  function getNamesFor(workType) {
    return WORK_LIBRARY[workType]?.names ?? [];
  }

  /**
   * Get details available for a work type + name
   */
  function getDetailsFor(workType, name) {
    const lib = WORK_LIBRARY[workType];
    if (!lib) return [];

    const byName = lib.detailsByName?.[name];
    if (Array.isArray(byName) && byName.length) return byName;

    if (Array.isArray(lib.details)) return lib.details;
    return [];
  }

  /**
   * Get default detail for a work type + name
   */
  function getDefaultDetailFor(workType, name) {
    const lib = WORK_LIBRARY[workType];
    if (!lib) return "";
    const byName = lib.defaultDetailByName?.[name];
    return byName ?? lib.defaultDetail ?? "";
  }

  /**
   * Sync the work form dropdowns based on current selections
   */
  function syncWorkForm() {
    const typeSel = document.getElementById("work-type");
    const nameSel = document.getElementById("work-name");
    const detailSel = document.getElementById("work-detail");
    if (!typeSel || !nameSel || !detailSel) return;

    const type = typeSel.value;

    // ----- Names -----
    const names = getNamesFor(type);
    const prevName = nameSel.value;

    fillSelect(nameSel, names, {
      placeholder: names.length ? `Select ${type.toLowerCase()}...` : `No ${type.toLowerCase()} entries`,
      selected: names.includes(prevName) ? prevName : ""
    });

    nameSel.disabled = (names.length === 0);

    const name = nameSel.value;

    // ----- Details -----
    const details = getDetailsFor(type, name);
    const defaultDetail = getDefaultDetailFor(type, name);

    const usesDetail = Array.isArray(details) && details.length > 0;

    detailSel.style.display = "";
    detailSel.disabled = !usesDetail;

    if (!usesDetail) {
      fillSelect(detailSel, [], { placeholder: "—" });
      return;
    }

    const prevDetail = detailSel.value;
    const selectedDetail =
      (details.includes(prevDetail) ? prevDetail :
        (details.includes(defaultDetail) ? defaultDetail : details[0]));

    fillSelect(detailSel, details, {
      placeholder: "Select action...",
      selected: selectedDetail
    });
  }

  /**
   * Read current form values
   */
  function readSetWorkFromUI() {
    return {
      workType: document.getElementById("work-type")?.value ?? "COMPANY",
      name: document.getElementById("work-name")?.value ?? "",
      detail: document.getElementById("work-detail")?.value ?? "",
      focus: (document.getElementById("work-focus")?.value === "true"),
    };
  }

  /**
   * Build command payload from form values
   */
  function buildWorkActionPayload(setWork) {
    const focus = !!setWork.focus;

    switch (setWork.workType) {
      case "COMPANY":
        return {
          action: "start",
          workType: "COMPANY",
          companyName: setWork.name,
          focus,
        };

      case "FACTION":
        return {
          action: "start",
          workType: "FACTION",
          factionName: setWork.name,
          factionWorkType: setWork.detail || "Hacking",
          focus,
        };

      case "CRIME":
        return {
          action: "start",
          workType: "CRIME",
          crime: setWork.name,
          focus,
        };

      case "GYM":
        return {
          action: "start",
          workType: "GYM",
          gymName: setWork.name,
          stat: setWork.detail || "Strength",
          focus,
        };

      case "UNIV":
        return {
          action: "start",
          workType: "UNIV",
          universityName: setWork.name,
          course: setWork.detail || "Algorithms",
          focus,
        };
    }

    return null;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize the widget - wire up controls
   */
  function init() {
    // Wire up change listeners for cascading dropdowns
    document.getElementById("work-type")?.addEventListener("change", syncWorkForm);
    document.getElementById("work-name")?.addEventListener("change", syncWorkForm);

    // Enhance selects with custom dropdown UI
    ["work-type", "work-name", "work-detail", "work-focus"].forEach((id) => {
      enhanceSelect(document.getElementById(id));
    });

    // Initial population
    syncWorkForm();

    // Wire up Run button
    document.getElementById("btnWorkStart")?.addEventListener("click", async () => {
      const sw = readSetWorkFromUI();
      const payload = buildWorkActionPayload(sw);
      if (!payload) return;

      // Use the global sendCommand (defined in dashboard.js)
      if (window.sendCommand) {
        await window.sendCommand("workAction", payload);
      }
    });
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.WorkWidget = {
    render,
    init,
    syncWorkForm,
    buildWorkActionPayload,
  };

})();
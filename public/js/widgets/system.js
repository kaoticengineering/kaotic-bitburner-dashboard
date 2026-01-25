/**
 * system.js - System Status Widget
 * 
 * Displays: City, BitNode, Programs (TOR/EXEs), APIs, Hardware, IPvGO Bonuses
 * Controls: None (display only)
 */

(() => {
  const { formatRam } = window.FMT;

  /**
   * Render system status data to the widget
   * @param {Object} d - Full telemetry data object
   */
  function render(d) {
    renderCity(d.player);
    renderBitNode(d.player);
    renderExes(d.programs);
    renderApis(d.stockApi, d.home);
    renderIpvgo(d.ipvgo);
  }

  /**
   * Render current city
   */
  function renderCity(player) {
    const cityEl = document.getElementById("hud-city");
    if (cityEl) {
      cityEl.textContent = player?.city ?? "--";
    }
  }

  /**
   * Render BitNode info
   */
  function renderBitNode(player) {
    const bnEl = document.getElementById("hud-bitnode");
    if (!bnEl) return;

    const bn = player?.bitnode;
    if (bn) {
      bnEl.textContent = `BN${bn.number}: ${bn.name} (Lvl ${bn.level})`;
    } else {
      bnEl.textContent = "--";
    }
  }

  /**
   * Render owned programs (TOR + port openers + APIs)
   */
  function renderExes(programs) {
    if (!programs) return;

    const ownedArray = programs.portOpeners?.owned ?? [];

    const exeMap = {
      tor: programs.hasTor,
      brute: ownedArray.includes("BruteSSH.exe"),
      ftp: ownedArray.includes("FTPCrack.exe"),
      smtp: ownedArray.includes("relaySMTP.exe"),
      http: ownedArray.includes("HTTPWorm.exe"),
      sql: ownedArray.includes("SQLInject.exe"),
    };

    for (const [key, hasIt] of Object.entries(exeMap)) {
      const el = document.querySelector(`.exe[data-exe="${key}"]`);
      if (el) {
        el.classList.toggle("owned", !!hasIt);
      }
    }
  }

  /**
   * Render API ownership and hardware info
   */
  function renderApis(stockApi, home) {
    // API badges
    const stockBadge = document.querySelector('.exe[data-api="stock"]');
    const fourSBadge = document.querySelector('.exe[data-api="4s"]');

    if (stockBadge && stockApi) {
      stockBadge.classList.toggle("owned", !!stockApi.hasTixApi);
    }

    if (fourSBadge && stockApi) {
      fourSBadge.classList.toggle("owned", !!stockApi.has4sData);
    }

    // Hardware values
    const ramEl = document.getElementById("hud-homeram");
    const coresEl = document.getElementById("hud-homecores");

    if (ramEl && home) {
      ramEl.textContent = formatRam(home.maxRam);
      ramEl.className = "api-val";
    }

    if (coresEl && home) {
      coresEl.textContent = home.cpuCores != null ? `${home.cpuCores}` : "--";
      coresEl.className = "api-val";
    }
  }

  /**
   * Render IPvGO bonuses
   */
  function renderIpvgo(ipvgo) {
    const container = document.getElementById("hud-ipvgo");
    if (!container) return;

    if (!ipvgo || typeof ipvgo !== "object" || Object.keys(ipvgo).length === 0) {
      container.textContent = "Not active";
      container.className = "ipvgo-grid mono";
      return;
    }

    container.innerHTML = "";
    container.className = "ipvgo-grid mono";

    for (const [faction, data] of Object.entries(ipvgo)) {
      if (!data || data.bonusPercent == null) continue;

      const row = document.createElement("div");
      row.className = "ipvgo-row";

      const labelSpan = document.createElement("span");
      labelSpan.className = "ipvgo-label";
      labelSpan.textContent = faction;

      const valSpan = document.createElement("span");
      const pct = data.bonusPercent;
      const isNeutral = pct === 0;
      valSpan.className = `ipvgo-val ${isNeutral ? "neutral" : ""}`;
      valSpan.textContent = pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;

      if (data.bonusDescription) {
        row.title = data.bonusDescription;
      }

      row.appendChild(labelSpan);
      row.appendChild(valSpan);
      container.appendChild(row);
    }

    if (container.children.length === 0) {
      container.textContent = "No bonuses";
    }
  }

  /**
   * Initialize the widget
   * (System widget has no interactive controls)
   */
  function init() {
    // Nothing to initialize - display only widget
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.SystemWidget = {
    render,
    init,
  };

})();

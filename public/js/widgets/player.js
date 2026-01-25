/**
 * player.js - Player Widget
 * 
 * Displays: Money, HP, Karma, Kills, Stats
 * Controls: None (display only)
 */

(() => {
  const { formatMoney, formatKarma, safe } = window.FMT;
  const { setText } = window.UTIL;

  /**
   * Render player data to the widget
   * @param {Object} player - Player data from telemetry
   */
  function render(player) {
    if (!player) return;

    // Money
    const moneyEl = document.getElementById("hud-money");
    if (moneyEl) {
      moneyEl.textContent = "$" + formatMoney(player.money);
    }

    // HP
    const hpEl = document.getElementById("hud-hp");
    if (hpEl) {
      const hpText = (player.hpCurrent != null && player.hpMax != null)
        ? `${Math.floor(player.hpCurrent)} / ${Math.floor(player.hpMax)}`
        : safe(player.hpCurrent);
      hpEl.textContent = hpText;
    }

    // Karma
    const karmaEl = document.getElementById("hud-karma");
    if (karmaEl) {
      karmaEl.textContent = formatKarma(player.karma);
    }

    // Kills
    const killsEl = document.getElementById("hud-kills");
    if (killsEl) {
      killsEl.textContent = safe(player.kills);
    }

    // Stats
    const stats = player.stats || {};
    setText("s-hack", stats.hack);
    setText("s-str", stats.str);
    setText("s-def", stats.def);
    setText("s-dex", stats.dex);
    setText("s-agi", stats.agi);
    setText("s-cha", stats.cha);
    setText("s-int", stats.int);
  }

  /**
   * Initialize the widget
   * (Player widget has no interactive controls)
   */
  function init() {
    // Nothing to initialize - display only widget
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.PlayerWidget = {
    render,
    init,
  };

})();

/**
 * fmt.js - Formatting Utilities for Bitburner Dashboard
 * 
 * Pure functions that transform data into display-ready strings.
 * No DOM access, no side effects - just data in, string out.
 */

(() => {
  /**
   * Safe value fallback
   * Returns fallback if value is null or undefined
   */
  function safe(x, fallback = "--") {
    return (x == null) ? fallback : x;
  }

  /**
   * Format money with engineering notation for large values
   * Examples: 1234.5 → "1234.5", 1234567 → "1.2 e6"
   */
  function formatMoney(x) {
    if (x == null) return "--";
    if (x === 0) return "0.0";

    const sign = x < 0 ? "-" : "";
    const abs = Math.abs(x);

    // Under 1k: show one decimal
    if (abs < 1e3) return sign + abs.toFixed(1);

    // Engineering exponent: multiple of 3
    const exp = Math.floor(Math.log10(abs) / 3) * 3;
    const mantissa = abs / Math.pow(10, exp);

    return sign + mantissa.toFixed(1) + " e" + exp;
  }

  /**
   * Format karma (similar to money)
   */
  function formatKarma(x) {
    if (x == null) return "--";
    const sign = x < 0 ? "-" : "";
    const abs = Math.abs(x);
    
    if (abs < 1e3) return sign + abs.toFixed(1);
    
    const exp = Math.floor(Math.log10(abs) / 3) * 3;
    const mantissa = abs / Math.pow(10, exp);
    return sign + mantissa.toFixed(1) + " e" + exp;
  }

  /**
   * Format RAM values (GB or TB)
   * Examples: 64 → "64.0 GB", 1024 → "1.00 TB"
   * Note to self: Add PB so we don't see
   *   16384.00 TB..
   */
  function formatRam(gb) {
    if (gb == null) return "--";
    if (gb >= 1024) return (gb / 1024).toFixed(2) + " TB";
    return gb.toFixed(1) + " GB";
  }

  /**
   * Format rate per second
   * Example: fmtPerSec(1.234, "Rep") → "1.234 Rep / sec"
   */
  function fmtPerSec(x, unit) {
    if (typeof x !== "number" || !isFinite(x)) return null;
    return `${x.toFixed(3)} ${unit} / sec`;
  }

  /**
   * Convert stat name to abbreviated label
   * Example: "hack" → "HCK", "strength" → "STR"
   */
  function statLabel(stat) {
    const s = String(stat ?? "").toLowerCase();
    return ({
      hack: "HCK",
      str: "STR",
      def: "DEF",
      dex: "DEX",
      agi: "AGI",
      cha: "CHA",
      int: "INT",
    })[s] ?? s.toUpperCase();
  }

  /**
   * Title case a single word
   * Example: "hello" → "Hello"
   */
  function titleCaseWord(s) {
    const t = String(s ?? "").toLowerCase();
    return t ? (t[0].toUpperCase() + t.slice(1)) : "";
  }

  /**
   * Title case a string (handles spaces, underscores, hyphens)
   * Example: "hello_world" → "Hello World"
   */
  function titleCase(s) {
    return String(s ?? "")
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map(w => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.FMT = {
    safe,
    formatMoney,
    formatKarma,
    formatRam,
    fmtPerSec,
    statLabel,
    titleCaseWord,
    titleCase,
  };

})();

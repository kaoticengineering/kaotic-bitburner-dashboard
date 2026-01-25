/**
 * util.js - Shared Utilities for Bitburner Dashboard
 * 
 * Common helper functions used across multiple widgets.
 * Includes DOM helpers and the custom select enhancement.
 */

(() => {
  // ============================================================
  // DOM HELPERS
  // ============================================================

  /**
   * Set text content of an element by ID
   * Handles null/undefined values with fallback
   */
  function setText(id, val, fallback = "--") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (val == null) ? fallback : val;
  }

  /**
   * Run a function when DOM is ready
   * Safe to call even if DOM is already loaded
   */
  function runWhenDomReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  // ============================================================
  // CUSTOM SELECT ENHANCEMENT
  // ============================================================

  // Track open selects for click-outside handling
  const OPEN_CSELECTS = new Set();

  // Single global listener for closing selects on outside click
  document.addEventListener("mousedown", (e) => {
    for (const wrap of Array.from(OPEN_CSELECTS)) {
      if (!wrap.contains(e.target)) {
        wrap.__cselectClose?.();
      }
    }
  });

  /**
   * Enhance a native <select> with custom dropdown UI
   * Provides better styling control while maintaining accessibility
   */
  function enhanceSelect(selectEl) {
    if (!selectEl || selectEl.__enhanced) return;
    selectEl.__enhanced = true;

    // Wrap the select
    const wrap = document.createElement("div");
    wrap.className = "cselect";
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);

    // Create button (visible trigger)
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "input cselect__btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    wrap.appendChild(btn);

    // Create listbox (dropdown)
    const list = document.createElement("div");
    list.className = "cselect__list";
    list.setAttribute("role", "listbox");
    wrap.appendChild(list);

    let activeIndex = -1;

    // ---- Internal functions ----

    function rebuild() {
      list.innerHTML = "";
      const opts = Array.from(selectEl.options);

      opts.forEach((o, i) => {
        const item = document.createElement("div");
        item.className = "cselect__opt";
        item.textContent = o.textContent;
        item.dataset.value = o.value;
        item.dataset.index = String(i);

        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", o.selected ? "true" : "false");
        item.setAttribute("aria-disabled", o.disabled ? "true" : "false");

        if (o.disabled) item.classList.add("is-disabled");
        if (o.selected) item.classList.add("is-selected");

        item.addEventListener("mouseenter", () => setActive(i));
        item.addEventListener("click", () => {
          if (o.disabled) return;
          selectEl.value = o.value;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          close();
        });

        list.appendChild(item);
      });

      syncFromSelect();
      syncDisabled();
    }

    function syncFromSelect() {
      const selOpt = selectEl.selectedOptions?.[0] || selectEl.options[selectEl.selectedIndex];
      btn.textContent = selOpt ? selOpt.textContent : "—";

      const items = Array.from(list.children);
      items.forEach((el, idx) => {
        const isSel = idx === selectEl.selectedIndex;
        el.classList.toggle("is-selected", isSel);
        el.setAttribute("aria-selected", isSel ? "true" : "false");
      });

      setActive(selectEl.selectedIndex, true);
    }

    function syncDisabled() {
      const disabled = selectEl.disabled;
      wrap.classList.toggle("is-disabled", disabled);
      btn.disabled = disabled;
    }

    function open() {
      if (selectEl.disabled) return;
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      OPEN_CSELECTS.add(wrap);

      if (activeIndex < 0) setActive(selectEl.selectedIndex, true);
      scrollActiveIntoView();
    }

    function close() {
      if (!wrap.classList.contains("is-open")) return;
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      OPEN_CSELECTS.delete(wrap);
      btn.focus({ preventScroll: true });
    }

    wrap.__cselectClose = close;

    function toggle() {
      wrap.classList.contains("is-open") ? close() : open();
    }

    function setActive(i, silent = false) {
      const items = Array.from(list.children);
      if (!items.length) return;

      const clamped = Math.max(0, Math.min(i, items.length - 1));
      activeIndex = clamped;

      items.forEach((el, idx) => el.classList.toggle("is-active", idx === activeIndex));
      if (!silent) scrollActiveIntoView();
    }

    function scrollActiveIntoView() {
      const items = Array.from(list.children);
      const el = items[activeIndex];
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    function move(delta) {
      const items = Array.from(list.children);
      if (!items.length) return;

      let i = activeIndex;
      for (let step = 0; step < items.length; step++) {
        i = (i + delta + items.length) % items.length;
        if (!items[i].classList.contains("is-disabled")) {
          setActive(i);
          return;
        }
      }
    }

    function chooseActive() {
      const opt = selectEl.options[activeIndex];
      if (!opt || opt.disabled) return;
      selectEl.value = opt.value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      close();
    }

    // ---- Event listeners ----

    btn.addEventListener("click", toggle);

    btn.addEventListener("keydown", (e) => {
      if (selectEl.disabled) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!wrap.classList.contains("is-open")) open();
          move(+1);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!wrap.classList.contains("is-open")) open();
          move(-1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!wrap.classList.contains("is-open")) open();
          else chooseActive();
          break;
        case "Escape":
          if (wrap.classList.contains("is-open")) {
            e.preventDefault();
            close();
          }
          break;
      }
    });

    // Keep custom UI synced when select changes programmatically
    selectEl.addEventListener("change", syncFromSelect);

    // Watch for option changes (e.g., when fillSelect() rebuilds options)
    const mo = new MutationObserver(() => rebuild());
    mo.observe(selectEl, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ["disabled"] 
    });

    // Initial build
    rebuild();
  }

  // ============================================================
  // SELECT HELPERS
  // ============================================================

  /**
   * Fill a select element with options
   * @param {HTMLSelectElement} sel - The select element
   * @param {string[]} options - Array of option values/labels
   * @param {Object} config - { placeholder, selected }
   */
  function fillSelect(sel, options, { placeholder = "", selected = "" } = {}) {
    sel.innerHTML = "";

    if (placeholder) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      sel.appendChild(opt);
    }

    for (const v of options) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }

    if (selected && options.includes(selected)) {
      sel.value = selected;
    } else if (placeholder) {
      sel.value = "";
    } else if (options.length) {
      sel.value = options[0];
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.UTIL = {
    setText,
    runWhenDomReady,
    enhanceSelect,
    fillSelect,
  };

})();

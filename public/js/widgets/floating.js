/**
 * floating.js - Floating Widget System
 * 
 * Handles drag/resize functionality via Interact.js
 * Persists widget positions/sizes to localStorage
 */

(() => {
  // ============================================================
  // CONSTANTS
  // ============================================================

  const STORAGE_KEY = "bb_dashboard_layout_interact_v1";

  // ============================================================
  // LAYOUT PERSISTENCE
  // ============================================================

  function loadLayout() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      console.warn("Failed to load layout:", e);
      return {};
    }
  }

  function saveLayout(layout) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }

  /**
   * Get default widget positions based on workspace size
   */
  function defaultRects(workspace) {
    const W = workspace.clientWidth;
    const pad = 12;
    const leftW = Math.max(520, Math.floor(W * 0.62));
    const rightW = Math.max(360, Math.floor(W * 0.34));

    return {
      player:   { x: pad, y: pad, w: 280, h: 420, z: 1 },
      system:   { x: 300, y: pad, w: 320, h: 420, z: 1 },
      controls: { x: W - rightW - pad, y: pad, w: rightW, h: 260, z: 2 },
      home:     { x: pad, y: 452, w: leftW, h: 340, z: 1 },
      log:      { x: W - rightW - pad, y: 290, w: rightW, h: 540, z: 2 },
      work:     { x: pad, y: 812, w: leftW, h: 260, z: 1 },
    };
  }

  // ============================================================
  // POSITION HELPERS
  // ============================================================

  function setPos(el, x, y) {
    el.dataset.x = String(x);
    el.dataset.y = String(y);
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function getPos(el) {
    return {
      x: parseFloat(el.dataset.x || "0"),
      y: parseFloat(el.dataset.y || "0"),
    };
  }

  // ============================================================
  // SETUP
  // ============================================================

  /**
   * Initialize floating widget functionality
   */
  function setup() {
    const workspace = document.getElementById("workspace");
    if (!workspace) return;

    // Check if Interact.js is available
    if (typeof interact === "undefined") {
      console.warn("Interact.js not found. Widgets will not be draggable/resizable.");
      return;
    }

    let zTop = 10;

    function bringToFront(el) {
      zTop += 1;
      el.style.zIndex = String(zTop);
    }

    function persist(el) {
      const id = el.dataset.widget;
      if (!id) return;

      const rect = el.getBoundingClientRect();
      const layout = loadLayout();
      const { x, y } = getPos(el);

      layout[id] = {
        x, y,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        z: parseInt(el.style.zIndex || "1", 10),
      };
      saveLayout(layout);
    }

    function resetLayout() {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }

    // Ctrl+Shift+R to reset layout
    window.addEventListener("keydown", (ev) => {
      if (ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === "r") {
        resetLayout();
      }
    });

    // ---- Initialize widget positions ----
    const saved = loadLayout();
    const defs = defaultRects(workspace);

    const widgets = Array.from(workspace.querySelectorAll(".widget"));
    for (const el of widgets) {
      const id = el.dataset.widget;
      const rect = saved[id] || defs[id] || { x: 12, y: 12, w: 520, h: 320, z: 1 };

      el.style.width = rect.w + "px";
      el.style.height = rect.h + "px";
      el.style.zIndex = rect.z ?? 1;
      zTop = Math.max(zTop, rect.z || 1);

      setPos(el, rect.x, rect.y);

      // Bring to front on click
      el.addEventListener("pointerdown", () => bringToFront(el), { passive: true });
    }

    // ---- Draggable ----
    interact(".widget")
      .draggable({
        allowFrom: ".widget-bar",
        ignoreFrom: "button, input, textarea, select, a, .no-drag",
        inertia: true,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: workspace,
            endOnly: true
          })
        ],
        listeners: {
          start(event) {
            event.target.classList.add("is-dragging");
            bringToFront(event.target);
          },
          move(event) {
            const el = event.target;
            const p = getPos(el);
            setPos(el, p.x + event.dx, p.y + event.dy);
          },
          end(event) {
            event.target.classList.remove("is-dragging");
            persist(event.target);
          }
        }
      })
      // ---- Resizable ----
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        inertia: true,
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: workspace,
            endOnly: true
          }),
          interact.modifiers.restrictSize({
            min: { width: 100, height: 160 }
          })
        ],
        listeners: {
          start(event) {
            bringToFront(event.target);
          },
          move(event) {
            const el = event.target;

            el.style.width = event.rect.width + "px";
            el.style.height = event.rect.height + "px";

            const p = getPos(el);
            const x = p.x + event.deltaRect.left;
            const y = p.y + event.deltaRect.top;
            setPos(el, x, y);
          },
          end(event) {
            persist(event.target);
          }
        }
      });

    // ---- Handle window resize ----
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        for (const el of widgets) {
          const { x, y } = getPos(el);
          setPos(el, x, y);
        }
      }, 150);
    });
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.FloatingWidgets = {
    setup,
  };

})();

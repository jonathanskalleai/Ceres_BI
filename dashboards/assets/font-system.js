/* ============================================================
   VOUX BI — Typography System Switcher
   Roda CEDO em cada página: lê preferência do localStorage e
   aplica em <html> via data-font-system antes do render.
   ============================================================ */

(function () {
  const KEY = "voux:font-system";
  const DEFAULT = "geist";

  const SYSTEMS = [
    { id: "geist",     label: "Geist",      caption: "Moderno · tech" },
    { id: "jakarta",   label: "Jakarta",    caption: "Amigável · SaaS" },
    { id: "inter",     label: "Inter",      caption: "Neutro · sharp" },
    { id: "editorial", label: "Editorial",  caption: "Original · serif" },
  ];

  function apply(id) {
    const valid = SYSTEMS.find(s => s.id === id) ? id : DEFAULT;
    document.documentElement.setAttribute("data-font-system", valid);
    try { localStorage.setItem(KEY, valid); } catch (e) {}
    return valid;
  }

  function current() {
    try { return localStorage.getItem(KEY) || DEFAULT; } catch (e) { return DEFAULT; }
  }

  // Apply EARLY (before DOMContentLoaded) to avoid FOUC
  apply(current());

  function renderSwitcher(mount) {
    const cur = current();
    mount.innerHTML = `
      <div class="font-switcher" role="group" aria-label="Sistema tipográfico">
        ${SYSTEMS.map(s => `
          <button class="font-switcher__btn ${s.id === cur ? "is-active" : ""}" data-fs="${s.id}" title="${s.caption}">
            <span class="font-switcher__label">${s.label}</span>
          </button>
        `).join("")}
      </div>
    `;
    mount.querySelectorAll("[data-fs]").forEach(btn => {
      btn.addEventListener("click", () => {
        apply(btn.dataset.fs);
        mount.querySelectorAll(".font-switcher__btn").forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        // Re-render any active SVG charts that read --voux-font-display
        try { window.dispatchEvent(new CustomEvent("voux:font-changed", { detail: { id: btn.dataset.fs } })); } catch(e) {}
      });
    });
  }

  window.VOUX_FONT = { apply, current, renderSwitcher, SYSTEMS };
})();

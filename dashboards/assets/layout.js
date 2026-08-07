/* ============================================================
   VOUX BI — Layout shell (sidebar + topbar wiring)
   ============================================================ */

(function () {
  // Render sidebar based on data.js nav
  function renderSidebar(currentId) {
    const root = document.querySelector("[data-sidebar]");
    if (!root) return;

    const icons = {
      // CRM pages
      "overview":          `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="2" width="5.5" height="5.5" rx="1"/><rect x="2" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>`,
      "consultores":       `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="5" r="2"/><circle cx="11" cy="5" r="2"/><path d="M1 13c0-2 1.5-3 4-3s4 1 4 3"/><path d="M9 12c0-1.5 1-2.5 3-2.5s3 1 3 2.5"/></svg>`,
      "regioes":           `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 2v12M2 8h12"/><path d="M4 4.5c1.5.5 2.5.5 4 0s2.5.5 4 0M4 11.5c1.5-.5 2.5-.5 4 0s2.5-.5 4 0"/></svg>`,
      "registros":         `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="10" height="12" rx="1"/><path d="M6 5h4M6 8h4M6 11h2.5"/></svg>`,
      "criticos":          `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L2 13h12L8 2z"/><path d="M8 6v3.5M8 11v.5"/></svg>`,
      "mapa":              `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2l4 2 4-2v10l-4 2-4-2-4 2V4z"/><path d="M6 2v10M10 4v10"/></svg>`,
      "insights":          `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>`,
      "negocios-mensais":  `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M10 6h-3a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H6M8 4.5v1M8 10.5v1"/></svg>`,
      "administrativo":    `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 14s-1-1-1-3 2-4 6-4 6 2 6 4-1 3-1 3"/><path d="M10 10.5l2 2 3-3"/></svg>`,
      // BI pages
      "index":             `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.5"/><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4"/><circle cx="12" cy="5" r="2"/><path d="M14 12.5c0-1.5-1-2.5-2-2.8"/></svg>`,
      "comercial":         `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l4-5 3 3 5-7"/><path d="M10 3h4v4"/></svg>`,
      "pedidos":           `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h10l-1.5 7H4.5L3 3z"/><circle cx="6" cy="13" r="1"/><circle cx="11" cy="13" r="1"/><path d="M1 1h2"/></svg>`,
      "operacional":       `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h10M3 8h10M3 12h6"/></svg>`,
      "produtos":          `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z"/><path d="M2 5l6 3 6-3M8 8v6"/></svg>`,
      "servicos":          `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>`,
      "acoes":             `<svg viewBox="0 0 16 16" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h8M8 4l4 4-4 4"/></svg>`,
    };

    let html = `
      <div class="sidebar__brand">
        <div class="sidebar__logo"><em>V</em></div>
        <div class="sidebar__brand-text">
          <div class="sidebar__brand-name">Ceres<em style="font-style:italic;color:var(--voux-champagne-400);"> BI</em></div>
          <div class="sidebar__brand-tag">Business Intelligence</div>
        </div>
      </div>
    `;

    VOUX_DATA.nav.forEach(group => {
      html += `<div class="sidebar__group">
        <div class="sidebar__group-label">${group.group}</div>`;
      group.items.forEach(it => {
        const active = it.id === currentId ? "sidebar__link--active" : "";
        html += `<a class="sidebar__link ${active}" href="${it.href}">
          ${icons[it.id] || ""}
          <span>${it.label}</span>
          <span class="sidebar__link-num">${it.num}</span>
        </a>`;
      });
      html += `</div>`;
    });

    html += `
      <div class="sidebar__footer">
        <div class="sidebar__avatar">CR</div>
        <div>
          <div class="sidebar__user-name">Ceres BI</div>
          <div class="sidebar__user-role">CRM Analytics</div>
        </div>
      </div>
    `;
    root.innerHTML = html;
  }

  // Topbar helpers
  function renderTopbar(opts) {
    const el = document.querySelector("[data-topbar]");
    if (!el) return;
    el.innerHTML = `
      <div class="topbar__title-block">
        <div class="topbar__crumb">
          <span>Voux BI</span> / <span>${opts.section}</span>
        </div>
        <h1 class="topbar__title">${opts.title}</h1>
      </div>
      <div class="topbar__actions">
        <div data-font-switcher></div>
        <div class="topbar__search">
          <svg viewBox="0 0 16 16" fill="none" stroke-width="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/></svg>
          <span>Buscar cliente, contrato…</span>
          <kbd>⌘K</kbd>
        </div>
        <button class="voux-btn voux-btn--secondary voux-btn--sm">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5l5 5 5-5"/></svg>
          Exportar
        </button>
        <button class="voux-btn voux-btn--primary voux-btn--sm">+ Novo</button>
      </div>
    `;
    if (window.VOUX_FONT) {
      VOUX_FONT.renderSwitcher(el.querySelector("[data-font-switcher]"));
    }
  }

  // Toolbar (filters + date)
  function renderToolbar(opts) {
    const el = document.querySelector("[data-toolbar]");
    if (!el) return;
    const segs = (opts.segments || [{label:"Mês", active:true},{label:"Trimestre"},{label:"Ano"}])
      .map(s => `<button class="toolbar__seg-btn ${s.active ? "toolbar__seg-btn--active" : ""}">${s.label}</button>`).join("");
    const filters = (opts.filters || []).map(f =>
      `<div class="toolbar__filter">
        <span class="toolbar__filter-label">${f.label}</span>
        <span>${f.value}</span>
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4.5l3 3 3-3"/></svg>
      </div>`).join("");
    el.innerHTML = `
      <div class="toolbar__group">
        <div class="toolbar__seg">${segs}</div>
      </div>
      <div class="toolbar__group">
        <div class="toolbar__filter">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="1"/><path d="M2.5 6.5h11M5 2v3M11 2v3"/></svg>
          <span class="toolbar__filter-label">Período</span>
          <span>${opts.period || "01 Jan – 31 Dez · 2022"}</span>
        </div>
        ${filters}
      </div>
      <div class="toolbar__group" style="margin-left:auto;">
        <button class="toolbar__filter">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M4 8h8M6 12h4"/></svg>
          <span>Filtros</span>
        </button>
        <button class="toolbar__filter">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v8M5 7l3 4 3-4M3 13h10"/></svg>
          <span>CSV</span>
        </button>
      </div>
    `;
  }

  window.VOUX_LAYOUT = { renderSidebar, renderTopbar, renderToolbar };

  // Auto-init
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page) renderSidebar(page);
  });
})();

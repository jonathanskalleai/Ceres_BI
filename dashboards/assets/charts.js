/* ============================================================
   VOUX BI — Custom SVG Charts
   Editorial, minimal. No external dependencies.
   ============================================================ */

(function () {

  const COLORS = {
    accent: "#d4b896",
    accent2: "#b8945a",
    accent3: "#6e542f",
    ink: "#ece5d4",
    inkSoft: "#b3ab9c",
    inkMuted: "#8a8273",
    inkFaint: "#6b6253",
    grid: "rgba(214, 207, 193, 0.06)",
    gridStrong: "rgba(214, 207, 193, 0.10)",
    success: "#7a9b6f",
    warning: "#d4a05a",
    danger: "#c97565",
    info: "#8ea3b8",
    surface: "#18160f",
  };

  // ---- helpers ----
  const svgNS = "http://www.w3.org/2000/svg";
  function el(tag, attrs = {}, text) {
    const e = document.createElementNS(svgNS, tag);
    const styleProps = [];
    for (const k in attrs) {
      const v = attrs[k];
      // CSS var() values must go through style, not attribute
      if (typeof v === "string" && v.includes("var(")) {
        const cssKey = k.replace(/([A-Z])/g, "-$1").toLowerCase();
        styleProps.push(`${cssKey}:${v}`);
      } else {
        e.setAttribute(k, v);
      }
    }
    if (styleProps.length) e.setAttribute("style", styleProps.join(";"));
    if (text != null) e.textContent = text;
    return e;
  }
  function clearMount(mount) { while (mount.firstChild) mount.removeChild(mount.firstChild); }
  function displayFont() { return "var(--voux-font-display)"; }
  function displayWeight() { return getComputedStyle(document.documentElement).getPropertyValue('--voux-display-weight').trim() || '500'; }
  function fmtCompact(n) {
    if (n === null || n === undefined) return "";
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }
  function fmtBRLCompact(n) { return "R$ " + fmtCompact(n); }

  // ============================================================
  // 1. HORIZONTAL BAR (with labels at end)
  // ============================================================
  // data = [{ label, value }]
  // opts: { color, valueFormatter, max, height, showValues }
  function barH(mount, data, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 400;
    const rowH = opts.rowH || 26;
    const gap = 8;
    const labelW = opts.labelW || 130;
    const valueW = 60;
    const padTop = 4;
    const h = data.length * (rowH + gap) + padTop;
    mount.style.height = h + "px";

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    const max = opts.max || Math.max(...data.map(d => d.value));
    const barX = labelW + 12;
    const barMaxW = Math.max(40, w - barX - valueW - 8);
    const color = opts.color || COLORS.accent;
    const fmt = opts.valueFormatter || (v => v.toLocaleString("pt-BR"));

    data.forEach((d, i) => {
      const y = padTop + i * (rowH + gap);
      // label
      const t = el("text", {
        x: labelW, y: y + rowH/2 + 4, "text-anchor": "end",
        "font-family": "var(--voux-font-sans)", "font-size": 12,
        fill: COLORS.inkSoft,
      }, d.label);
      svg.appendChild(t);
      // track
      svg.appendChild(el("rect", {
        x: barX, y: y + rowH/2 - 3,
        width: barMaxW, height: 6, rx: 3,
        fill: "rgba(214, 207, 193, 0.04)",
      }));
      // bar
      const bw = (d.value / max) * barMaxW;
      const grad = `bar-grad-${Math.random().toString(36).slice(2,7)}`;
      const def = el("defs");
      const lg = el("linearGradient", { id: grad, x1: 0, y1: 0, x2: 1, y2: 0 });
      lg.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.5 }));
      lg.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 1 }));
      def.appendChild(lg);
      svg.appendChild(def);
      const r = el("rect", {
        x: barX, y: y + rowH/2 - 3,
        width: 0, height: 6, rx: 3,
        fill: `url(#${grad})`,
      });
      svg.appendChild(r);
      requestAnimationFrame(() => {
        r.setAttribute("width", bw);
        r.style.transition = "width 700ms cubic-bezier(0.22, 1, 0.36, 1)";
      });
      // value
      svg.appendChild(el("text", {
        x: barX + bw + 8, y: y + rowH/2 + 4,
        "font-family": "var(--voux-font-mono)", "font-size": 11,
        fill: COLORS.ink, "letter-spacing": "0.02em",
      }, fmt(d.value)));
    });

    mount.appendChild(svg);
  }

  // ============================================================
  // 2. LINE CHART
  // ============================================================
  // series = [{ name, color, values: [n,...], dashed }]
  // labels = ["Jan",...]
  function line(mount, labels, series, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 600;
    const h = opts.height || 280;
    mount.style.height = h + "px";

    const padL = 44, padR = 24, padT = 24, padB = 32;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const allVals = series.flatMap(s => s.values).filter(v => v != null);
    let max = Math.max(...allVals);
    let min = opts.min ?? Math.min(0, Math.min(...allVals));
    if (max === min) max = min + 1;
    // pad
    const padFactor = 0.12;
    max = max + (max - min) * padFactor;

    const x = i => padL + (labels.length === 1 ? plotW/2 : (i / (labels.length - 1)) * plotW);
    const y = v => padT + plotH - ((v - min) / (max - min)) * plotH;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });

    // gridlines (4 horizontal)
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const yy = padT + (i / ticks) * plotH;
      const v = max - (i / ticks) * (max - min);
      svg.appendChild(el("line", {
        x1: padL, x2: padL + plotW, y1: yy, y2: yy,
        stroke: COLORS.grid, "stroke-width": 1,
      }));
      svg.appendChild(el("text", {
        x: padL - 8, y: yy + 4, "text-anchor": "end",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkFaint, "letter-spacing": "0.04em",
      }, (opts.yFmt || fmtCompact)(v)));
    }

    // x labels
    labels.forEach((lbl, i) => {
      svg.appendChild(el("text", {
        x: x(i), y: h - padB + 18, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.08em",
      }, lbl));
    });

    series.forEach((s, sIdx) => {
      const color = s.color || COLORS.accent;
      const pathD = s.values
        .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
        .join(" ");

      // area fill (subtle) under primary series only
      if (s.area !== false && sIdx === 0) {
        const areaD = pathD + ` L ${x(s.values.length - 1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`;
        const gid = "area-grad-" + Math.random().toString(36).slice(2,7);
        const def = el("defs");
        const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
        lg.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.18 }));
        lg.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }));
        def.appendChild(lg);
        svg.appendChild(def);
        svg.appendChild(el("path", {
          d: areaD, fill: `url(#${gid})`, stroke: "none",
        }));
      }

      // line
      const path = el("path", {
        d: pathD, fill: "none",
        stroke: color, "stroke-width": 1.5,
        "stroke-linecap": "round", "stroke-linejoin": "round",
        "stroke-dasharray": s.dashed ? "4 4" : "none",
      });
      svg.appendChild(path);

      // points
      if (opts.points !== false) {
        s.values.forEach((v, i) => {
          svg.appendChild(el("circle", {
            cx: x(i), cy: y(v), r: 3,
            fill: COLORS.surface,
            stroke: color, "stroke-width": 1.5,
          }));
        });
      }

      // data labels
      if (opts.dataLabels) {
        s.values.forEach((v, i) => {
          svg.appendChild(el("text", {
            x: x(i), y: y(v) - 10, "text-anchor": "middle",
            "font-family": "var(--voux-font-mono)", "font-size": 10,
            fill: color, "letter-spacing": "0.02em",
          }, (opts.dataLabelFmt || fmtCompact)(v)));
        });
      }
    });

    mount.appendChild(svg);
  }

  // ============================================================
  // 3. BAR (vertical)
  // ============================================================
  function barV(mount, labels, values, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 600;
    const h = opts.height || 220;
    mount.style.height = h + "px";

    const padL = 32, padR = 16, padT = 24, padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const max = Math.max(...values) * 1.15;

    const bandW = plotW / values.length;
    const barW = Math.min(40, bandW * 0.55);
    const color = opts.color || COLORS.accent;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });

    // gridline baseline
    svg.appendChild(el("line", {
      x1: padL, x2: padL + plotW,
      y1: padT + plotH, y2: padT + plotH,
      stroke: COLORS.gridStrong, "stroke-width": 1,
    }));

    values.forEach((v, i) => {
      const bx = padL + i * bandW + (bandW - barW)/2;
      const bh = (v / max) * plotH;
      const by = padT + plotH - bh;
      const gid = "bar-v-" + Math.random().toString(36).slice(2,7);
      const def = el("defs");
      const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
      lg.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": 1 }));
      lg.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0.6 }));
      def.appendChild(lg);
      svg.appendChild(def);

      const r = el("rect", {
        x: bx, y: padT + plotH, width: barW, height: 0,
        rx: 3, fill: `url(#${gid})`,
      });
      svg.appendChild(r);
      requestAnimationFrame(() => {
        r.setAttribute("y", by);
        r.setAttribute("height", bh);
        r.style.transition = "y 700ms cubic-bezier(0.22, 1, 0.36, 1), height 700ms cubic-bezier(0.22, 1, 0.36, 1)";
      });

      if (opts.dataLabels) {
        svg.appendChild(el("text", {
          x: bx + barW/2, y: by - 8, "text-anchor": "middle",
          "font-family": "var(--voux-font-mono)", "font-size": 10,
          fill: COLORS.ink, "letter-spacing": "0.02em",
        }, (opts.fmt || fmtCompact)(v)));
      }

      svg.appendChild(el("text", {
        x: bx + barW/2, y: padT + plotH + 18, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.08em",
      }, labels[i]));
    });

    mount.appendChild(svg);
  }

  // ============================================================
  // 4. DONUT
  // ============================================================
  // data = [{ label, value, color }]
  function donut(mount, data, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 240;
    const h = opts.height || 200;
    mount.style.height = h + "px";

    const cx = w / 2, cy = h / 2;
    const r = Math.min(cx, cy) - 18;
    const rIn = r - (opts.thickness || 22);
    const total = data.reduce((a, d) => a + d.value, 0);

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    let a0 = -Math.PI/2;
    const palette = [COLORS.accent, COLORS.info, COLORS.success, COLORS.warning, COLORS.danger, COLORS.accent3, COLORS.inkMuted];

    data.forEach((d, i) => {
      const frac = total > 0 ? d.value / total : 0;
      const a1 = a0 + frac * Math.PI * 2;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const x0 = cx + Math.cos(a0) * r;
      const y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      const xi1 = cx + Math.cos(a1) * rIn;
      const yi1 = cy + Math.sin(a1) * rIn;
      const xi0 = cx + Math.cos(a0) * rIn;
      const yi0 = cy + Math.sin(a0) * rIn;
      const pd = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${rIn} ${rIn} 0 ${large} 0 ${xi0} ${yi0} Z`;
      svg.appendChild(el("path", { d: pd, fill: d.color || palette[i % palette.length], opacity: 0.92 }));
      a0 = a1;
    });

    // center text
    if (opts.centerLabel) {
      svg.appendChild(el("text", {
        x: cx, y: cy - 2, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.22em",
      }, opts.centerLabel));
    }
    if (opts.centerValue) {
      svg.appendChild(el("text", {
        x: cx, y: cy + 18, "text-anchor": "middle",
        "font-family": displayFont(), "font-size": 28, "font-weight": displayWeight(),
        fill: COLORS.ink, "letter-spacing": "-0.022em",
      }, opts.centerValue));
    }

    mount.appendChild(svg);
  }

  // ============================================================
  // 5. SPARKLINE (mini line)
  // ============================================================
  function sparkline(mount, values, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 120;
    const h = opts.height || 30;
    mount.style.height = h + "px";
    const max = Math.max(...values), min = Math.min(...values);
    const range = max - min || 1;
    const x = i => (i / (values.length - 1)) * (w - 4) + 2;
    const y = v => h - 2 - ((v - min) / range) * (h - 4);
    const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    const color = opts.color || COLORS.accent;
    const gid = "sp-grad-" + Math.random().toString(36).slice(2,7);
    const def = el("defs");
    const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(el("stop", { offset: "0%", "stop-color": color, "stop-opacity": 0.3 }));
    lg.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0 }));
    def.appendChild(lg);
    svg.appendChild(def);
    svg.appendChild(el("path", {
      d: path + ` L ${x(values.length-1)} ${h} L ${x(0)} ${h} Z`,
      fill: `url(#${gid})`,
    }));
    svg.appendChild(el("path", {
      d: path, fill: "none",
      stroke: color, "stroke-width": 1.4,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
    mount.appendChild(svg);
  }

  // ============================================================
  // 6. GAUGE (semi-circular)
  // ============================================================
  function gauge(mount, value, max, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 240;
    const h = opts.height || 150;
    mount.style.height = h + "px";

    const cx = w/2, cy = h - 12;
    const r = Math.min(cx, h - 30);
    const thickness = opts.thickness || 14;
    const startAngle = Math.PI; // 180
    const endAngle = 2 * Math.PI; // 360
    const ratio = Math.min(1, Math.max(0, value / max));
    const valueAngle = startAngle + ratio * Math.PI;

    function arc(a0, a1) {
      const x0 = cx + Math.cos(a0) * r;
      const y0 = cy + Math.sin(a0) * r;
      const x1 = cx + Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      const xi1 = cx + Math.cos(a1) * (r - thickness);
      const yi1 = cy + Math.sin(a1) * (r - thickness);
      const xi0 = cx + Math.cos(a0) * (r - thickness);
      const yi0 = cy + Math.sin(a0) * (r - thickness);
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r-thickness} ${r-thickness} 0 ${large} 0 ${xi0} ${yi0} Z`;
    }

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    // track
    svg.appendChild(el("path", { d: arc(startAngle, endAngle), fill: "rgba(214, 207, 193, 0.06)" }));
    // value
    svg.appendChild(el("path", { d: arc(startAngle, valueAngle), fill: opts.color || COLORS.accent }));

    // value text
    svg.appendChild(el("text", {
      x: cx, y: cy - r/3 + 18, "text-anchor": "middle",
      "font-family": displayFont(), "font-size": 32, "font-weight": displayWeight(),
      fill: COLORS.ink, "letter-spacing": "-0.022em",
    }, opts.valueText || value.toLocaleString("pt-BR")));
    // labels
    svg.appendChild(el("text", {
      x: 8, y: cy + 18,
      "font-family": "var(--voux-font-mono)", "font-size": 10,
      fill: COLORS.inkFaint, "letter-spacing": "0.06em",
    }, "0"));
    svg.appendChild(el("text", {
      x: w - 8, y: cy + 18, "text-anchor": "end",
      "font-family": "var(--voux-font-mono)", "font-size": 10,
      fill: COLORS.inkFaint, "letter-spacing": "0.06em",
    }, fmtCompact(max)));

    mount.appendChild(svg);
  }

  // ============================================================
  // 7. STACKED BAR (vertical)
  // ============================================================
  // labels, series = [{name, color, values:[]}]
  function barStacked(mount, labels, series, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 600;
    const h = opts.height || 240;
    mount.style.height = h + "px";

    const padL = 40, padR = 16, padT = 24, padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = Math.max(...totals) * 1.15 || 1;
    const bandW = plotW / labels.length;
    const barW = Math.min(36, bandW * 0.5);

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });

    // baseline
    svg.appendChild(el("line", {
      x1: padL, x2: padL + plotW,
      y1: padT + plotH, y2: padT + plotH,
      stroke: COLORS.gridStrong, "stroke-width": 1,
    }));

    labels.forEach((lbl, i) => {
      const bx = padL + i * bandW + (bandW - barW)/2;
      let yCur = padT + plotH;
      series.forEach((s, j) => {
        const v = s.values[i] || 0;
        const bh = (v / max) * plotH;
        yCur -= bh;
        if (bh > 0) {
          svg.appendChild(el("rect", {
            x: bx, y: yCur, width: barW, height: bh,
            rx: j === 0 ? 0 : 2,
            fill: s.color, opacity: 0.92,
          }));
        }
      });
      svg.appendChild(el("text", {
        x: bx + barW/2, y: padT + plotH + 18, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.08em",
      }, lbl));
      if (opts.totals) {
        svg.appendChild(el("text", {
          x: bx + barW/2, y: yCur - 6, "text-anchor": "middle",
          "font-family": "var(--voux-font-mono)", "font-size": 10,
          fill: COLORS.ink, "letter-spacing": "0.02em",
        }, fmtCompact(totals[i])));
      }
    });

    mount.appendChild(svg);
  }

  // ============================================================
  // 8. RADIAL PROGRESS (circle)
  // ============================================================
  function radial(mount, value, max, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 200;
    const h = opts.height || 200;
    mount.style.height = h + "px";
    const cx = w/2, cy = h/2;
    const r = Math.min(cx, cy) - 12;
    const thickness = opts.thickness || 10;
    const ratio = Math.min(1, value/max);
    const C = 2 * Math.PI * r;
    const color = opts.color || COLORS.accent;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    svg.appendChild(el("circle", {
      cx, cy, r, fill: "none",
      stroke: "rgba(214, 207, 193, 0.06)", "stroke-width": thickness,
    }));
    svg.appendChild(el("circle", {
      cx, cy, r, fill: "none",
      stroke: color, "stroke-width": thickness,
      "stroke-linecap": "round",
      "stroke-dasharray": `${ratio * C} ${C}`,
      transform: `rotate(-90 ${cx} ${cy})`,
    }));

    // center
    svg.appendChild(el("text", {
      x: cx, y: cy + 4, "text-anchor": "middle",
      "font-family": displayFont(), "font-size": 28, "font-weight": displayWeight(),
      fill: COLORS.ink, "letter-spacing": "-0.022em",
    }, opts.label || `${(ratio*100).toFixed(1)}%`));
    if (opts.subLabel) {
      svg.appendChild(el("text", {
        x: cx, y: cy + 26, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.22em",
      }, opts.subLabel));
    }
    mount.appendChild(svg);
  }

  // ============================================================
  // 9. AREA HEATBAR (single row of bars w/ varied intensity)
  // Useful for "by day of month" type charts
  // ============================================================
  function heatbar(mount, values, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 600;
    const h = opts.height || 60;
    mount.style.height = h + "px";
    const max = Math.max(...values);
    const barW = (w - 4) / values.length;
    const color = opts.color || COLORS.accent;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    values.forEach((v, i) => {
      const intensity = max > 0 ? v / max : 0;
      const bh = 8 + intensity * (h - 18);
      svg.appendChild(el("rect", {
        x: 2 + i * barW + 1, y: h - bh - 12,
        width: Math.max(1, barW - 2), height: bh,
        rx: 1.5,
        fill: color, opacity: 0.25 + intensity * 0.75,
      }));
      if (opts.labels && i % opts.labelStep === 0) {
        svg.appendChild(el("text", {
          x: 2 + i * barW + barW/2, y: h - 2, "text-anchor": "middle",
          "font-family": "var(--voux-font-mono)", "font-size": 9,
          fill: COLORS.inkFaint, "letter-spacing": "0.06em",
        }, opts.labels[i]));
      }
    });
    mount.appendChild(svg);
  }

  // ============================================================
  // 10. DUAL HORIZONTAL BAR (com / sem comparativo)
  // ============================================================
  function barHDual(mount, data, opts = {}) {
    // data: [{ label, a, b }] -- e.g. com OS vs sem OS
    clearMount(mount);
    const w = mount.clientWidth || 400;
    const rowH = 36;
    const gap = 12;
    const labelW = 70;
    const h = data.length * (rowH + gap);
    mount.style.height = h + "px";

    const max = Math.max(...data.flatMap(d => [d.a, d.b]));
    const barX = labelW + 12;
    const barMaxW = w - barX - 50;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    data.forEach((d, i) => {
      const y = i * (rowH + gap);
      svg.appendChild(el("text", {
        x: labelW, y: y + rowH/2 + 4, "text-anchor": "end",
        "font-family": "var(--voux-font-sans)", "font-size": 12,
        fill: COLORS.inkSoft,
      }, d.label));
      // bar A
      const aw = (d.a / max) * barMaxW;
      svg.appendChild(el("rect", {
        x: barX, y: y + 2, width: aw, height: 13, rx: 3,
        fill: opts.colorA || COLORS.accent, opacity: 0.85,
      }));
      svg.appendChild(el("text", {
        x: barX + aw + 6, y: y + 13, "font-family": "var(--voux-font-mono)",
        "font-size": 10, fill: COLORS.ink,
      }, d.a.toLocaleString("pt-BR")));
      // bar B
      const bw = (d.b / max) * barMaxW;
      svg.appendChild(el("rect", {
        x: barX, y: y + 19, width: bw, height: 13, rx: 3,
        fill: opts.colorB || COLORS.info, opacity: 0.85,
      }));
      svg.appendChild(el("text", {
        x: barX + bw + 6, y: y + 30, "font-family": "var(--voux-font-mono)",
        "font-size": 10, fill: COLORS.ink,
      }, d.b.toLocaleString("pt-BR")));
    });
    mount.appendChild(svg);
  }

  // ============================================================
  // 11. LINE w/ growth labels (mostra valor abaixo + % crescimento acima)
  //   data: [{ label, value, growth }]
  // ============================================================
  function lineGrowth(mount, data, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 700;
    const h = opts.height || 360;
    mount.style.height = h + "px";

    const padL = 24, padR = 24, padT = 60, padB = 56;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const values = data.map(d => d.value);
    let max = Math.max(...values), min = Math.min(...values);
    if (max === min) max = min + 1;
    const yRange = max - min;
    max = max + yRange * 0.12;
    min = Math.max(0, min - yRange * 0.10);

    const x = i => padL + (data.length === 1 ? plotW/2 : (i / (data.length - 1)) * plotW);
    const y = v => padT + plotH - ((v - min) / (max - min)) * plotH;
    const color = opts.color || COLORS.success;
    const labelColor = opts.labelColor || COLORS.warning;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });

    // path + area
    const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
    const areaD = pathD + ` L ${x(data.length-1)} ${padT + plotH} L ${x(0)} ${padT + plotH} Z`;
    const gid = "growth-area-" + Math.random().toString(36).slice(2,7);
    const def = el("defs");
    const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(el("stop", { offset: "0%",   "stop-color": color, "stop-opacity": 0.20 }));
    lg.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0    }));
    def.appendChild(lg);
    svg.appendChild(def);
    svg.appendChild(el("path", { d: areaD, fill: `url(#${gid})` }));
    svg.appendChild(el("path", {
      d: pathD, fill: "none", stroke: color, "stroke-width": 1.5,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));

    // points + labels
    const fmt = opts.fmt || (v => "R$ " + fmtCompact(v));
    data.forEach((d, i) => {
      const cx = x(i), cy = y(d.value);
      svg.appendChild(el("circle", { cx, cy, r: 3, fill: COLORS.surface, stroke: color, "stroke-width": 1.5 }));

      // growth % above
      if (d.growth !== null && d.growth !== undefined) {
        const g = (d.growth >= 0 ? "+" : "") + d.growth.toFixed(2) + "%";
        svg.appendChild(el("text", {
          x: cx, y: cy - 16, "text-anchor": "middle",
          "font-family": "var(--voux-font-mono)", "font-size": 10,
          fill: labelColor, "letter-spacing": "0.04em",
        }, g));
      }
      // value below
      svg.appendChild(el("text", {
        x: cx, y: cy + 18, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.ink, "letter-spacing": "0.02em",
      }, fmt(d.value)));

      // X label (month)
      svg.appendChild(el("text", {
        x: cx, y: h - padB + 22, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 9,
        fill: COLORS.inkMuted, "letter-spacing": "0.10em",
        transform: opts.rotateLabels ? `rotate(-60 ${cx} ${h - padB + 22})` : "",
      }, d.label));
    });

    // year separator (optional)
    if (opts.yearSplit) {
      const splitIdx = opts.yearSplit.idx;
      const xs = x(splitIdx - 0.5);
      svg.appendChild(el("line", {
        x1: xs, x2: xs, y1: padT - 30, y2: h - padB + 30,
        stroke: COLORS.gridStrong, "stroke-width": 1,
      }));
      svg.appendChild(el("text", {
        x: x(opts.yearSplit.leftMid), y: h - 6, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.18em",
      }, opts.yearSplit.leftLabel));
      svg.appendChild(el("text", {
        x: x(opts.yearSplit.rightMid), y: h - 6, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.18em",
      }, opts.yearSplit.rightLabel));
    }

    mount.appendChild(svg);
  }

  // ============================================================
  // 12. FUNNEL (horizontal bars descending)
  // ============================================================
  // data: [{ label, value }]
  function funnel(mount, data, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 500;
    const rowH = 36;
    const gap = 12;
    const labelW = 110;
    const h = data.length * (rowH + gap);
    mount.style.height = h + "px";

    const max = Math.max(...data.map(d => d.value));
    const color = opts.color || COLORS.success;
    const fmt = opts.fmt || (v => "R$ " + fmtCompact(v));

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });
    data.forEach((d, i) => {
      const y = i * (rowH + gap);
      const ratio = d.value / max;
      const bw = ratio * (w - labelW - 30);
      const bx = labelW + ((w - labelW - 30 - bw) / 2);
      svg.appendChild(el("text", {
        x: labelW - 12, y: y + rowH/2 + 5, "text-anchor": "end",
        "font-family": "var(--voux-font-sans)", "font-size": 12,
        fill: COLORS.inkSoft,
      }, d.label));
      const gid = "funnel-" + Math.random().toString(36).slice(2,7);
      const def = el("defs");
      const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 });
      lg.appendChild(el("stop", { offset: "0%",   "stop-color": color, "stop-opacity": 0.6 }));
      lg.appendChild(el("stop", { offset: "100%", "stop-color": color, "stop-opacity": 0.9 }));
      def.appendChild(lg);
      svg.appendChild(def);
      svg.appendChild(el("rect", {
        x: bx, y: y + 8, width: bw, height: rowH - 16, rx: 4,
        fill: `url(#${gid})`,
      }));
      svg.appendChild(el("text", {
        x: bx + bw - 8, y: y + rowH/2 + 4, "text-anchor": "end",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.ink, "letter-spacing": "0.02em",
      }, fmt(d.value)));
    });
    mount.appendChild(svg);
  }

  // ============================================================
  // 13. DUAL LINE w/ shaded area between (inadimplência)
  // ============================================================
  // data: [{ label, total, aberto, pct }]
  function dualLineArea(mount, data, opts = {}) {
    clearMount(mount);
    const w = mount.clientWidth || 700;
    const h = opts.height || 320;
    mount.style.height = h + "px";
    const padL = 30, padR = 30, padT = 56, padB = 50;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const max = Math.max(...data.map(d => d.total)) * 1.1;
    const min = 0;

    const x = i => padL + (data.length === 1 ? plotW/2 : (i / (data.length - 1)) * plotW);
    const y = v => padT + plotH - ((v - min) / (max - min)) * plotH;
    const colorTotal = opts.colorTotal || COLORS.danger;
    const colorAberto = opts.colorAberto || COLORS.danger;
    const labelColor = opts.labelColor || COLORS.warning;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h });

    // area between total and aberto (highlights the inadimplência region)
    const totalPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.total)}`).join(" ");
    const abertoPathRev = [...data].reverse().map((d, i) => `L ${x(data.length - 1 - i)} ${y(d.aberto)}`).join(" ");
    const areaD = totalPath + " " + abertoPathRev + " Z";
    const gid = "dual-area-" + Math.random().toString(36).slice(2,7);
    const def = el("defs");
    const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    lg.appendChild(el("stop", { offset: "0%",   "stop-color": colorTotal, "stroke-opacity": 1, "stop-opacity": 0.12 }));
    lg.appendChild(el("stop", { offset: "100%", "stop-color": colorTotal, "stop-opacity": 0.04 }));
    def.appendChild(lg);
    svg.appendChild(def);
    svg.appendChild(el("path", { d: areaD, fill: `url(#${gid})` }));

    // total line
    svg.appendChild(el("path", {
      d: totalPath, fill: "none", stroke: colorTotal, "stroke-width": 1.5,
      "stroke-opacity": 0.65, "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
    // aberto line
    const abertoPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.aberto)}`).join(" ");
    svg.appendChild(el("path", {
      d: abertoPath, fill: "none", stroke: colorAberto, "stroke-width": 1.5,
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));

    // points + labels
    data.forEach((d, i) => {
      const cx = x(i);
      // top: pct
      if (d.pct !== undefined) {
        svg.appendChild(el("text", {
          x: cx, y: padT - 28, "text-anchor": "middle",
          "font-family": "var(--voux-font-mono)", "font-size": 10,
          fill: labelColor, "letter-spacing": "0.04em",
        }, d.pct.toFixed(2) + "%"));
      }
      // total value
      svg.appendChild(el("text", {
        x: cx, y: y(d.total) - 10, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkSoft, "letter-spacing": "0.02em",
      }, "R$ " + d.total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
      // aberto value
      svg.appendChild(el("text", {
        x: cx, y: y(d.aberto) + 18, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: colorAberto, "letter-spacing": "0.02em",
      }, "R$ " + d.aberto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
      // points
      svg.appendChild(el("circle", { cx, cy: y(d.total), r: 3, fill: COLORS.surface, stroke: colorTotal, "stroke-width": 1.5 }));
      svg.appendChild(el("circle", { cx, cy: y(d.aberto), r: 3, fill: COLORS.surface, stroke: colorAberto, "stroke-width": 1.5 }));
      // x label
      svg.appendChild(el("text", {
        x: cx, y: h - 16, "text-anchor": "middle",
        "font-family": "var(--voux-font-mono)", "font-size": 10,
        fill: COLORS.inkMuted, "letter-spacing": "0.10em",
      }, d.label));
    });

    mount.appendChild(svg);
  }

  window.VOUX_CHART = {
    barH, line, barV, donut, sparkline, gauge, barStacked, radial, heatbar, barHDual,
    lineGrowth, funnel, dualLineArea,
    COLORS, fmtCompact, fmtBRLCompact,
  };
})();

import type { ReactNode } from "react";

export function BigCard({ label, value, icon, color, sub, large }: { label: string; value: string; icon: ReactNode; color: string; sub?: string; large?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[var(--voux-card-from)] to-[var(--voux-card-to)] border border-[var(--voux-card-border)] shadow-[var(--voux-card-shadow)]"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)]">{label}</span>
        <span className="opacity-40 text-[var(--voux-text-faint)] [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      </div>
      <p className={`font-bold leading-none tracking-[-0.02em] mb-1 ${large ? "text-[36px]" : "text-[28px]"}`} style={{ color }}>{value}</p>
      {sub && <p className="font-mono text-[11px] text-[var(--voux-text-faint)] mt-2">{sub}</p>}
    </div>
  );
}

export function MetricCard({ label, value, status, sub }: { label: string; value: string; status: "ok" | "danger" | "neutral"; sub?: string }) {
  const accentColor = status === "ok" ? "hsl(152,69%,40%)" : status === "danger" ? "hsl(0,84%,60%)" : undefined;
  const leftBorder = status === "ok" ? "hsl(152,69%,40%)" : status === "danger" ? "hsl(0,84%,60%)" : undefined;
  return (
    <div
      className="relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[var(--voux-card-from)] to-[var(--voux-card-to)] border border-[var(--voux-card-border)] shadow-[var(--voux-card-shadow)]"
      style={leftBorder ? { borderLeftColor: leftBorder, borderLeftWidth: 3 } : undefined}
    >
      <div className="mb-4">
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--voux-text-faint)]">{label}</span>
      </div>
      <p className="text-[28px] font-bold leading-none tracking-[-0.02em] mb-1" style={{ color: accentColor || "var(--voux-text-primary)" }}>{value}</p>
      {sub && <p className="font-mono text-[11px] text-[var(--voux-text-faint)] mt-2">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[hsl(217,91%,60%)]">{icon}</span>
      <h2 className="text-lg font-black tracking-wide uppercase">{title}</h2>
      <div className="flex-1 h-px bg-[hsl(217,33%,17%)]" />
    </div>
  );
}

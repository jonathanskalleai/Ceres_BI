export function SectionEyebrow({ label }: { label: string }) {
  return (
    <h2
      className="text-[10px] tracking-[0.22em] uppercase mb-4 mt-8 first:mt-0"
      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
    >
      {"— "}{label}
    </h2>
  );
}

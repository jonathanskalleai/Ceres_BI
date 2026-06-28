import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

interface SlideLayoutProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}

export function SlideLayout({ title, subtitle, icon, children }: SlideLayoutProps) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[hsl(222,47%,6%)] to-[hsl(222,47%,8%)]">
      <div className="px-12 pt-10 pb-4 border-b border-[hsl(217,33%,17%)]">
        <div className="flex items-center gap-3 mb-1 anim-fade-up">
          <span className="text-[hsl(217,91%,60%)]">{icon}</span>
          <h2 className="text-3xl font-black tracking-tight">{title}</h2>
        </div>
        <p className="text-sm text-[hsl(215,16%,57%)] ml-10 anim-fade-up" style={{ animationDelay: "0.05s" }}>{subtitle}</p>
      </div>
      <div className="flex-1 px-12 py-4 overflow-hidden">
        {children}
      </div>
      <div className="px-12 py-2 border-t border-[hsl(217,33%,12%)] flex justify-between text-xs text-[hsl(215,16%,57%)]">
        <span>Ceres Equipamentos Agrícolas</span>
        <span>Performance Comercial 2026</span>
      </div>
    </div>
  );
}

interface StatBoxProps {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
  large?: boolean;
  delay?: number;
}

export function StatBox({ icon, label, value, color, large, delay = 0 }: StatBoxProps) {
  return (
    <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-xl p-6 text-center anim-scale-in" style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center justify-center gap-2 mb-3" style={{ color }}>
        {icon}
        <span className="text-xs font-bold tracking-widest uppercase">{label}</span>
      </div>
      <p className={`font-black ${large ? "text-4xl" : "text-3xl"}`} style={{ color }}>{value}</p>
    </div>
  );
}

interface RankRowProps {
  pos: number;
  name: string;
  value: string;
  isTop: boolean;
  delay?: number;
}

export function RankRow({ pos, name, value, isTop, delay = 0 }: RankRowProps) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg anim-fade-up ${isTop ? "bg-[hsl(152,69%,10%)] border border-[hsl(152,69%,25%)]" : "bg-[hsl(217,33%,12%)]"}`} style={{ animationDelay: `${delay}s` }}>
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isTop ? "bg-[hsl(38,92%,50%)] text-[hsl(222,47%,6%)]" : "bg-[hsl(217,33%,17%)] text-[hsl(215,16%,57%)]"}`}>
        {pos}
      </span>
      <span className="flex-1 text-sm font-medium truncate">{name}</span>
      <span className="text-sm font-bold">{value}</span>
      {isTop && <Trophy className="h-4 w-4 text-[hsl(38,92%,50%)]" />}
    </div>
  );
}

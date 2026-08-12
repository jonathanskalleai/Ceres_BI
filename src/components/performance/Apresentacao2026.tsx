import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { DadosComerciais } from "@/types/comercial";
import { NegociosSummary } from "@/types/negociosSummary";
import { useApresentacaoData } from "./useApresentacaoData";
import { buildSlidesIntro } from "./SlidesIntro";
import { buildSlidesDetail } from "./SlidesDetail";
import { ApresentacaoControls } from "./ApresentacaoControls";

interface Props {
  crmData: DadosComerciais;
  negData: NegociosSummary;
}

export function Apresentacao2026({ crmData, negData }: Props) {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animKey, setAnimKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useApresentacaoData(crmData, negData);

  const slides = useMemo(
    () => [...buildSlidesIntro(data), ...buildSlidesDetail(data)],
    [data],
  );

  const totalSlides = slides.length;

  const goToSlide = useCallback((idx: number, dir: "next" | "prev") => {
    setDirection(dir);
    setSlide(idx);
    setAnimKey(k => k + 1);
  }, []);

  const next = useCallback(() => {
    setSlide(s => {
      const n = Math.min(s + 1, totalSlides - 1);
      if (n !== s) { setDirection("next"); setAnimKey(k => k + 1); }
      return n;
    });
  }, [totalSlides]);

  const prev = useCallback(() => {
    setSlide(s => {
      const n = Math.max(s - 1, 0);
      if (n !== s) { setDirection("prev"); setAnimKey(k => k + 1); }
      return n;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen();
      if (e.key === "f" || e.key === "F5") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, isFullscreen, toggleFullscreen]);

  const slideAnimClass = direction === "next" ? "slide-enter-right" : "slide-enter-left";

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[hsl(222,47%,4%)] flex flex-col">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
        @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes slideEnterRight { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideEnterLeft { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: translateX(0); } }
        .anim-fade-up { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .anim-scale-in { animation: scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .anim-bar-grow { animation: barGrow 1s cubic-bezier(0.16,1,0.3,1) both; transform-origin: left; animation-delay: 0.4s; }
        .slide-enter-right { animation: slideEnterRight 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .slide-enter-left { animation: slideEnterLeft 0.5s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <div className="w-full h-full max-w-[1920px] max-h-[1080px] aspect-video relative">
          <div key={animKey} className={`absolute inset-0 text-[hsl(210,40%,96%)] ${slideAnimClass}`}>
            {slides[slide]()}
          </div>
        </div>
      </div>

      <ApresentacaoControls
        slide={slide}
        totalSlides={totalSlides}
        isFullscreen={isFullscreen}
        onPrev={prev}
        onNext={next}
        onGoToSlide={goToSlide}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}

import { ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";

interface ApresentacaoControlsProps {
  slide: number;
  totalSlides: number;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToSlide: (idx: number, dir: "next" | "prev") => void;
  onToggleFullscreen: () => void;
}

export function ApresentacaoControls({
  slide,
  totalSlides,
  isFullscreen,
  onPrev,
  onNext,
  onGoToSlide,
  onToggleFullscreen,
}: ApresentacaoControlsProps) {
  return (
    <div className={`flex items-center justify-between px-6 py-3 bg-[hsl(222,47%,6%)] border-t border-[hsl(217,33%,17%)] ${isFullscreen ? "absolute bottom-0 left-0 right-0 opacity-0 hover:opacity-100 transition-opacity" : ""}`}>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={slide === 0} className="p-2 rounded-lg hover:bg-[hsl(217,33%,17%)] disabled:opacity-30 transition-colors text-[hsl(210,40%,96%)]" aria-label="Slide anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-mono text-[hsl(215,16%,57%)] min-w-[60px] text-center">
          {slide + 1} / {totalSlides}
        </span>
        <button onClick={onNext} disabled={slide === totalSlides - 1} className="p-2 rounded-lg hover:bg-[hsl(217,33%,17%)] disabled:opacity-30 transition-colors text-[hsl(210,40%,96%)]" aria-label="Próximo slide">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Navegação de slides">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            onClick={() => onGoToSlide(i, i > slide ? "next" : "prev")}
            aria-label={`Ir para slide ${i + 1}`}
            aria-selected={i === slide}
            role="tab"
            className={`h-2 rounded-full transition-all duration-300 ${i === slide ? "w-6 bg-[hsl(217,91%,60%)]" : "w-2 bg-[hsl(217,33%,25%)] hover:bg-[hsl(217,33%,35%)]"}`}
          />
        ))}
      </div>

      <button onClick={onToggleFullscreen} className="p-2 rounded-lg hover:bg-[hsl(217,33%,17%)] transition-colors text-[hsl(210,40%,96%)]" aria-label={isFullscreen ? "Sair do fullscreen" : "Entrar em fullscreen"}>
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </button>
    </div>
  );
}

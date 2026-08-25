import { useState, memo } from "react";
import { cn } from "@/lib/utils";
import { getConsultorAvatarUrl } from "@/lib/avatarUtils";

interface AvatarPersonaProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AvatarPersona = memo(function AvatarPersona({
  name,
  className,
  size = "md",
}: AvatarPersonaProps) {
  const [hasError, setHasError] = useState(false);
  const initials = getInitials(name);
  const avatarUrl = getConsultorAvatarUrl(name);

  const sizeClasses = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-11 w-11 text-xs",
    lg: "h-14 w-14 text-sm",
  }[size];

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border overflow-hidden bg-slate-800 ring-2 ring-black/10 dark:ring-white/10 font-mono font-bold transition-transform",
        sizeClasses,
        className
      )}
      style={{ borderColor: "var(--voux-card-border)" }}
    >
      {!hasError ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover select-none scale-105"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="text-foreground">{initials}</span>
      )}
    </div>
  );
});

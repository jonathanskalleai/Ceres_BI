import { TrendingDown, TrendingUp, Minus } from 'lucide-react'

export type KpiTone = 'default' | 'success' | 'warning' | 'danger'

export interface KpiDelta {
  previous?: string
  direction: 'up' | 'down' | 'flat'
  outcome: 'positive' | 'negative' | 'neutral'
  pct?: string
}

interface VouxKpiCardProps {
  label: string
  value: string | number
  scope?: string
  tone?: KpiTone
  delta?: KpiDelta
}

const TONE_CONFIG: Record<KpiTone, { border: string; bg: string; accent: string }> = {
  default: {
    border: 'border-[var(--voux-border-alpha)]',
    bg: 'bg-[var(--voux-surface)]',
    accent: 'var(--voux-accent)',
  },
  success: {
    border: 'border-[color:color-mix(in_srgb,var(--voux-border-alpha)_70%,var(--voux-success))]',
    bg: 'bg-gradient-to-br from-[rgba(122,155,111,0.06)] to-[var(--voux-surface)]',
    accent: 'var(--voux-success)',
  },
  warning: {
    border: 'border-[color:color-mix(in_srgb,var(--voux-border-alpha)_70%,var(--voux-warning))]',
    bg: 'bg-gradient-to-br from-[rgba(212,160,90,0.06)] to-[var(--voux-surface)]',
    accent: 'var(--voux-warning)',
  },
  danger: {
    border: 'border-[color:color-mix(in_srgb,var(--voux-border-alpha)_70%,var(--voux-danger))]',
    bg: 'bg-gradient-to-br from-[rgba(201,117,101,0.08)] to-[var(--voux-surface)]',
    accent: 'var(--voux-danger)',
  },
}

export function VouxKpiCard({ label, value, scope, tone = 'default', delta }: VouxKpiCardProps) {
  const config = TONE_CONFIG[tone]
  const deltaColor = delta
    ? delta.outcome === 'positive' ? '#22c55e'
    : delta.outcome === 'negative' ? '#e74c3c'
    : 'var(--voux-text-muted)'
    : undefined
  const TrendIcon = delta?.direction === 'down' ? TrendingDown : delta?.direction === 'flat' ? Minus : TrendingUp

  return (
    <article className={`group relative overflow-hidden rounded-2xl border ${config.border} ${config.bg} shadow-[var(--voux-card-shadow)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-4px_rgba(212,184,150,0.20)]`}>
      {/* Decorative accent circle */}
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.07]" style={{ background: config.accent }} />

      {/* Label */}
      <div className="text-xs font-mono tracking-[0.08em] uppercase font-semibold" style={{ color: config.accent }}>
        {label}
      </div>

      {/* Value */}
      <div className="mt-1.5 font-mono text-2xl font-bold leading-tight" style={{ color: 'var(--voux-text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </div>

      {/* Scope */}
      {scope && (
        <div className="mt-1 text-xs" style={{ color: 'var(--voux-text-muted)' }}>
          {scope}
        </div>
      )}

      {/* Delta */}
      {delta && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: deltaColor }}>
          <TrendIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {delta.pct && <span className="font-mono">{delta.pct}</span>}
          {delta.previous && (
            <span style={{ color: 'var(--voux-text-muted)', fontWeight: 400 }}>ant: {delta.previous}</span>
          )}
        </div>
      )}
    </article>
  )
}

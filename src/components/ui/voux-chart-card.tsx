interface ChartCardProps {
  children: React.ReactNode
  className?: string
}

export function ChartCard({ children, className = '' }: ChartCardProps) {
  return (
    <div className={`flex flex-col voux-card p-6 ${className}`}>
      {children}
    </div>
  )
}

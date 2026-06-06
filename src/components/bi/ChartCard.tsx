import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface ChartCardProps {
  title: string;
  description?: string;
  infoTooltip?: string;
  height?: number;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Card "vidro" (glassmorphism) que envolve os gráficos do BI: fundo translúcido
 * + blur + borda sutil. O conteúdo recebe uma altura fixa e os gráficos ECharts
 * preenchem 100% dessa área (eles já são responsivos — não usar ResponsiveContainer).
 */
export function ChartCard({
  title,
  description,
  infoTooltip,
  height = 280,
  loading = false,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "border-border/50 bg-card/80 backdrop-blur-sm shadow-sm",
        "rounded-2xl transition-shadow hover:shadow-md",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {title}
          {infoTooltip && <InfoTooltip text={infoTooltip} />}
        </CardTitle>
        {description && (
          <CardDescription className="text-xs">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton style={{ height }} className="w-full rounded-xl" />
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

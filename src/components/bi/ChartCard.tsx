import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
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
  height = 280,
  loading = false,
  className,
  children,
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "border-white/40 bg-white/55 shadow-lg backdrop-blur-xl",
        "dark:border-white/10 dark:bg-white/[0.04]",
        "rounded-2xl transition-shadow hover:shadow-xl",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
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

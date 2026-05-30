import type { ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ElementType;
  hint?: string;
  loading?: boolean;
}

export function KPICard({ title, value, icon: Icon, hint, loading = false }: KPICardProps) {
  return (
    <Card
      className={cn(
        "border-white/40 bg-white/55 shadow-md backdrop-blur-xl",
        "dark:border-white/10 dark:bg-white/[0.04]",
        "rounded-2xl transition-shadow hover:shadow-lg",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

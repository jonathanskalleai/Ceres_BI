import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import type { KPISuggestion } from '@/types/insights';

export const KPICards = ({
  kpis
}: {
  kpis: KPISuggestion[];
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.kpi_id}>
            <CardHeader>
              <CardTitle className="text-base">{kpi.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {kpi.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Formula:</span>
                  <code className="ml-1 text-xs bg-muted px-1 rounded">
                    {kpi.metric_formula}
                  </code>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Agregacao:</span>
                  <span className="font-medium">{kpi.metric_aggregation}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Fonte:</span>
                  <span className="text-muted-foreground">{kpi.data_source}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

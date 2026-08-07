import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Insight } from '@/types/insights';

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
};

export const InsightCards = ({
  insights,
  onNavigateToInsight
}: {
  insights: Insight[];
  onNavigateToInsight: (insightId: string) => void;
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline">Total: {insights.length}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight) => (
          <Card key={insight.insight_id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onNavigateToInsight(insight.insight_id)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{insight.title}</CardTitle>
                <Badge
                  className={`border-l-4 ${severityColors[insight.severity] ?? ''}`}
                >
                  {insight.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {insight.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {insight.metric_value && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Metrica:</span>
                    <span className="font-medium">{insight.metric_value}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span>Fonte:</span>
                  <span className="text-muted-foreground">{insight.data_source}</span>
                </div>
                {insight.recommendation && (
                  <p className="text-xs text-muted-foreground">
                    {insight.recommendation}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

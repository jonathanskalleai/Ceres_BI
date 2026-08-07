import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HealthData {
  dashboards_count: number;
  total_insights: number;
  relevant_insights: number;
}

interface AnalysisStatusData {
  view_analysis: string;
  business_context: string;
  insights_generation: string;
}

export const AnalysisStatus = ({
  health,
  analysisStatus
}: {
  health: HealthData | null | undefined;
  analysisStatus: AnalysisStatusData | null | undefined;
}) => {
  if (!health || !analysisStatus) {
    return <p className="text-muted-foreground">Carregando status...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="text-sm">Total Dashboards</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.dashboards_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-sm">Total Insights</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.total_insights}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-sm">Relevant Insights</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.relevant_insights}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="text-sm">Analyses Status</CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analysisStatus.view_analysis === 'completed' &&
                 analysisStatus.business_context === 'completed' &&
                 analysisStatus.insights_generation === 'completed'
                ? 'Completed'
                : 'In Progress'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Agent Status</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">View Analyzer</span>
            <Badge variant={analysisStatus.view_analysis === 'completed' ? 'default' : 'secondary'}>
              {analysisStatus.view_analysis}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Business Context</span>
            <Badge variant={analysisStatus.business_context === 'completed' ? 'default' : 'secondary'}>
              {analysisStatus.business_context}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Insight Generator</span>
            <Badge variant={analysisStatus.insights_generation === 'completed' ? 'default' : 'secondary'}>
              {analysisStatus.insights_generation}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

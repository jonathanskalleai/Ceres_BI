// DashboardSpecificView - Vista detalhada de um dashboard específico

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InsightCards,
  KPICards,
} from '@/components/dashboard/DashboardBI';
import type { DashboardDefinition, Insight } from '@/types/insights';

interface InsightsBySeverity {
  critical: Insight[];
  warning: Insight[];
  info: Insight[];
}

interface DashboardSpecificViewProps {
  dashboard: DashboardDefinition | null;
  insights: InsightsBySeverity;
  onNavigateToInsight: (insightId: string) => void;
  onNavigateBack: () => void;
}

export const DashboardSpecificView = ({
  dashboard,
  insights,
  onNavigateToInsight,
  onNavigateBack
}: DashboardSpecificViewProps) => {
  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">Dashboard não encontrado</p>
          <Button onClick={onNavigateBack}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onNavigateBack}>
          ← Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{dashboard.title}</h1>
          <p className="text-muted-foreground">{dashboard.description}</p>
        </div>
        <Badge variant="secondary">{dashboard.category}</Badge>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <InsightCards
            insights={[...insights.critical, ...insights.warning, ...insights.info]}
            onNavigateToInsight={onNavigateToInsight}
          />
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <KPICards kpis={dashboard.kpis} />
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dashboard.charts_schema.map((chart, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Gráfico {index + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Tipo: {chart.type}
                  </p>
                  <div className="mt-4 h-48 bg-muted rounded flex items-center justify-center">
                    <p className="text-muted-foreground">
                      Visualização do gráfico {chart.type}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// InsightSummaryCard - Card de resumo de insights por severidade

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Severity } from '@/types/insights';

interface InsightSummaryCardProps {
  severity: Severity;
  count: number;
  title: string;
  icon: LucideIcon;
}

const getSeverityColor = (severity: Severity): string => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200';
    case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const InsightSummaryCard = ({ severity, count, title, icon: Icon }: InsightSummaryCardProps) => {
  const colorClasses = getSeverityColor(severity);
  const borderColor = colorClasses.split(' ')[2];

  return (
    <Card className={`border-l-4 ${borderColor}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6" />
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-3xl font-bold mt-1">{count}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

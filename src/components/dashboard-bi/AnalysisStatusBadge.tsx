// AnalysisStatusBadge - Badge de status da análise por agentes

import { Badge } from '@/components/ui/badge';
import type { AgentAnalysisStatusData } from './types';

interface AnalysisStatusBadgeProps {
  analysisStatus: AgentAnalysisStatusData | undefined;
}

export const AnalysisStatusBadge = ({ analysisStatus }: AnalysisStatusBadgeProps) => {
  if (!analysisStatus) return null;

  const allCompleted =
    analysisStatus.view_analysis === 'completed' &&
    analysisStatus.business_context === 'completed' &&
    analysisStatus.insights_generation === 'completed';

  const anyInProgress =
    analysisStatus.view_analysis === 'in_progress' ||
    analysisStatus.business_context === 'in_progress' ||
    analysisStatus.insights_generation === 'in_progress';

  const getStatusColor = (): string => {
    if (allCompleted) return 'bg-green-100 text-green-800';
    if (anyInProgress) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusText = (): string => {
    if (allCompleted) return 'Analisado';
    if (anyInProgress) return 'Analisando...';
    return 'Necessário Análise';
  };

  return (
    <Badge className={getStatusColor()}>
      {getStatusText()}
    </Badge>
  );
};

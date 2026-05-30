// Mapear cores do CHART_COLORS do sistema atual
export const NIVO_COLORS = [
  '#eab308', // hsl(38, 92%, 50%) - amarelo
  '#3b82f6', // hsl(217, 91%, 60%) - azul
  '#16a34a', // hsl(152, 69%, 40%) - verde
  '#f97316', // hsl(25, 95%, 53%) - laranja
  '#9333ea', // hsl(280, 65%, 60%) - roxo
  '#ef4444', // hsl(0, 84%, 60%) - vermelho
]

export const POSITIVE_COLOR = '#16a34a' // verde
export const NEGATIVE_COLOR = '#ef4444' // vermelho

// Configuração de tema para o Nivo
export const nivoTheme = {
  background: 'transparent',
  textColor: '#64748b',
  axis: {
    domain: {
      line: {
        stroke: '#e2e8f0',
        strokeWidth: 1,
      },
    },
    legend: {
      text: {
        fill: '#64748b',
        fontSize: 12,
      },
    },
    ticks: {
      line: {
        stroke: '#e2e8f0',
        strokeWidth: 1,
      },
      text: {
        fill: '#64748b',
        fontSize: 11,
      },
    },
  },
  grid: {
    line: {
      stroke: '#e2e8f0',
      strokeWidth: 1,
      strokeDasharray: '3 3',
    },
  },
  tooltip: {
    container: {
      background: 'rgba(15, 23, 42, 0.95)',
      borderRadius: 8,
      padding: 12,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    basic: {
      color: '#f1f5f9',
      fontSize: 12,
    },
    table: {
      header: {
        color: '#f1f5f9',
        fontSize: 12,
        fontWeight: 'bold',
      },
      cell: {
        color: '#cbd5e1',
        fontSize: 12,
      },
    },
  },
}
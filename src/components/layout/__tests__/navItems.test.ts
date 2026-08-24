import { describe, expect, it } from 'vitest';
import { buildNavItems } from '../navItems';
import type { AppModule } from '@/types/auth';

const module = (id: string): AppModule => ({
  id,
  label: id,
  group_id: id.split('.')[0],
  group_label: 'TESTE',
  sort_order: 1,
  icon_name: 'BarChart3',
});

describe('buildNavItems', () => {
  it('nao inclui Desempenho de Vendas sem a permissao do modulo', () => {
    const items = buildNavItems([
      module('crm.consultores'),
      module('crm.registros'),
      module('bi.acoes'),
    ], false);

    expect(items.map((item) => item.id)).not.toContain('bi.desempenho');
  });

  it('inclui Desempenho de Vendas quando o modulo esta autorizado', () => {
    const items = buildNavItems([module('bi.desempenho')], false);

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'bi.desempenho',
        route: '/bi/desempenho',
      }),
    ]));
  });
});

import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';

/** Map route prefix to section label + title */
const ROUTE_META: Record<string, { section: string; title: string }> = {
  '/crm/overview': { section: 'COMERCIAL CRM', title: 'Visao Geral' },
  '/crm/consultores': { section: 'COMERCIAL CRM', title: 'Consultores' },
  '/crm/regioes': { section: 'COMERCIAL CRM', title: 'Regioes' },
  '/crm/registros': { section: 'COMERCIAL CRM', title: 'Registros' },
  '/crm/criticos': { section: 'COMERCIAL CRM', title: 'Clientes Criticos' },
  '/crm/mapa': { section: 'COMERCIAL CRM', title: 'Mapa de Acoes' },
  '/crm/insights': { section: 'COMERCIAL CRM', title: 'Observacoes' },
  '/crm/negocios': { section: 'COMERCIAL CRM', title: 'Negocios' },
  '/crm/administrativo': { section: 'COMERCIAL CRM', title: 'Administrativo' },
  '/bi/painel': { section: 'BI ANALYTICS', title: 'Visao Geral' },
  '/bi/comercial': { section: 'BI ANALYTICS', title: 'Negocios' },
  '/bi/pedidos': { section: 'BI ANALYTICS', title: 'Pedidos' },
  '/bi/produtos': { section: 'BI ANALYTICS', title: 'Base Instalada' },
  '/bi/servicos': { section: 'BI ANALYTICS', title: 'Servicos' },
  '/bi/operacional': { section: 'BI ANALYTICS', title: 'Produtividade Tecnica' },
  '/bi/admin': { section: 'BI ANALYTICS', title: 'Carteira de Clientes' },
  '/bi/acoes': { section: 'BI ANALYTICS', title: 'Acoes' },
  '/bi/inteligencia': { section: 'BI ANALYTICS', title: 'Inteligencia' },
  '/tools/explorer': { section: 'FERRAMENTAS', title: 'Explorador de Views' },
  '/tools/performance': { section: 'FERRAMENTAS', title: 'Performance 2026' },
  '/admin/users': { section: 'ADMINISTRACAO', title: 'Usuarios' },
  '/admin/profile': { section: 'ADMINISTRACAO', title: 'Meu Perfil' },
};

function resolveRouteMeta(pathname: string): { section: string; title: string } {
  // Exact match first
  if (ROUTE_META[pathname]) return ROUTE_META[pathname];

  // Check prefix (for nested routes like /crm/consultores/:vendedor)
  for (const [route, meta] of Object.entries(ROUTE_META)) {
    if (pathname.startsWith(route + '/')) return { ...meta, title: meta.title };
  }

  // Consultor detail special case
  if (pathname.startsWith('/crm/consultores/')) {
    return { section: 'COMERCIAL CRM', title: 'Detalhe Consultor' };
  }

  return { section: 'CERES BI', title: 'Dashboard' };
}

interface AppShellTopbarProps {
  section: string;
  title: string;
}

function AppShellTopbar({ section: _section, title }: AppShellTopbarProps) {
  return (
    <header
      className="flex items-center justify-between gap-3 md:gap-5 px-4 sm:px-6 lg:px-10 py-3 md:py-4 lg:py-5 shrink-0"
      style={{
        background: 'transparent',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <h1
          className="text-[20px] md:text-[26px] leading-tight tracking-[-0.012em]"
          style={{ fontFamily: 'var(--voux-font-display)', margin: 0, color: 'var(--voux-text-heading)' }}
        >
          {title}
        </h1>
      </div>
      <div id="topbar-actions" className="flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0" />
    </header>
  );
}



export function AppShell() {
  const location = useLocation();
  const meta = useMemo(() => resolveRouteMeta(location.pathname), [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto flex flex-col">
        <AppShellTopbar section={meta.section} title={meta.title} />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

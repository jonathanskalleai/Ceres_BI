-- Tabela de perfis (extende auth.users do Supabase)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'normal' CHECK (role IN ('admin', 'normal')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer user autenticado le seu proprio perfil
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins leem todos os perfis
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Users editam seu proprio perfil (exceto role)
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins editam qualquer perfil
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Trigger: criar profile automaticamente ao signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: updated_at automatico
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Modulos/secoes do sistema que podem ser atribuidas
CREATE TABLE public.app_modules (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  group_id TEXT NOT NULL,
  group_label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  icon_name TEXT NOT NULL DEFAULT 'LayoutDashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read modules"
  ON public.app_modules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins manage modules"
  ON public.app_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Permissoes por usuario
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES public.app_modules(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own permissions"
  ON public.user_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all permissions"
  ON public.user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Seed: modulos iniciais
INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name) VALUES
  ('crm.overview',       'Visao Geral',         'comercial',    'COMERCIAL CRM',  1,  'LayoutDashboard'),
  ('crm.consultores',    'Consultores',          'comercial',    'COMERCIAL CRM',  2,  'Users'),
  ('crm.regioes',        'Regioes',              'comercial',    'COMERCIAL CRM',  3,  'MapPin'),
  ('crm.registros',      'Registros',            'comercial',    'COMERCIAL CRM',  4,  'Table2'),
  ('crm.criticos',       'Clientes Criticos',    'comercial',    'COMERCIAL CRM',  5,  'AlertTriangle'),
  ('crm.mapa',           'Mapa de Acoes',        'comercial',    'COMERCIAL CRM',  6,  'Map'),
  ('crm.insights',       'Observacoes',          'comercial',    'COMERCIAL CRM',  7,  'MessageSquareText'),
  ('crm.negocios',       'Negocios',             'comercial',    'COMERCIAL CRM',  8,  'Handshake'),
  ('crm.administrativo', 'Administrativo',       'comercial',    'COMERCIAL CRM',  9,  'ClipboardList'),
  ('bi.comercial',       'Comercial',            'bi',           'BI ANALYTICS',   10, 'BarChart3'),
  ('bi.pedidos',         'Pedidos',              'bi',           'BI ANALYTICS',   11, 'Package'),
  ('bi.produtos',        'Produtos',             'bi',           'BI ANALYTICS',   12, 'Box'),
  ('bi.servicos',        'Servicos',             'bi',           'BI ANALYTICS',   13, 'Wrench'),
  ('bi.operacional',     'Operacional',          'bi',           'BI ANALYTICS',   14, 'Activity'),
  ('bi.admin',           'Admin',                'bi',           'BI ANALYTICS',   15, 'Settings'),
  ('bi.acoes',           'Acoes',                'bi',           'BI ANALYTICS',   16, 'Zap'),
  ('tools.explorer',     'Explorador de Views',  'ferramentas',  'FERRAMENTAS',    17, 'Database'),
  ('tools.performance',  'Performance 2026',     'ferramentas',  'FERRAMENTAS',    18, 'TrendingUp'),
  ('admin.users',        'Gerenciar Usuarios',   'admin',        'ADMINISTRACAO',  19, 'UserCog'),
  ('admin.profile',      'Meu Perfil',           'admin',        'ADMINISTRACAO',  20, 'User');

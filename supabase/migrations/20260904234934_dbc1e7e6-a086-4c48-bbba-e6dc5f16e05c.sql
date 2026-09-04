CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_own_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,''), '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN 'user'::public.app_role ELSE 'admin'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  telefone text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_admin" ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  url text,
  conteudo text NOT NULL DEFAULT '',
  suspenso_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sites_admin" ON public.sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES public.sites(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  periodo_dias integer NOT NULL DEFAULT 30,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  vencimento date NOT NULL DEFAULT (current_date + 30),
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assinaturas_admin" ON public.assinaturas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  pago_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'manual',
  referencia text,
  dias_adicionados integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagamentos_admin" ON public.pagamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.historico_validade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura_id uuid NOT NULL REFERENCES public.assinaturas(id) ON DELETE CASCADE,
  vencimento_anterior date,
  vencimento_novo date,
  status_anterior text,
  status_novo text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.historico_validade TO authenticated;
GRANT ALL ON public.historico_validade TO service_role;
ALTER TABLE public.historico_validade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historico_admin" ON public.historico_validade FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.calc_status(_status text, _suspenso boolean, _vencimento date)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _suspenso OR _status = 'suspenso' THEN 'SUSPENSO'
    WHEN _vencimento < current_date THEN 'EXPIRADO'
    WHEN _vencimento - current_date <= 5 THEN 'PROXIMO'
    ELSE 'ATIVO'
  END
$$;

CREATE OR REPLACE FUNCTION public.log_assinatura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.vencimento IS DISTINCT FROM OLD.vencimento OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.historico_validade (assinatura_id, vencimento_anterior, vencimento_novo, status_anterior, status_novo, motivo)
    VALUES (NEW.id, OLD.vencimento, NEW.vencimento, OLD.status, NEW.status, 'alteracao');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER assinaturas_log BEFORE UPDATE ON public.assinaturas
FOR EACH ROW EXECUTE FUNCTION public.log_assinatura();

CREATE OR REPLACE FUNCTION public.verificar_site(_slug text)
RETURNS TABLE (
  site_nome text,
  cliente_nome text,
  status text,
  vencimento date,
  dias_restantes integer,
  conteudo text,
  valor numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT si.nome,
         c.nome,
         public.calc_status(a.status, si.suspenso_manual, a.vencimento),
         a.vencimento,
         (a.vencimento - current_date)::int,
         CASE WHEN public.calc_status(a.status, si.suspenso_manual, a.vencimento) IN ('ATIVO','PROXIMO')
              THEN si.conteudo ELSE NULL END,
         a.valor
  FROM public.sites si
  JOIN public.clientes c ON c.id = si.cliente_id
  JOIN public.assinaturas a ON a.site_id = si.id
  WHERE si.slug = _slug
$$;

GRANT EXECUTE ON FUNCTION public.verificar_site(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expirar_assinaturas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.assinaturas SET status = 'expirado'
  WHERE vencimento < current_date AND status = 'ativo';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
GRANT EXECUTE ON FUNCTION public.expirar_assinaturas() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.renovar_assinatura(
  _assinatura_id uuid,
  _valor numeric DEFAULT NULL,
  _origem text DEFAULT 'manual',
  _referencia text DEFAULT NULL,
  _regra text DEFAULT 'validade'
) RETURNS TABLE (novo_vencimento date, novo_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.assinaturas;
  base date;
  novo date;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO a FROM public.assinaturas WHERE id = _assinatura_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Assinatura nao encontrada'; END IF;

  base := CASE WHEN _regra = 'pagamento' OR a.vencimento < current_date THEN current_date ELSE a.vencimento END;
  novo := base + a.periodo_dias;

  INSERT INTO public.pagamentos (assinatura_id, cliente_id, valor, origem, referencia, dias_adicionados)
  VALUES (a.id, a.cliente_id, COALESCE(_valor, a.valor), _origem, _referencia, a.periodo_dias);

  UPDATE public.assinaturas SET vencimento = novo, status = 'ativo' WHERE id = a.id;
  UPDATE public.sites SET suspenso_manual = false, updated_at = now() WHERE id = a.site_id;

  RETURN QUERY SELECT novo, 'ativo'::text;
END; $$;
GRANT EXECUTE ON FUNCTION public.renovar_assinatura(uuid, numeric, text, text, text) TO authenticated, service_role;

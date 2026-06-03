-- =====================================================================
-- PNPE GABON - BASE DE DONNÉES D'ARCHIVAGE NUMÉRIQUE
-- SQL de Migration - Version 2 (Rôles, Validation & Audit)
-- =====================================================================

-- 1. DIRECTIONS
CREATE TABLE IF NOT EXISTS public.directions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,        -- ex: 'DG', 'DII', 'DEJ', 'DDPAE'
  label TEXT NOT NULL,
  color TEXT NOT NULL,              -- couleur hex/tailwind pour les badges
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertion des directions administratives avec des UUIDs fixes
INSERT INTO public.directions (id, code, label, color) VALUES
  ('00000000-0000-0000-0000-000000000000', 'DG', 'Direction Générale', '#001939'),
  ('11111111-1111-1111-1111-111111111111', 'DII', 'Direction de l''Insertion et de l''Immigration', '#2563eb'),
  ('22222222-2222-2222-2222-222222222222', 'DEJ', 'Direction de l''Emploi des Jeunes', '#059669'),
  ('33333333-3333-3333-3333-333333333333', 'DDPAE', 'Direction du Développement Professionnel', '#7c3aed'),
  ('44444444-4444-4444-4444-444444444444', 'DAMG', 'Direction de l''Appui aux Métiers et à la Gestion', '#ea580c'),
  ('55555555-5555-5555-5555-555555555555', 'SRH', 'Service des Ressources Humaines', '#0d9488'),
  ('66666666-6666-6666-6666-666666666666', 'SCP', 'Service Communication et Partenariat', '#db2777'),
  ('77777777-7777-7777-7777-777777777777', 'SSA', 'Service Social et d''Accompagnement', '#d97706')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  label = EXCLUDED.label,
  color = EXCLUDED.color;

-- 2. ENUMS POUR LES RÔLES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM (
      'super_admin',
      'dg_superviseur',
      'chef_direction',
      'agent_archiviste',
      'lecteur',
      'auditeur'
    );
  END IF;
END
$$;

-- Mise à jour de la table profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'agent_archiviste',
  ADD COLUMN IF NOT EXISTS direction_id UUID REFERENCES public.directions(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS delegation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delegated_role public.user_role;

-- Assigner le rôle Super Admin au compte principal de test (DG)
UPDATE public.profiles
SET role = 'super_admin'::public.user_role,
    direction_id = '00000000-0000-0000-0000-000000000000'::UUID
WHERE service = 'DG';

-- 3. WORKFLOW ET DOCUMENTS
-- Drop de la colonne status pour changer de type d'enum de statut
ALTER TABLE public.documents DROP COLUMN IF EXISTS status;
DROP TYPE IF EXISTS public.document_status CASCADE;

CREATE TYPE public.document_status AS ENUM (
  'brouillon',
  'en_attente_chef',
  'en_attente_dg',
  'approuve',
  'rejete',
  'archive'
);

-- Modifier la table documents
ALTER TABLE public.documents
  ADD COLUMN status public.document_status NOT NULL DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS direction_id UUID REFERENCES public.directions(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by_chef UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS validated_by_chef_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by_dg UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS validated_by_dg_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS expires_at DATE;

-- 4. TABLE DES ÉVÉNEMENTS DU WORKFLOW (historique des validations)
CREATE TABLE IF NOT EXISTS public.workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL, -- 'submit', 'approve_chef', 'reject_chef', 'approve_dg', 'reject_dg'
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. JOURNAL D'AUDIT
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL, -- 'document.upload', 'document.download', 'document.delete', etc.
  resource_type TEXT,  -- 'document', 'user', 'direction'
  resource_id UUID,
  resource_label TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_direction_id ON public.documents(direction_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_document_id ON public.workflow_events(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 7. TRIGGER AUTOMATIQUE POUR LES INVENTAIRES ET PROFILS UTILISATEUR
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_direction_id UUID;
    v_service_code TEXT;
BEGIN
    v_service_code := COALESCE(new.raw_user_meta_data->>'service', 'DG');
    
    -- Résolution de la direction à partir du code de service
    SELECT id INTO v_direction_id FROM public.directions WHERE code = v_service_code;
    
    INSERT INTO public.profiles (id, full_name, role, direction_id)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Agent PNPE'),
        'agent_archiviste'::public.user_role,
        v_direction_id
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger est attaché correctement
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Fonctions d'aide à la sécurité
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_direction_id()
RETURNS UUID AS $$
  SELECT direction_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Politiques RLS : Profiles
DROP POLICY IF EXISTS "Les utilisateurs connectés peuvent voir tous les profils" ON public.profiles;
CREATE POLICY "Les utilisateurs connectés peuvent voir tous les profils" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles;
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Super admin can manage all profiles" ON public.profiles;
CREATE POLICY "Super admin can manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING (
    public.get_user_role() = 'super_admin'::public.user_role
  );

DROP POLICY IF EXISTS "Chefs de direction can update profiles in their direction" ON public.profiles;
CREATE POLICY "Chefs de direction can update profiles in their direction" ON public.profiles
  FOR UPDATE TO authenticated USING (
    public.get_user_role() = 'chef_direction'::public.user_role
    AND direction_id = public.get_user_direction_id()
    AND role NOT IN ('super_admin'::public.user_role, 'dg_superviseur'::public.user_role)
  );

-- Politiques RLS : Documents
DROP POLICY IF EXISTS "Lecture cloisonnée par service ou DG" ON public.documents;
DROP POLICY IF EXISTS "documents_select" ON public.documents;
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT TO authenticated USING (
    public.get_user_role() IN ('super_admin'::public.user_role, 'dg_superviseur'::public.user_role, 'auditeur'::public.user_role)
    OR direction_id = public.get_user_direction_id()
  );

DROP POLICY IF EXISTS "Insertion restreinte au service de l'utilisateur ou DG" ON public.documents;
DROP POLICY IF EXISTS "documents_insert" ON public.documents;
CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('super_admin'::public.user_role, 'chef_direction'::public.user_role, 'agent_archiviste'::public.user_role)
    AND direction_id = public.get_user_direction_id()
  );

DROP POLICY IF EXISTS "Modification par le propriétaire ou la DG" ON public.documents;
DROP POLICY IF EXISTS "documents_update" ON public.documents;
CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE TO authenticated USING (
    public.get_user_role() = 'super_admin'::public.user_role
    OR (
      public.get_user_role() IN ('chef_direction'::public.user_role, 'agent_archiviste'::public.user_role)
      AND uploaded_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Suppression réservée à la DG" ON public.documents;
DROP POLICY IF EXISTS "documents_delete" ON public.documents;
CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE TO authenticated USING (
    public.get_user_role() = 'super_admin'::public.user_role
    OR (
      public.get_user_role() IN ('chef_direction'::public.user_role, 'agent_archiviste'::public.user_role)
      AND uploaded_by = auth.uid()
    )
  );

-- Politiques RLS : Journal d'Audit
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (
    public.get_user_role() IN ('super_admin'::public.user_role, 'dg_superviseur'::public.user_role, 'auditeur'::public.user_role)
  );

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Politiques RLS : Workflow Events
DROP POLICY IF EXISTS "workflow_events_select" ON public.workflow_events;
CREATE POLICY "workflow_events_select" ON public.workflow_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "workflow_events_insert" ON public.workflow_events;
CREATE POLICY "workflow_events_insert" ON public.workflow_events
  FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() IN ('super_admin'::public.user_role, 'dg_superviseur'::public.user_role, 'chef_direction'::public.user_role, 'agent_archiviste'::public.user_role)
  );

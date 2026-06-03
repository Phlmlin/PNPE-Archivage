-- =====================================================================
-- PNPE GABON - BASE DE DONNÉES D'ARCHIVAGE NUMÉRIQUE
-- SQL d'initialisation pour Supabase
-- =====================================================================

-- 1. ENUMS (Types Énumérés)
CREATE TYPE service_type AS ENUM ('DII', 'DEJ', 'DDPAE', 'DAMG', 'SRH', 'SCP', 'SSA', 'DG');
CREATE TYPE document_status AS ENUM ('actif', 'archivé');

-- 2. TABLE PROFILES (Profils utilisateurs liés aux comptes d'authentification)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    service service_type NOT NULL DEFAULT 'DG',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Activation de la RLS sur profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour PROFILES
-- Lecture : Tous les utilisateurs authentifiés peuvent lire les profils (pour afficher le nom de l'uploader)
CREATE POLICY "Les utilisateurs connectés peuvent voir tous les profils"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Modification : Un utilisateur ne peut modifier que son propre profil
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. TRIGGER AUTOMATIQUE POUR NOUVEAU USER
-- Fonction pour insérer automatiquement le profil lors de la création d'un utilisateur dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, service)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Agent PNPE'),
        COALESCE((new.raw_user_meta_data->>'service')::public.service_type, 'DG'::public.service_type)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;


-- Trigger attaché à auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 4. TABLE DOCUMENTS (Métadonnées des archives)
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL, -- Format : 'service-code/filename-uuid.ext'
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    service service_type NOT NULL DEFAULT 'DG',
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status document_status NOT NULL DEFAULT 'actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Activation de la RLS sur documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour DOCUMENTS

-- Lecture (SELECT) : 
-- - La Direction Générale (DG) peut tout lire.
-- - Les autres agents ne peuvent lire que les documents de leur service respectif.
CREATE POLICY "Lecture cloisonnée par service ou DG"
ON public.documents
FOR SELECT
TO authenticated
USING (
    (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
    OR service = (SELECT service FROM public.profiles WHERE id = auth.uid())
);

-- Insertion (INSERT) :
-- - La Direction Générale (DG) peut insérer des documents pour n'importe quel service.
-- - Les autres agents ne peuvent insérer que si le document appartient à leur propre service.
CREATE POLICY "Insertion restreinte au service de l'utilisateur ou DG"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
    OR service = (SELECT service FROM public.profiles WHERE id = auth.uid())
);

-- Mise à jour (UPDATE) :
-- - La DG peut tout modifier.
-- - Les utilisateurs peuvent modifier leurs propres documents s'ils appartiennent toujours au même service.
CREATE POLICY "Modification par le propriétaire ou la DG"
ON public.documents
FOR UPDATE
TO authenticated
USING (
    (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
    OR (
        service = (SELECT service FROM public.profiles WHERE id = auth.uid())
        AND uploaded_by = auth.uid()
    )
)
WITH CHECK (
    (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
    OR (
        service = (SELECT service FROM public.profiles WHERE id = auth.uid())
        AND uploaded_by = auth.uid()
    )
);

-- Suppression (DELETE) :
-- - Strictement réservée à la Direction Générale (DG)
CREATE POLICY "Suppression réservée à la DG"
ON public.documents
FOR DELETE
TO authenticated
USING (
    (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
);


-- =====================================================================
-- 5. RÈGLES DE SÉCURITÉ POUR SUPABASE STORAGE (BUCKET 'archives-pnpe')
-- À exécuter/configurer dans les politiques de stockage
-- =====================================================================

-- Note : Les règles de stockage suivantes doivent s'appliquer sur la table `storage.objects`

-- SELECT : Lire les fichiers stockés
-- Autorisé si l'utilisateur est de la DG OU si le dossier parent (première partie du path) correspond à son service.
-- Le file_path est stocké sous la forme: 'service-code/fichier.ext'
-- Exemple : 'dii/rapport.pdf' -> split_part(name, '/', 1) = 'dii'
/*
CREATE POLICY "Accès lecture fichiers par dossier de service ou DG"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'archives-pnpe'
    AND (
        (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
        OR LOWER(split_part(name, '/', 1)) = LOWER((SELECT service::text FROM public.profiles WHERE id = auth.uid()))
    )
);

-- INSERT : Téléverser des fichiers
CREATE POLICY "Accès upload fichiers par dossier de service ou DG"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'archives-pnpe'
    AND (
        (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
        OR LOWER(split_part(name, '/', 1)) = LOWER((SELECT service::text FROM public.profiles WHERE id = auth.uid()))
    )
);

-- DELETE : Supprimer des fichiers
CREATE POLICY "Suppression fichiers réservée à la DG"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'archives-pnpe'
    AND (SELECT service FROM public.profiles WHERE id = auth.uid()) = 'DG'::service_type
);
*/

-- Add Shopify product variants and variant-level COGS

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_variant_id TEXT,
  title TEXT NOT NULL,
  sku TEXT,
  price DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, shopify_variant_id)
);

CREATE TABLE IF NOT EXISTS public.product_variant_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_variant_id, component_id)
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_variants_select_team" ON public.product_variants;
CREATE POLICY "product_variants_select_team" ON public.product_variants FOR SELECT
USING (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "product_variants_insert_team" ON public.product_variants;
CREATE POLICY "product_variants_insert_team" ON public.product_variants FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "product_variants_update_team" ON public.product_variants;
CREATE POLICY "product_variants_update_team" ON public.product_variants FOR UPDATE
USING (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "product_variants_delete_team" ON public.product_variants;
CREATE POLICY "product_variants_delete_team" ON public.product_variants FOR DELETE
USING (
  auth.uid() = user_id
  OR user_id = public.get_user_owner_id(auth.uid())
);

DROP POLICY IF EXISTS "product_variant_components_select_team" ON public.product_variant_components;
CREATE POLICY "product_variant_components_select_team" ON public.product_variant_components FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = product_variant_components.product_variant_id
      AND (
        auth.uid() = pv.user_id
        OR pv.user_id = public.get_user_owner_id(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "product_variant_components_insert_team" ON public.product_variant_components;
CREATE POLICY "product_variant_components_insert_team" ON public.product_variant_components FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = product_variant_components.product_variant_id
      AND (
        auth.uid() = pv.user_id
        OR pv.user_id = public.get_user_owner_id(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "product_variant_components_update_team" ON public.product_variant_components;
CREATE POLICY "product_variant_components_update_team" ON public.product_variant_components FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = product_variant_components.product_variant_id
      AND (
        auth.uid() = pv.user_id
        OR pv.user_id = public.get_user_owner_id(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "product_variant_components_delete_team" ON public.product_variant_components;
CREATE POLICY "product_variant_components_delete_team" ON public.product_variant_components FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.product_variants pv
    WHERE pv.id = product_variant_components.product_variant_id
      AND (
        auth.uid() = pv.user_id
        OR pv.user_id = public.get_user_owner_id(auth.uid())
      )
  )
);

DROP TRIGGER IF EXISTS product_variants_updated_at ON public.product_variants;
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS product_variant_components_updated_at ON public.product_variant_components;
CREATE TRIGGER product_variant_components_updated_at BEFORE UPDATE ON public.product_variant_components
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_user_id ON public.product_variants(user_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_shopify_variant_id ON public.product_variants(shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_components_variant_id ON public.product_variant_components(product_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_components_component_id ON public.product_variant_components(component_id);

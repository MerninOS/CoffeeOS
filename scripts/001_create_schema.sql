-- Coffee COGS Application Database Schema

-- Users/Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shopify Settings table (stores Shopify connection info)
CREATE TABLE IF NOT EXISTS public.shopify_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_domain TEXT NOT NULL,
  access_token TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Components table (ingredients/labor/packaging for COGS)
CREATE TABLE IF NOT EXISTS public.components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ingredient', 'labor', 'packaging', 'other')),
  unit TEXT NOT NULL,
  cost_per_unit DECIMAL(18, 8) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table (synced from Shopify)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_id TEXT,
  shopify_handle TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price DECIMAL(10, 2),
  variant_id TEXT,
  variant_title TEXT,
  sku TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shopify_id, user_id)
);

-- Product Components junction table (links products to their COGS components)
CREATE TABLE IF NOT EXISTS public.product_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, component_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for shopify_settings (only owner can manage)
CREATE POLICY "shopify_settings_select_own" ON public.shopify_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "shopify_settings_insert_own" ON public.shopify_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopify_settings_update_own" ON public.shopify_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "shopify_settings_delete_own" ON public.shopify_settings FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for components
CREATE POLICY "components_select_own" ON public.components FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "components_insert_own" ON public.components FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "components_update_own" ON public.components FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "components_delete_own" ON public.components FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for products
CREATE POLICY "products_select_own" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "products_insert_own" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update_own" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "products_delete_own" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for product_components (based on product ownership)
CREATE POLICY "product_components_select" ON public.product_components FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_components.product_id AND products.user_id = auth.uid()));
CREATE POLICY "product_components_insert" ON public.product_components FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_components.product_id AND products.user_id = auth.uid()));
CREATE POLICY "product_components_update" ON public.product_components FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_components.product_id AND products.user_id = auth.uid()));
CREATE POLICY "product_components_delete" ON public.product_components FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.products WHERE products.id = product_components.product_id AND products.user_id = auth.uid()));

-- Trigger function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add update triggers to all tables
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER shopify_settings_updated_at BEFORE UPDATE ON public.shopify_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER components_updated_at BEFORE UPDATE ON public.components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER product_components_updated_at BEFORE UPDATE ON public.product_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON public.products(shopify_id);
CREATE INDEX IF NOT EXISTS idx_components_user_id ON public.components(user_id);
CREATE INDEX IF NOT EXISTS idx_components_type ON public.components(type);
CREATE INDEX IF NOT EXISTS idx_product_components_product_id ON public.product_components(product_id);
CREATE INDEX IF NOT EXISTS idx_product_components_component_id ON public.product_components(component_id);

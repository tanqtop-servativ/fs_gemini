
-- Job Template Checklist Items
CREATE TABLE IF NOT EXISTS public.job_template_checklist_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_template_task_id uuid REFERENCES public.job_template_tasks(id) ON DELETE CASCADE,
    description text NOT NULL,
    description_es text,
    item_type text CHECK (item_type IN ('simple', 'input')) DEFAULT 'simple',
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Job Checklist Items (Runtime instances)
CREATE TABLE IF NOT EXISTS public.job_checklist_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_task_id uuid REFERENCES public.job_tasks(id) ON DELETE CASCADE,
    description text NOT NULL,
    item_type text CHECK (item_type IN ('simple', 'input')) DEFAULT 'simple',
    sort_order integer DEFAULT 0,
    is_checked boolean DEFAULT false,
    input_value text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS Policies (assume similar to tasks)
ALTER TABLE public.job_template_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist_items ENABLE ROW LEVEL SECURITY;

-- For now, simple policies using app_users or profiles lookup if needed, 
-- BUT these are child tables. We can usually rely on the parent join access in views, 
-- but for direct access we need policies.

-- Since these tables don't have tenant_id directly, RLS is trickier.
-- We can add tenant_id to them for easier RLS, or do a join (expensive).
-- Given the pattern of the app, let's add tenant_id to make RLS fast and consistent.

ALTER TABLE public.job_template_checklist_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.job_checklist_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

CREATE POLICY "Enable all access for tenant members" ON public.job_template_checklist_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Enable all access for tenant members" ON public.job_checklist_items
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_checklist_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_job_checklist_modtime
    BEFORE UPDATE ON public.job_checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_checklist_modified_column();

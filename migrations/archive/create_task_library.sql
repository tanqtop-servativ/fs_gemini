-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create task_library table
CREATE TABLE IF NOT EXISTS public.task_library (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
    title text NOT NULL,
    description text,
    title_es text,
    description_es text,
    is_required boolean DEFAULT false,
    require_photo boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_library ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view library tasks for their tenant" ON public.task_library
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

CREATE POLICY "Users can insert library tasks for their tenant" ON public.task_library
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

CREATE POLICY "Users can update library tasks for their tenant" ON public.task_library
    FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

CREATE POLICY "Users can delete library tasks for their tenant" ON public.task_library
    FOR DELETE USING (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_task_library_modtime
    BEFORE UPDATE ON public.task_library
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

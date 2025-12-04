import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# SQL to replace CREATE function
create_sql = """
CREATE OR REPLACE FUNCTION public.create_job_template(
    p_name text, 
    p_description text, 
    p_name_es text, 
    p_description_es text, 
    p_tenant_id integer, 
    p_tasks jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tmpl_id INT;
  task JSONB;
  idx INT := 0;
BEGIN
  INSERT INTO job_templates (name, description, name_es, description_es, tenant_id)
  VALUES (p_name, p_description, p_name_es, p_description_es, p_tenant_id)
  RETURNING id INTO v_tmpl_id;

  IF p_tasks IS NOT NULL THEN
    FOR task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      INSERT INTO job_template_tasks (template_id, title, description, title_es, description_es, is_required, require_photo, sort_order)
      VALUES (
        v_tmpl_id, 
        task->>'title', 
        task->>'description', 
        task->>'title_es', 
        task->>'description_es', 
        (task->>'is_required')::boolean, 
        (task->>'require_photo')::boolean, 
        idx
      );
      idx := idx + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_tmpl_id);
END;
$function$;
"""

# SQL to replace UPDATE function
update_sql = """
CREATE OR REPLACE FUNCTION public.update_job_template(
    p_id integer, 
    p_name text, 
    p_description text, 
    p_name_es text, 
    p_description_es text, 
    p_tasks jsonb
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  task JSONB;
  idx INT := 0;
BEGIN
  UPDATE job_templates 
  SET name = p_name, description = p_description, name_es = p_name_es, description_es = p_description_es 
  WHERE id = p_id;
  
  DELETE FROM job_template_tasks WHERE template_id = p_id;

  IF p_tasks IS NOT NULL THEN
    FOR task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
      INSERT INTO job_template_tasks (template_id, title, description, title_es, description_es, is_required, require_photo, sort_order)
      VALUES (
        p_id, 
        task->>'title', 
        task->>'description', 
        task->>'title_es', 
        task->>'description_es', 
        (task->>'is_required')::boolean, 
        (task->>'require_photo')::boolean, 
        idx
      );
      idx := idx + 1;
    END LOOP;
  END IF;
END;
$function$;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Updating create_job_template...")
    cur.execute(create_sql)
    
    print("Updating update_job_template...")
    cur.execute(update_sql)
    
    conn.commit()
    print("✅ RPC functions updated successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()

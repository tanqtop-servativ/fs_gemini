import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

create_sql = """
CREATE OR REPLACE FUNCTION public.create_bom_template(p_name text, p_description text, p_items jsonb, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tmpl_id UUID;
  item JSONB;
  idx INT := 0;
BEGIN
  INSERT INTO bom_templates (name, description, tenant_id)
  VALUES (p_name, p_description, p_tenant_id)
  RETURNING id INTO v_tmpl_id;

  IF p_items IS NOT NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      INSERT INTO bom_template_items (bom_template_id, item_name, quantity, category, notes, sort_order, price)
      VALUES (
        v_tmpl_id, 
        item->>'name', 
        (item->>'qty')::INT, 
        item->>'category', 
        COALESCE(item->>'notes', ''), 
        idx,
        COALESCE((item->>'price')::NUMERIC, 0.0)
      );
      idx := idx + 1; -- Increment Order
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_tmpl_id);
END;
$function$;
"""

update_sql = """
CREATE OR REPLACE FUNCTION public.update_bom_template(p_id uuid, p_name text, p_description text, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    item JSONB;
    idx INT := 0;
BEGIN
    UPDATE bom_templates SET name = p_name, description = p_description WHERE id = p_id;
    
    DELETE FROM bom_template_items WHERE bom_template_id = p_id;

    IF p_items IS NOT NULL THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO bom_template_items (bom_template_id, item_name, quantity, category, notes, sort_order, price)
            VALUES (
                p_id, 
                item->>'name', 
                (item->>'qty')::INT, 
                item->>'category', 
                COALESCE(item->>'notes', ''), 
                idx,
                COALESCE((item->>'price')::NUMERIC, 0.0)
            );
            idx := idx + 1;
        END LOOP;
    END IF;
END;
$function$;
"""

def fix_rpcs():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Updating create_bom_template...")
        cur.execute(create_sql)
        
        print("Updating update_bom_template...")
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

if __name__ == "__main__":
    fix_rpcs()

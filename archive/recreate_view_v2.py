import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql_drop = "DROP VIEW IF EXISTS properties_enriched;"

sql_create = """
CREATE VIEW properties_enriched AS
 SELECT p.id,
    p.tenant_id,
    p.name,
    p.hcp_customer_id,
    p.hcp_address_id,
    p.display_address,
    p.check_in_time,
    p.check_out_time,
    p.time_zone,
    p.bedrooms,
    p.bathrooms,
    p.max_guests,
    p.has_pool,
    p.has_bbq,
    p.allows_pets,
    p.parking_instructions,
    p.status,
    p.front_photo_url,
    p.wifi_network,
    p.wifi_password,
    p.has_casita,      -- NEW
    p.square_footage,  -- NEW
    ( SELECT string_agg((pe.first_name || ' '::text) || COALESCE(pe.last_name, ''::text), ', '::text) AS string_agg
           FROM property_assignments pa
             JOIN people pe ON pe.id = pa.person_id
             JOIN person_roles pr ON pr.person_id = pe.id
             JOIN roles r ON r.id = pr.role_id
          WHERE pa.property_id = p.id AND r.name = 'Owner'::text) AS owner_names,
    ( SELECT array_agg(pe.id) AS array_agg
           FROM property_assignments pa
             JOIN people pe ON pe.id = pa.person_id
             JOIN person_roles pr ON pr.person_id = pe.id
             JOIN roles r ON r.id = pr.role_id
          WHERE pa.property_id = p.id AND r.name = 'Owner'::text) AS owner_ids,
    ( SELECT string_agg((pe.first_name || ' '::text) || COALESCE(pe.last_name, ''::text), ', '::text) AS string_agg
           FROM property_assignments pa
             JOIN people pe ON pe.id = pa.person_id
             JOIN person_roles pr ON pr.person_id = pe.id
             JOIN roles r ON r.id = pr.role_id
          WHERE pa.property_id = p.id AND r.name = 'Property Manager'::text) AS manager_names,
    ( SELECT array_agg(pe.id) AS array_agg
           FROM property_assignments pa
             JOIN people pe ON pe.id = pa.person_id
             JOIN person_roles pr ON pr.person_id = pe.id
             JOIN roles r ON r.id = pr.role_id
          WHERE pa.property_id = p.id AND r.name = 'Property Manager'::text) AS manager_ids
   FROM properties p;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Dropping properties_enriched view...")
    cur.execute(sql_drop)
    
    print("Recreating properties_enriched view...")
    cur.execute(sql_create)
    
    conn.commit()
    print("✅ View recreated successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()

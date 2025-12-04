import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_view():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Creating 'properties_enriched' view...")
        
        cur.execute("DROP VIEW IF EXISTS properties_enriched;")
        
        # Note: property_assignments seems to have 'role' (text) instead of 'role_id'.
        # So we join roles on name.
        # Also, properties table is missing many columns, so we select NULLs for them to match the expected view schema.
        
        cur.execute("""
            CREATE VIEW properties_enriched AS
             SELECT p.id,
                p.tenant_id,
                p.name,
                NULL::text as hcp_customer_id,
                NULL::text as hcp_address_id,
                COALESCE(p.address, '') || ', ' || COALESCE(p.city, '') || ' ' || COALESCE(p.zip, '') as display_address,
                NULL::time as check_in_time,
                NULL::time as check_out_time,
                NULL::text as time_zone,
                NULL::boolean as is_dst,
                NULL::int as bedrooms,
                NULL::numeric as bathrooms,
                NULL::int as max_guests,
                NULL::boolean as has_pool,
                NULL::boolean as has_bbq,
                NULL::boolean as allows_pets,
                NULL::text as parking_instructions,
                CASE WHEN p.deleted_at IS NOT NULL THEN 'archived' ELSE 'active' END as status,
                NULL::text as front_photo_url,
                NULL::text as wifi_network,
                NULL::text as wifi_password,
                NULL::boolean as has_casita,
                NULL::int as square_footage,
                NULL::int as bathroom_sinks,
                NULL::int as bath_mats,
                ( SELECT string_agg((pe.first_name || ' '::text) || COALESCE(pe.last_name, ''::text), ', '::text) AS string_agg
                       FROM property_assignments pa
                         JOIN people pe ON pe.id = pa.person_id
                         JOIN roles r ON r.name = pa.role
                      WHERE pa.property_id = p.id AND r.name = 'Owner'::text) AS owner_names,
                ( SELECT array_agg(pe.id) AS array_agg
                       FROM property_assignments pa
                         JOIN people pe ON pe.id = pa.person_id
                         JOIN roles r ON r.name = pa.role
                      WHERE pa.property_id = p.id AND r.name = 'Owner'::text) AS owner_ids,
                ( SELECT string_agg((pe.first_name || ' '::text) || COALESCE(pe.last_name, ''::text), ', '::text) AS string_agg
                       FROM property_assignments pa
                         JOIN people pe ON pe.id = pa.person_id
                         JOIN roles r ON r.name = pa.role
                      WHERE pa.property_id = p.id AND r.name = 'Property Manager'::text) AS manager_names,
                ( SELECT array_agg(pe.id) AS array_agg
                       FROM property_assignments pa
                         JOIN people pe ON pe.id = pa.person_id
                         JOIN roles r ON r.name = pa.role
                      WHERE pa.property_id = p.id AND r.name = 'Property Manager'::text) AS manager_ids
               FROM properties p;
        """)
        
        conn.commit()
        print("✅ View created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_view()

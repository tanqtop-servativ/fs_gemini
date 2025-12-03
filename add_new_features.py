import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding has_casita column...")
    cur.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS has_casita boolean DEFAULT false;")
    
    print("Adding square_footage column...")
    cur.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS square_footage integer;")
    
    print("Creating property_attachments table...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS property_attachments (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            file_name TEXT NOT NULL,
            storage_path TEXT NOT NULL,
            public_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    
    # Enable RLS on the new table (good practice, though we might not set policies here)
    cur.execute("ALTER TABLE property_attachments ENABLE ROW LEVEL SECURITY;")
    
    # Create a policy for public read/write for now (since we are using anon key and custom auth is weak)
    # OR just rely on the fact that we are using the postgres user in these scripts.
    # For the frontend to work, we need policies if RLS is on.
    # Let's check if other tables have policies. 
    # Actually, for simplicity in this session, I'll create a permissive policy if it doesn't exist.
    
    cur.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'property_attachments' AND policyname = 'Enable all access for anon') THEN
                CREATE POLICY "Enable all access for anon" ON property_attachments FOR ALL USING (true) WITH CHECK (true);
            END IF;
        END $$;
    """)

    conn.commit()
    print("✅ DB Schema updated successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()

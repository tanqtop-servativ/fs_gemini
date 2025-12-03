import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def migrate_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("1. Creating public.profiles table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.profiles (
                id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                tenant_id INT REFERENCES tenants(id),
                is_superuser BOOLEAN DEFAULT FALSE,
                first_name TEXT,
                last_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Enable RLS
            ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
            
            -- Policy: Users can see their own profile
            DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
            CREATE POLICY "Users can view own profile" ON public.profiles
                FOR SELECT USING (auth.uid() = id);
                
            -- Policy: Superusers can view all profiles (we'll implement this logic later with a secure function, 
            -- for now let's keep it simple or rely on service role for admin tasks)
        """)

        print("2. Adding user_id to people table...")
        cur.execute("""
            ALTER TABLE people 
            ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        """)

        # We don't drop app_users yet, to keep a backup until we are fully switched.
        
        conn.commit()
        print("✅ Schema migration successful.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    migrate_schema()

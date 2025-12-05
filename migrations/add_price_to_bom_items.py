import os
import sys
import json
from pathlib import Path

# This script adds a `price` column to the `bom_template_items` table.
# It is intended to be run with the same environment that the app uses
# (i.e. the virtualenv with `psycopg2` installed and DB_CONNECTION_STRING set).

def main():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass

    conn_str = os.getenv('DB_CONNECTION_STRING')
    if not conn_str:
        print('DB_CONNECTION_STRING not set')
        sys.exit(1)

    import psycopg2
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        # Add column with default 0.00 if it does not exist
        cur.execute("""
            ALTER TABLE bom_template_items
            ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0.00;
        """)
        print('Added price column (or it already existed).')
    except Exception as e:
        print('Error altering table:', e)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()

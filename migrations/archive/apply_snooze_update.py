import os
import psycopg2

# Database connection parameters
DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')

if not DB_CONNECTION_STRING:
    print("Error: DB_CONNECTION_STRING environment variable not set.")
    exit(1)

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cursor = conn.cursor()

    # Read the SQL file
    with open('migrations/add_update_expired_snoozes_rpc.sql', 'r') as f:
        sql = f.read()

    # Execute the SQL
    print("Applying migration: add_update_expired_snoozes_rpc.sql")
    cursor.execute(sql)
    conn.commit()
    print("Migration applied successfully!")

except psycopg2.Error as e:
    print(f"Database error: {e}")
    exit(1)
except Exception as e:
    print(f"Error: {e}")
    exit(1)
finally:
    if conn:
        cursor.close()
        conn.close()

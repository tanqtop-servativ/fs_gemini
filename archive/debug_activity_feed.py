import os, psycopg2
from dotenv import load_dotenv

# Load .env from current directory explicitly
load_dotenv(os.path.join(os.getcwd(), '.env'))

def run_debug():
    db_url = os.getenv('DB_CONNECTION_STRING')
    if not db_url:
        print("❌ Error: DB_CONNECTION_STRING not found in environment.")
        return

    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return

    cur = conn.cursor()
    # Get tenant id
    cur.execute("SELECT id, name FROM tenants WHERE name = %s", ('KWX Palm Springs',))
    tenant = cur.fetchone()
    print('Tenant:', tenant)
    if not tenant:
        print('Tenant not found')
        return
    tenant_id = tenant[0]
    # Check communications rows for this tenant
    cur.execute("SELECT id, tenant_id, type, status FROM communications WHERE tenant_id = %s LIMIT 5", (tenant_id,))
    comms = cur.fetchall()
    print('Communications rows (first 5):', comms)
    # Check audit_logs rows for this tenant
    cur.execute("SELECT id, tenant_id, operation, table_name FROM audit_logs WHERE tenant_id = %s LIMIT 5", (tenant_id,))
    audits = cur.fetchall()
    print('Audit logs rows (first 5):', audits)
    # Query the view directly
    cur.execute("SELECT event_id, tenant_id, category, severity, summary FROM tenant_activity_feed WHERE tenant_id = %s LIMIT 5", (tenant_id,))
    view_rows = cur.fetchall()
    print('View rows (first 5):', view_rows)
    cur.close()
    conn.close()

if __name__ == '__main__':
    run_debug()

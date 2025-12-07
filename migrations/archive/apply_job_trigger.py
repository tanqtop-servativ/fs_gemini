import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, 'add_job_tasks_trigger.sql')
    with open(file_path, 'r') as f:
        sql = f.read()
        
    cur.execute(sql)
    conn.commit()
    print("Successfully added audit trigger to job_template_tasks")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    exit(1)

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Get the connection string from the environment variable
db_connection_string = os.environ.get('DB_CONNECTION_STRING')

if not db_connection_string:
    print("Error: DB_CONNECTION_STRING environment variable not set.")
    exit(1)

try:
    # Connect to the database
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    # Query to get the function definition
    query = """
    SELECT
        p.proname AS function_name,
        pg_get_function_arguments(p.oid) AS arguments
    FROM
        pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE
        n.nspname = 'public'
        AND p.proname = 'update_job_template';
    """

    cur.execute(query)
    results = cur.fetchall()

    if not results:
        print("Function 'update_job_template' not found.")
    else:
        for row in results:
            print(f"Function: {row[0]}")
            print(f"Arguments: {row[1]}")
            print("-" * 20)

    cur.close()
    conn.close()

except Exception as e:
    print(f"An error occurred: {e}")

import os
import psycopg2
from urllib.parse import urlparse

# Get the connection string from the environment variable
db_connection_string = os.environ.get("DB_CONNECTION_STRING")

if not db_connection_string:
    print("Error: DB_CONNECTION_STRING environment variable is not set.")
    exit(1)

# Parse the connection string
result = urlparse(db_connection_string)
username = result.username
password = result.password
database = result.path[1:]
hostname = result.hostname
port = result.port

# Connect to the PostgreSQL database
try:
    connection = psycopg2.connect(
        database=database,
        user=username,
        password=password,
        host=hostname,
        port=port
    )
    cursor = connection.cursor()
    print("Successfully connected to the database.")

    # Read the SQL file
    try:
        with open('migrations/fix_property_comprehensive.sql', 'r') as f:
            sql_queries = f.read()
        
        # Execute the SQL queries
        print("Applying migration...")
        cursor.execute(sql_queries)
        connection.commit()
        print("Migration applied successfully!")
        
    except FileNotFoundError:
        print("Error: Migration file not found.")
    except Exception as e:
        print(f"Error executing SQL: {e}")
        connection.rollback()

except Exception as e:
    print(f"Error connecting to database: {e}")
finally:
    if connection:
        cursor.close()
        connection.close()
        print("Database connection closed.")

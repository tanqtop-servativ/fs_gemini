import os
import psycopg2
from urllib.parse import urlparse

# Get connection string from environment
DATABASE_URL = os.getenv("DB_CONNECTION_STRING")

if not DATABASE_URL:
    print("Error: DB_CONNECTION_STRING environment variable not set.")
    exit(1)

# Connect to the database
try:
    connection = psycopg2.connect(DATABASE_URL)
    cursor = connection.cursor()

    # Read the SQL file
    with open("migrations/add_dismissal_reason.sql", "r") as file:
        sql_commands = file.read()

    # Execute the SQL commands
    cursor.execute(sql_commands)
    connection.commit()

    print("Migration 'add_dismissal_reason.sql' applied successfully.")

except Exception as e:
    print(f"Error applying migration: {e}")
finally:
    if connection:
        cursor.close()
        connection.close()

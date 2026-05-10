import psycopg2
import sys

conn_str = "postgresql://neondb_owner:npg_VMY08IUQxhwd@ep-sweet-hall-apt76von.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"

try:
    print("Connecting...")
    conn = psycopg2.connect(conn_str, connect_timeout=10)
    print("Connected!")
    cur = conn.cursor()
    cur.execute("SELECT 1")
    print("Execute result:", cur.fetchone())
    cur.close()
    conn.close()
    print("Closed.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

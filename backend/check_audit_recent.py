import os
from sqlalchemy import create_engine, text

db_url = 'postgresql://neondb_owner:npg_VMY08IUQxhwd@ep-sweet-hall-apt76von.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
engine = create_engine(db_url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT action, status, error_message, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 5"))
    for row in result:
        print(row)

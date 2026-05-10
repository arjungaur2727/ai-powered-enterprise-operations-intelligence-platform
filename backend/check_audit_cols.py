import os
from sqlalchemy import create_engine, inspect

db_url = 'postgresql://neondb_owner:npg_VMY08IUQxhwd@ep-sweet-hall-apt76von.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
engine = create_engine(db_url)
inspector = inspect(engine)

print("Columns in audit_logs:")
for column in inspector.get_columns('audit_logs'):
    print(f"- {column['name']}: {column['type']}")

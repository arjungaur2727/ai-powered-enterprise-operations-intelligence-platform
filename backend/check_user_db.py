import os
from sqlalchemy import create_engine, text

db_url = 'postgresql://neondb_owner:npg_VMY08IUQxhwd@ep-sweet-hall-apt76von.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
engine = create_engine(db_url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT email, hashed_password FROM users WHERE email = 'arjungaur2727@gmail.com'"))
    user = result.fetchone()
    if user:
        print(f"Email: {user[0]}")
        print(f"Hashed Password: {user[1]}")
    else:
        print("User not found in DB")

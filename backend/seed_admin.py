import os
os.environ['DATABASE_URL'] = 'postgresql://neondb_owner:npg_VMY08IUQxhwd@ep-sweet-hall-apt76von.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require'
from app.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password
import uuid
db = SessionLocal()
existing = db.query(User).filter(User.email=='arjungaur2727@gmail.com').first()
if existing:
    print('User already exists')
else:
    new_user = User(id=uuid.uuid4(), email='arjungaur2727@gmail.com', full_name='Arjun Gaur', hashed_password=hash_password('arjun123'), role='admin')
    db.add(new_user)
    db.commit()
    print('Admin user arjungaur2727@gmail.com created with password arjun123')


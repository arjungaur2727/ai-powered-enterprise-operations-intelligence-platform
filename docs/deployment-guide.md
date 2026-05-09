# Deployment Guide

This guide covers the production deployment of the platform using Vercel (Frontend), Render (Backend), and Neon (Database).

## Prerequisites
- GitHub account
- Vercel account
- Render account
- Neon PostgreSQL account
- OpenAI API Key

## 1. Database Setup (Neon)
1. Create a new project in Neon.
2. Create a database named `enterprise_ops`.
3. Copy the Connection String (ensure it's the Pooled connection if using Serverless).

## 2. Backend Deployment (Render)
1. Connect your GitHub repository to Render.
2. Create a new **Web Service**.
3. **Environment**: `Python 3`
4. **Build Command**: `pip install -r backend/requirements.txt`
5. **Start Command**: `gunicorn -k uvicorn.workers.UvicornWorker backend.main:app`
6. **Environment Variables**:
   - `DATABASE_URL`: Your Neon connection string.
   - `SECRET_KEY`: A strong random string.
   - `OPENAI_API_KEY`: Your OpenAI key.
   - `ENVIRONMENT`: `production`

## 3. Frontend Deployment (Vercel)
1. Connect your GitHub repository to Vercel.
2. Set the **Root Directory** to `frontend`.
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Environment Variables**:
   - `VITE_API_BASE_URL`: Your Render Web Service URL.

## 4. Post-Deployment
### Run Migrations
Run the Alembic migrations against your production database:
```bash
cd backend
python -m alembic upgrade head
```

### Initial Admin Setup
You may need to manually update the first registered user to `role='admin'` in the database to access the administrative panels.

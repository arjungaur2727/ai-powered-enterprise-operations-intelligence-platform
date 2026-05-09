# AI-Powered Enterprise Operations Intelligence Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)

An enterprise-grade operational intelligence platform that combines automated data ingestion, advanced SQL workflow management, and natural language AI querying into a single unified dashboard.

## 🚀 Key Features

*   **Smart Data Ingestion**: Drag-and-drop CSV/Excel uploads with automatic schema inference and dynamic table generation.
*   **AI Query Assistant**: Natural language to SQL translation powered by GPT-4o, allowing non-technical users to query complex datasets.
*   **SQL Automation Engine**: Build, save, and schedule complex SQL workflows with parameterized execution.
*   **KPI Dashboards**: Real-time visualization of business metrics and system performance.
*   **Automated Reporting**: Scheduled PDF and CSV report generation with email delivery.
*   **Proactive Alerting**: Threshold-based monitors and system anomaly notifications.
*   **Full Observability**: Immutable audit logging and live system health monitoring.

## 🛠️ Technology Stack

*   **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Recharts, Framer Motion.
*   **Backend**: FastAPI (Python), SQLAlchemy 2.0, Pydantic v2, Alembic, APScheduler.
*   **Database**: PostgreSQL 15+.
*   **AI/LLM**: OpenAI API (GPT-4o).
*   **DevOps**: Docker, GitHub Actions (CI/CD).

## 📂 Project Structure

```text
├── backend/                # FastAPI Application
│   ├── alembic/            # Database Migrations
│   ├── app/
│   │   ├── core/           # Security, Logging, Config
│   │   ├── models/         # SQLAlchemy ORM Models
│   │   ├── routers/        # API Endpoints
│   │   ├── services/       # Business Logic
│   │   └── schemas/        # Pydantic Models
│   └── main.py             # Application Entry Point
├── frontend/               # React Application
│   ├── src/
│   │   ├── api/            # API Clients
│   │   ├── components/     # Reusable UI Components
│   │   ├── context/        # State Management
│   │   └── pages/          # Page Views
├── docs/                   # Detailed Documentation
└── docker-compose.yml      # Local Development Environment
```

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+

### Backend Setup
1. `cd backend`
2. `pip install -r requirements.txt`
3. Create a `.env` file from `.env.example`.
4. Run migrations: `python -m alembic upgrade head`
5. Start server: `uvicorn main:app --reload`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Create a `.env` file (set `VITE_API_BASE_URL`).
4. Start dev server: `npm run dev`

## 🌍 Environment Variables

Key variables required for the backend:
- `DATABASE_URL`: PostgreSQL connection string.
- `SECRET_KEY`: JWT signing key.
- `OPENAI_API_KEY`: For the AI Assistant.
- `SMTP_USER`/`PASSWORD`: For report delivery and alerts.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

## 👤 Author
**Arjun Gaur**
- GitHub: [@arjungaur2727](http://github.com/arjungaur2727)

---
*Built for excellence in operational intelligence.*

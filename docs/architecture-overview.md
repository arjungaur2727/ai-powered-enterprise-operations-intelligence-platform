# Architecture Overview

## System Architecture

The AI-Powered Enterprise Operations Intelligence Platform is built on a modern, distributed architecture designed for scalability, security, and real-time intelligence.

### High-Level Diagram
```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│        Frontend (React)         │◄────▶│         Backend (FastAPI)       │
│  (Vite, Tailwind, Lucide, ...)  │      │  (Uvicorn, Pydantic, SQLAlchemy)│
└─────────────────────────────────┘      └────────────────┬────────────────┘
                                                          │
                                         ┌────────────────▼────────────────┐
                                         │           PostgreSQL            │
                                         │  (Core Data, Audit, Snapshots)  │
                                         └────────────────┬────────────────┘
                                                          │
                                         ┌────────────────▼────────────────┐
                                         │       External Services         │
                                         │  (OpenAI, SMTP, File Storage)   │
                                         └─────────────────────────────────┘
```

## Core Components

### 1. Ingestion Engine
Handles multi-format data uploads (CSV, Excel), performs schema inference, and dynamically generates PostgreSQL tables to store normalized data.

### 2. SQL Automation Engine
A central hub for managing and executing reusable SQL workflows. Supports parameterized queries and scheduled background execution via APScheduler.

### 3. AI Query Assistant
Leverages Large Language Models (GPT-4o) to translate natural language questions into precise SQL queries against the live database schema.

### 4. KPI & Reporting Engine
Generates automated executive summaries and operational reports in PDF/CSV formats. Features a rich dashboard with real-time metric visualization.

### 5. Alert & Notification System
Monitors data thresholds and system events to trigger real-time notifications via email and in-app alerts.

### 6. Audit & Observability
An immutable logging service that records every user and system action, coupled with a health monitoring engine for platform stability tracking.

## Security Design
- **Auth**: Stateless JWT-based authentication.
- **RBAC**: Role-Based Access Control (Admin, Manager, Analyst).
- **Isolation**: Each data upload is isolated in its own dynamic table.
- **Immutable Logs**: Audit logs cannot be modified once written.

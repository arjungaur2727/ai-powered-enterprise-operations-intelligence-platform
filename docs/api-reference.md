# API Reference

The backend provides a RESTful API built with FastAPI. Interactive documentation is available at `/docs` (Swagger) and `/redoc`.

## Authentication
All protected routes require a Bearer JWT token in the `Authorization` header.

```http
Authorization: Bearer <your_jwt_token>
```

## Key Endpoints

### Authentication
- `POST /api/v1/auth/login`: Authenticate and receive token.
- `POST /api/v1/auth/register`: Create a new user account.

### Data Ingestion
- `POST /api/v1/ingestion/upload`: Upload CSV/Excel and create dynamic table.
- `GET /api/v1/ingestion/uploads`: List all datasets.

### SQL Automation
- `GET /api/v1/sql/templates`: List saved workflows.
- `POST /api/v1/sql/execute`: Execute a raw or template-based query.

### AI Assistant
- `POST /api/v1/ai/generate`: Translate natural language to SQL.
- `POST /api/v1/ai/execute/{session_id}`: Run the generated SQL.

### Audit & Monitoring
- `GET /api/v1/audit`: Paginated platform activity logs (Admin only).
- `GET /api/v1/monitoring/health`: Real-time system health status.

### Reports & Alerts
- `GET /api/v1/reports`: Access generated business reports.
- `GET /api/v1/alerts`: View active system and data alerts.

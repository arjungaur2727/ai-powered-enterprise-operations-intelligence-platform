# Database Schema

The platform uses PostgreSQL as its primary data store. The schema is managed via Alembic migrations.

## Core Tables

### 1. `users`
Stores platform users and their roles.
- `id`: UUID (Primary Key)
- `email`: String (Unique)
- `hashed_password`: String
- `full_name`: String
- `role`: String (admin, manager, analyst)
- `is_active`: Boolean

### 2. `data_uploads`
Metadata for uploaded datasets.
- `id`: UUID (Primary Key)
- `target_table`: String (Name of the dynamically created table)
- `file_name`: String
- `row_count`: Integer
- `column_profile`: JSONB (Schema details)

### 3. `sql_templates`
Reusable SQL workflows.
- `id`: UUID (Primary Key)
- `name`: String
- `query_text`: Text
- `parameters`: JSONB

### 4. `ai_query_sessions`
History of AI-generated queries.
- `id`: UUID (Primary Key)
- `natural_language`: Text
- `generated_sql`: Text
- `confidence`: String
- `execution_status`: String

### 5. `audit_logs`
Immutable record of all actions.
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key)
- `action`: String
- `event_metadata`: JSONB
- `created_at`: Timestamp

### 6. `system_health_snapshots`
Periodic performance metrics.
- `id`: UUID (Primary Key)
- `db_connected`: Boolean
- `error_rate_pct`: Numeric
- `snapshot_at`: Timestamp

## Dynamic Tables
When a user uploads a file, a new table is created with the prefix `data_`. These tables are mapped in the `data_uploads` metadata table.

## Relationships
- `AuditLog` -> `User` (Optional)
- `SQLTemplate` -> `User` (Creator)
- `Report` -> `ReportTemplate`
- `Alert` -> `User` (Recipient)

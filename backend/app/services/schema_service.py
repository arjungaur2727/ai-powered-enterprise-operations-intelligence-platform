"""
app/services/schema_service.py

Provides database schema context for AI prompts.
"""

from datetime import datetime, timezone
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.schemas.ai_query import SchemaContextResponse, TableSchemaInfo, TableColumnInfo

class SchemaService:
    def __init__(self):
        self._cached_schema = None

    def get_schema_response(self, db: Session) -> SchemaContextResponse:
        self._ensure_cache(db)
        return self._cached_schema

    def get_schema_context(self, db: Session) -> tuple[dict, str]:
        schema_resp = self.get_schema_response(db)
        # return empty dict as schema_dict since it's only partially used,
        # and schema_text as the full preview
        return {}, schema_resp.schema_text_preview

    def force_refresh(self, db: Session) -> SchemaContextResponse:
        self._cached_schema = None
        self._ensure_cache(db)
        return self._cached_schema

    def _ensure_cache(self, db: Session):
        if self._cached_schema is not None:
            return

        engine = db.get_bind()
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        
        tables = []
        total_cols = 0
        schema_text_lines = []

        for table_name in table_names:
            columns = inspector.get_columns(table_name)
            pk_constraint = inspector.get_pk_constraint(table_name)
            pks = pk_constraint.get("constrained_columns", []) if pk_constraint else []
            fks = inspector.get_foreign_keys(table_name)
            
            fk_map = {}
            for fk in fks:
                for col in fk["constrained_columns"]:
                    fk_map[col] = f"{fk['referred_table']}.{fk['referred_columns'][0]}"
            
            table_cols = []
            schema_text_lines.append(f"CREATE TABLE {table_name} (")
            for col in columns:
                col_name = col["name"]
                col_type = str(col["type"])
                is_pk = col_name in pks
                is_fk = col_name in fk_map
                fk_ref = fk_map.get(col_name)

                table_cols.append(TableColumnInfo(
                    name=col_name,
                    type=col_type,
                    nullable=col.get("nullable", True),
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    fk_references=fk_ref
                ))
                
                col_line = f"  {col_name} {col_type}"
                if is_pk:
                    col_line += " PRIMARY KEY"
                if is_fk:
                    col_line += f" REFERENCES {fk_ref}"
                schema_text_lines.append(col_line + ",")
            
            schema_text_lines.append(");")
            
            tables.append(TableSchemaInfo(
                table_name=table_name,
                columns=table_cols,
                row_count_estimate=0,
                description=""
            ))
            total_cols += len(columns)

        self._cached_schema = SchemaContextResponse(
            tables=tables,
            table_count=len(tables),
            total_columns=total_cols,
            last_refreshed=datetime.now(timezone.utc),
            schema_text_preview="\n".join(schema_text_lines)
        )

schema_service = SchemaService()

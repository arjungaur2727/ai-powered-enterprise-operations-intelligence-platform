"""
app/models/kpi_snapshot.py — KPI snapshot ORM model.
"""
import uuid
from sqlalchemy import Column, Date, DateTime, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from app.database import Base


class KPISnapshot(Base):
    __tablename__ = "kpi_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    metric_name = Column(String(255), nullable=False, index=True)
    metric_value = Column(Numeric(15, 4), nullable=False)
    metric_unit = Column(String(50), nullable=True)
    dimension = Column(String(100), nullable=True)
    dimension_date = Column(Date, nullable=False, index=True)
    extra_metadata = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

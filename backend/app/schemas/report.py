"""
app/schemas/report.py — Pydantic v2 schemas for the Reporting Engine.
"""
from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator


class ReportConfig(BaseModel):
    date_range_days: int = 7
    include_kpi_summary: bool = True
    include_query_analytics: bool = True
    include_upload_summary: bool = True
    include_workflow_status: bool = True
    include_ai_usage: bool = False
    include_top_templates: bool = True
    include_activity_feed: bool = False
    custom_sql: str | None = None
    custom_sql_title: str | None = None
    branding_title: str = "Enterprise Operations Intelligence"
    branding_subtitle: str | None = None


class ReportTemplateCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    report_type: str = Field(..., pattern="^(executive_summary|query_analytics|upload_report|workflow_report|ai_usage|custom_sql)$")
    output_formats: list[str] = ["pdf"]
    config: ReportConfig = Field(default_factory=ReportConfig)


class ReportTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    output_formats: list[str] | None = None
    config: ReportConfig | None = None
    is_active: bool | None = None


class ReportTemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    report_type: str
    output_formats: list[str]
    config: dict
    is_active: bool
    created_by_name: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class GenerateReportRequest(BaseModel):
    template_id: str | None = None
    report_type: str | None = None
    output_format: str = "pdf"
    date_range_days: int = Field(7, ge=1, le=365)
    config_overrides: dict = {}

    @model_validator(mode="after")
    def check_one_source(self):
        if not self.template_id and not self.report_type:
            raise ValueError("Provide either template_id or report_type")
        return self


class GeneratedReportResponse(BaseModel):
    id: str
    report_type: str
    report_name: str
    output_format: str
    file_size_bytes: int = 0
    generation_source: str
    date_range_start: date | None = None
    date_range_end: date | None = None
    metadata: dict | None = None
    status: str
    generated_by_name: str | None = None
    generated_at: datetime
    download_url: str
    model_config = {"from_attributes": True}


class ReportScheduleCreate(BaseModel):
    template_id: str
    name: str = Field(..., min_length=3, max_length=255)
    cron_expression: str
    timezone: str = "UTC"
    output_format: str = "pdf"
    delivery_method: str = "store"
    email_recipients: list[str] = []
    email_subject: str | None = None


class ReportScheduleUpdate(BaseModel):
    name: str | None = None
    cron_expression: str | None = None
    timezone: str | None = None
    output_format: str | None = None
    delivery_method: str | None = None
    email_recipients: list[str] | None = None
    email_subject: str | None = None


class ReportScheduleResponse(BaseModel):
    id: str
    template_id: str
    template_name: str | None = None
    name: str
    cron_expression: str
    cron_human_readable: str = ""
    timezone: str
    output_format: str
    delivery_method: str
    email_recipients: list[str] = []
    is_active: bool
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    next_run_at: datetime | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ReportSection(BaseModel):
    title: str
    section_type: str
    data: dict | list


class ReportPreviewData(BaseModel):
    report_type: str
    date_range_start: date
    date_range_end: date
    sections: list[ReportSection] = []
    total_records: int = 0

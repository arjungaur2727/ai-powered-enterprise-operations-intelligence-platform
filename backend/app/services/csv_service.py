"""
app/services/csv_service.py
CSV report builder — BOM-encoded, Excel-compatible, section-separated.
"""
from __future__ import annotations
import csv
import io
from datetime import datetime
from app.schemas.report import ReportConfig


class CSVReportService:

    def _section_header(self, writer, title: str):
        writer.writerow([])
        writer.writerow([f"=== {title.upper()} ==="])
        writer.writerow([])

    def _write_kpi_section(self, writer, kpi: dict):
        self._section_header(writer, "Executive Summary")
        writer.writerow(["Metric", "Value", "Detail"])
        q, u, w, ai, usr = kpi.get("queries", {}), kpi.get("uploads", {}), kpi.get("workflows", {}), kpi.get("ai", {}), kpi.get("users", {})
        writer.writerows([
            ["Total Queries", q.get("total", 0), f'{q.get("success_rate", 0):.1f}% success'],
            ["Successful Queries", q.get("successful", 0), ""],
            ["Failed Queries", q.get("failed", 0), ""],
            ["Avg Execution Time", f'{q.get("avg_ms", 0)}ms', ""],
            ["Files Uploaded", u.get("total", 0), f'{u.get("success_rate", 0):.1f}% success'],
            ["Rows Ingested", u.get("rows_ingested", 0), ""],
            ["Active Workflows", w.get("active", 0), f'{w.get("failing", 0)} failing'],
            ["AI Sessions", ai.get("sessions", 0), f'{ai.get("tokens_used", 0)} tokens'],
            ["Active Users", usr.get("unique_active", 0), f'of {usr.get("total", 0)} total'],
        ])

    def _write_query_section(self, writer, q: dict):
        self._section_header(writer, "Query Analytics — Daily Breakdown")
        writer.writerow(["Date", "Total", "Successful", "Failed", "Avg Time (ms)"])
        for d in q.get("daily_data", []):
            writer.writerow([d["day"], d["total"], d["success"], d["failed"], d["avg_ms"] or 0])
        self._section_header(writer, "Query Analytics — Slowest Queries")
        writer.writerow(["Query Preview", "Execution Time (ms)", "Status", "Source", "Executed At"])
        for r in q.get("slowest_queries", []):
            writer.writerow([r["query_preview"], r["execution_ms"], r["status"], r["source"], r["executed_at"]])

    def _write_upload_section(self, writer, u: dict):
        self._section_header(writer, "File Uploads")
        writer.writerow(["File Name", "Type", "Target Table", "Rows", "Status", "Uploaded By", "Date"])
        for r in u.get("uploads", []):
            writer.writerow([r["file_name"], r["file_type"], r["target_table"], r["row_count"], r["status"], r["uploaded_by"], r["created_at"]])

    def _write_workflow_section(self, writer, w: dict):
        self._section_header(writer, "Scheduled Workflows")
        writer.writerow(["Name", "Template", "Schedule", "Active", "Last Run", "Last Status", "Failures"])
        for r in w.get("workflows", []):
            writer.writerow([r["name"], r["template_name"], r["cron_expression"], r["is_active"], r["last_run_at"], r["last_run_status"], r["failure_count"]])

    def _write_ai_section(self, writer, ai: dict):
        self._section_header(writer, "AI Query Sessions")
        writer.writerow(["Question", "Executed", "Status", "Tokens", "Rows", "User", "Date"])
        for r in ai.get("sessions", []):
            writer.writerow([r["question"], r["was_executed"], r["execution_status"], r["total_tokens"], r["row_count"], r["asked_by"], r["created_at"]])

    def generate_csv(self, report_data: dict, config: ReportConfig, report_name: str) -> bytes:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([config.branding_title])
        writer.writerow([report_name])
        writer.writerow([f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"])
        writer.writerow([f"Period: {report_data['period']['start']} to {report_data['period']['end']}"])
        writer.writerow([])
        if "kpi" in report_data: self._write_kpi_section(writer, report_data["kpi"])
        if "queries" in report_data: self._write_query_section(writer, report_data["queries"])
        if "uploads" in report_data: self._write_upload_section(writer, report_data["uploads"])
        if "workflows" in report_data: self._write_workflow_section(writer, report_data["workflows"])
        if "ai" in report_data: self._write_ai_section(writer, report_data["ai"])
        csv_bytes = output.getvalue().encode("utf-8-sig")  # BOM for Excel
        output.close()
        return csv_bytes


csv_service = CSVReportService()

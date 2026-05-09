"""
app/services/pdf_service.py
PDF report builder using ReportLab.
Produces branded A4 PDFs with cover page, KPI grid, and data tables.
"""
from __future__ import annotations
import datetime
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from app.core.logger import get_logger
from app.schemas.report import ReportConfig

COLOR_PRIMARY   = HexColor("#2563EB")
COLOR_DARK      = HexColor("#0F172A")
COLOR_SUCCESS   = HexColor("#16A34A")
COLOR_DANGER    = HexColor("#DC2626")
COLOR_WARNING   = HexColor("#D97706")
COLOR_LIGHT_BG  = HexColor("#F8FAFC")
COLOR_BORDER    = HexColor("#E2E8F0")
COLOR_MUTED     = HexColor("#64748B")
COLOR_HEADER_BG = HexColor("#1E3A5F")
COLOR_ROW_ALT   = HexColor("#F1F5F9")
PAGE_W = A4[0]


class PDFReportService:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_styles()
        self.logger = get_logger(__name__)

    def _setup_styles(self):
        add = self.styles.add
        add(ParagraphStyle("CoverTitle", fontName="Helvetica-Bold", fontSize=26, textColor=white, alignment=TA_CENTER, spaceAfter=8))
        add(ParagraphStyle("CoverSubtitle", fontName="Helvetica", fontSize=13, textColor=HexColor("#BFDBFE"), alignment=TA_CENTER, spaceAfter=6))
        add(ParagraphStyle("CoverDate", fontName="Helvetica", fontSize=10, textColor=HexColor("#93C5FD"), alignment=TA_CENTER))
        add(ParagraphStyle("SectionHeader", fontName="Helvetica-Bold", fontSize=14, textColor=COLOR_PRIMARY, spaceBefore=14, spaceAfter=6))
        add(ParagraphStyle("SubHeader", fontName="Helvetica-Bold", fontSize=11, textColor=COLOR_DARK, spaceBefore=10, spaceAfter=4))
        add(ParagraphStyle("BodySmall", fontName="Helvetica", fontSize=9, textColor=COLOR_DARK, leading=14, spaceAfter=4))
        add(ParagraphStyle("TableHeaderText", fontName="Helvetica-Bold", fontSize=9, textColor=white, alignment=TA_CENTER))
        add(ParagraphStyle("KPIValue", fontName="Helvetica-Bold", fontSize=20, textColor=COLOR_PRIMARY, alignment=TA_CENTER))
        add(ParagraphStyle("KPILabel", fontName="Helvetica", fontSize=8, textColor=COLOR_MUTED, alignment=TA_CENTER, spaceAfter=2))
        add(ParagraphStyle("KPISub", fontName="Helvetica", fontSize=7, textColor=COLOR_MUTED, alignment=TA_CENTER))
        add(ParagraphStyle("FooterText", fontName="Helvetica", fontSize=7, textColor=COLOR_MUTED, alignment=TA_CENTER))

    def _build_cover_page(self, report_name: str, period: dict, branding_title: str, branding_subtitle: str) -> list:
        elems = []
        # Header band
        header_data = [[
            Paragraph(branding_title, self.styles["CoverTitle"]),
            Paragraph(branding_subtitle or "", self.styles["CoverSubtitle"]),
        ]]
        header_table = Table([[Paragraph(branding_title, self.styles["CoverTitle"])]], colWidths=[PAGE_W - 4*cm], rowHeights=[4*cm])
        header_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_PRIMARY),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 16),
            ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ]))
        elems.append(header_table)
        elems.append(Spacer(0, 1*cm))
        elems.append(Paragraph(report_name, self.styles["SectionHeader"]))
        elems.append(HRFlowable(width="100%", color=COLOR_PRIMARY, thickness=2, spaceAfter=8))
        elems.append(Paragraph(
            f"Report Period: <b>{period.get('start', '')}</b> to <b>{period.get('end', '')}</b> ({period.get('days', 0)} days)",
            self.styles["BodySmall"]
        ))
        elems.append(Paragraph(
            f"Generated: {datetime.datetime.utcnow().strftime('%B %d, %Y at %I:%M %p UTC')}",
            self.styles["BodySmall"]
        ))
        elems.append(Spacer(0, 0.5*cm))
        elems.append(Paragraph("<i>Enterprise Operations Intelligence Platform — Confidential</i>", self.styles["FooterText"]))
        elems.append(PageBreak())
        return elems

    def _build_kpi_section(self, kpi_data: dict) -> list:
        elems = [
            Paragraph("Executive Summary", self.styles["SectionHeader"]),
            HRFlowable(width="100%", color=COLOR_BORDER, thickness=1),
            Spacer(0, 0.3*cm),
        ]
        q = kpi_data.get("queries", {})
        u = kpi_data.get("uploads", {})
        w = kpi_data.get("workflows", {})
        ai = kpi_data.get("ai", {})
        usr = kpi_data.get("users", {})

        def cell(value, label, sub=""):
            return [
                Paragraph(str(value), self.styles["KPIValue"]),
                Paragraph(label, self.styles["KPILabel"]),
                Paragraph(sub, self.styles["KPISub"]),
            ]

        failing = w.get("failing", 0)
        kpi_grid = [
            [cell(q.get("total", 0), "Total Queries", f'{q.get("success_rate", 0):.1f}% success rate'),
             cell(f'{u.get("rows_ingested", 0):,}', "Rows Ingested", f'{u.get("total", 0)} files'),
             cell(w.get("active", 0), "Active Workflows", f'{"⚠ " + str(failing) + " failing" if failing else "All healthy"}')],
            [cell(f'{q.get("avg_ms", 0)}ms', "Avg Query Time", "Today's average"),
             cell(ai.get("sessions", 0), "AI Sessions", f'{ai.get("tokens_used", 0):,} tokens'),
             cell(usr.get("unique_active", 0), "Active Users", f'of {usr.get("total", 0)} total')],
        ]
        kpi_table = Table(kpi_grid, colWidths=[5.5*cm, 5.5*cm, 5.5*cm])
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_BG),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]))
        elems.append(kpi_table)
        elems.append(Spacer(0, 0.5*cm))
        return elems

    def _build_data_table(self, title: str, headers: list, rows: list, col_widths=None, max_rows: int = 50) -> list:
        elems = [Paragraph(title, self.styles["SubHeader"])]
        if not rows:
            elems.append(Paragraph("<i>No data available for this period.</i>", self.styles["BodySmall"]))
            return elems

        add_footer = False
        original_count = len(rows)
        if len(rows) > max_rows:
            rows = rows[:max_rows]
            add_footer = True

        header_row = [Paragraph(str(h), self.styles["TableHeaderText"]) for h in headers]
        data_rows = []
        for row in rows:
            data_rows.append([str(v)[:55] + "…" if len(str(v)) > 55 else str(v) for v in row])

        all_rows = [header_row] + data_rows
        t = Table(all_rows, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, 0), 7),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, COLOR_ROW_ALT]),
            ("VALIGN", (0, 1), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 1), (-1, -1), 6),
            ("RIGHTPADDING", (0, 1), (-1, -1), 6),
            ("TOPPADDING", (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
        ]))
        elems.append(t)
        if add_footer:
            elems.append(Paragraph(f"* Showing first {max_rows} of {original_count} records. Use CSV export for full data.", self.styles["FooterText"]))
        elems.append(Spacer(0, 0.3*cm))
        return elems

    def _build_query_section(self, q: dict) -> list:
        t = q.get("totals", {})
        elems = [
            Paragraph("Query Analytics", self.styles["SectionHeader"]),
            HRFlowable(width="100%", color=COLOR_BORDER, thickness=1),
            Paragraph(f"During this period, <b>{t.get('total', 0)}</b> queries were executed with a "
                      f"<b>{t.get('success_rate', 0):.1f}%</b> success rate. Average execution time: <b>{q.get('daily_data', [{}])[0].get('avg_ms', '—')}ms</b>.",
                      self.styles["BodySmall"]),
        ]
        elems += self._build_data_table(
            "Daily Query Breakdown",
            ["Date", "Total", "Successful", "Failed", "Avg Time (ms)"],
            [[d["day"], d["total"], d["success"], d["failed"], d["avg_ms"] or "—"] for d in q.get("daily_data", [])],
            col_widths=[4*cm, 2.5*cm, 2.5*cm, 2.5*cm, 3.5*cm],
        )
        if q.get("slowest_queries"):
            elems += self._build_data_table(
                "Top 10 Slowest Successful Queries",
                ["Query Preview", "Time (ms)", "Source", "Executed At"],
                [[r["query_preview"], r["execution_ms"], r["source"], r["executed_at"]] for r in q["slowest_queries"]],
                col_widths=[9*cm, 2.5*cm, 2*cm, 4*cm],
            )
        return elems

    def _build_upload_section(self, u: dict) -> list:
        elems = [
            Paragraph("Data Upload Summary", self.styles["SectionHeader"]),
            HRFlowable(width="100%", color=COLOR_BORDER, thickness=1),
        ]
        elems += self._build_data_table(
            "Files Uploaded This Period",
            ["File Name", "Type", "Target Table", "Rows", "Status", "Uploaded By", "Date"],
            [[r["file_name"], r["file_type"], r["target_table"] or "—", r["row_count"],
              r["status"], r["uploaded_by"] or "—", r["created_at"][:10]] for r in u.get("uploads", [])],
            max_rows=30,
        )
        return elems

    def _build_workflow_section(self, w: dict) -> list:
        elems = [
            Paragraph("Scheduled Workflow Report", self.styles["SectionHeader"]),
            HRFlowable(width="100%", color=COLOR_BORDER, thickness=1),
        ]
        elems += self._build_data_table(
            "All Workflows",
            ["Name", "Template", "Schedule", "Active", "Last Run", "Failures"],
            [[r["name"], r["template_name"] or "—", r["cron_expression"], "Yes" if r["is_active"] else "No",
              r["last_run_at"], r["failure_count"]] for r in w.get("workflows", [])],
            col_widths=[4*cm, 3.5*cm, 3*cm, 1.5*cm, 3*cm, 2*cm],
        )
        if w.get("execution_stats"):
            elems += self._build_data_table(
                "Execution Statistics (Period)",
                ["Workflow", "Runs", "Success", "Failed", "Avg Time (ms)"],
                [[r["workflow_name"], r["runs"], r["successes"], r["failures"], r["avg_ms"]] for r in w["execution_stats"]],
            )
        return elems

    def _build_ai_section(self, ai: dict) -> list:
        t = ai.get("totals", {})
        elems = [
            Paragraph("AI Query Assistant Usage", self.styles["SectionHeader"]),
            HRFlowable(width="100%", color=COLOR_BORDER, thickness=1),
            Paragraph(f"<b>{t.get('total', 0)}</b> AI sessions. Total tokens consumed: <b>{t.get('tokens', 0):,}</b>.", self.styles["BodySmall"]),
        ]
        elems += self._build_data_table(
            "Recent AI Sessions",
            ["Question", "Executed", "Tokens", "Rows", "User", "Date"],
            [[r["question"], "Yes" if r["was_executed"] else "No", r["total_tokens"],
              r["row_count"], r["asked_by"] or "—", r["created_at"][:10]] for r in ai.get("sessions", [])],
            max_rows=30,
        )
        return elems

    def _footer_canvas(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(COLOR_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, 1.8*cm, A4[0] - doc.rightMargin, 1.8*cm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(COLOR_MUTED)
        canvas.drawString(doc.leftMargin, 1.3*cm, "Enterprise Operations Intelligence Platform — Confidential")
        canvas.drawRightString(A4[0] - doc.rightMargin, 1.3*cm, f"Page {doc.page}")
        canvas.restoreState()

    def generate_pdf(self, report_data: dict, config: ReportConfig, report_name: str) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            topMargin=2*cm, bottomMargin=2.5*cm, leftMargin=2*cm, rightMargin=2*cm,
            title=report_name, author="Enterprise Ops Intelligence Platform",
        )
        story = []
        story += self._build_cover_page(report_name, report_data.get("period", {}),
                                         config.branding_title, config.branding_subtitle or report_name)
        if "kpi" in report_data:
            story += self._build_kpi_section(report_data["kpi"])
            story.append(PageBreak())
        if "queries" in report_data:
            story += self._build_query_section(report_data["queries"])
            story.append(PageBreak())
        if "uploads" in report_data:
            story += self._build_upload_section(report_data["uploads"])
            story.append(PageBreak())
        if "workflows" in report_data:
            story += self._build_workflow_section(report_data["workflows"])
            story.append(PageBreak())
        if "ai" in report_data:
            story += self._build_ai_section(report_data["ai"])
            story.append(PageBreak())
        if "templates" in report_data and report_data["templates"]:
            story += self._build_data_table(
                "Top SQL Templates",
                ["Template Name", "Executions", "Success Rate (%)", "Avg Time (ms)"],
                [[r["name"], r["executions"], r["success_rate"], r["avg_ms"]] for r in report_data["templates"]],
            )
        doc.build(story, onFirstPage=self._footer_canvas, onLaterPages=self._footer_canvas)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        self.logger.info("PDF generated: %d bytes", len(pdf_bytes))
        return pdf_bytes


pdf_service = PDFReportService()

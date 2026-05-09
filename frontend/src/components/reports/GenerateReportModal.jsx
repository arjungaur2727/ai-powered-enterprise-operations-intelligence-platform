/**
 * src/components/reports/GenerateReportModal.jsx
 * Config modal: date range, format, section toggles, data preview.
 */
import React, { useEffect, useState } from "react";
import { X, FileText, FileSpreadsheet, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { previewReport } from "../../api/reportApi";

const PERIOD_OPTIONS = [
  { label: "Last 7 Days",  value: 7 },
  { label: "Last 14 Days", value: 14 },
  { label: "Last 30 Days", value: 30 },
  { label: "Last 90 Days", value: 90 },
];

const SECTIONS = [
  { key: "include_kpi_summary",       label: "KPI Summary" },
  { key: "include_query_analytics",   label: "Query Analytics" },
  { key: "include_upload_summary",    label: "Upload Summary" },
  { key: "include_workflow_status",   label: "Workflow Status" },
  { key: "include_ai_usage",          label: "AI Usage" },
  { key: "include_top_templates",     label: "Top Templates" },
];

export default function GenerateReportModal({ isOpen, onClose, onGenerate, template, isGenerating }) {
  const [days, setDays] = useState(7);
  const [format, setFormat] = useState("pdf");
  const [sections, setSections] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [brandingTitle, setBrandingTitle] = useState("");
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!template) return;
    const cfg = template.config || {};
    const init = {};
    SECTIONS.forEach(({ key }) => { init[key] = cfg[key] ?? false; });
    setSections(init);
    setFormat((template.output_formats || ["pdf"])[0]);
    setBrandingTitle(cfg.branding_title || "Enterprise Operations Intelligence");
    setPreviewData(null);
  }, [template]);

  if (!isOpen || !template) return null;

  const getDateRange = () => {
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - days);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const data = await previewReport(template.report_type, days);
      setPreviewData(data);
    } catch { setPreviewData(null); }
    finally { setPreviewing(false); }
  };

  const handleSubmit = () => {
    const config_overrides = { ...sections, branding_title: brandingTitle, date_range_days: days };
    onGenerate({
      template_id: template.id,
      output_format: format,
      date_range_days: days,
      config_overrides,
    });
  };

  const hasSection = Object.values(sections).some(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Generate Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Period */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Reporting Period</label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => { setDays(o.value); setPreviewData(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${days === o.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{getDateRange()} ({days} days)</p>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Output Format</label>
            <div className="flex gap-3">
              {(template.output_formats || ["pdf"]).map((fmt) => (
                <label key={fmt} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors
                  ${format === fmt ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-200"}`}>
                  <input type="radio" className="sr-only" checked={format === fmt} onChange={() => setFormat(fmt)} />
                  {fmt === "pdf" ? <FileText className="h-4 w-4 text-red-500" /> : <FileSpreadsheet className="h-4 w-4 text-green-600" />}
                  <span className="text-sm font-medium text-gray-700">{fmt === "pdf" ? "PDF Report" : "CSV Export"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Include Sections</label>
            <div className="grid grid-cols-2 gap-2">
              {SECTIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={!!sections[key]} onChange={(e) => setSections((s) => ({ ...s, [key]: e.target.checked }))} />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
            {!hasSection && <p className="text-xs text-red-500 mt-1">Select at least one section</p>}
          </div>

          {/* Advanced toggle */}
          <div>
            <button onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Advanced Branding
            </button>
            {showAdvanced && (
              <div className="mt-3">
                <input type="text" value={brandingTitle} onChange={(e) => setBrandingTitle(e.target.value)}
                  placeholder="Report title override"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Data Preview</span>
              <button onClick={handlePreview} disabled={previewing}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 flex items-center gap-1">
                {previewing && <Loader2 className="h-3 w-3 animate-spin" />}
                {previewing ? "Loading…" : "Preview Data"}
              </button>
            </div>
            {previewData ? (
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>Period: <span className="font-medium">{previewData.date_range_start} → {previewData.date_range_end}</span></div>
                {previewData.data?.kpi && (
                  <>
                    <div>Queries: <span className="font-medium">{previewData.data.kpi.queries?.total || 0}</span></div>
                    <div>Uploads: <span className="font-medium">{previewData.data.kpi.uploads?.total || 0}</span></div>
                    <div>AI Sessions: <span className="font-medium">{previewData.data.kpi.ai?.sessions || 0}</span></div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Click "Preview Data" to see what will be included</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isGenerating || !hasSection}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
            {isGenerating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isGenerating ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

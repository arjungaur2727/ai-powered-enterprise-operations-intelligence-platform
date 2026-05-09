/**
 * src/pages/Reports.jsx
 * Automated Reporting Engine — 3-tab page: Generate, Archive, Schedules.
 */
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BarChart2, Clock, FolderOpen, Plus } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import ReportTemplateGrid from "../components/reports/ReportTemplateGrid";
import GenerateReportModal from "../components/reports/GenerateReportModal";
import ReportHistoryTable from "../components/reports/ReportHistoryTable";
import ScheduleReportModal from "../components/reports/ScheduleReportModal";
import ScheduleListTable from "../components/reports/ScheduleListTable";
import { useAuth } from "../context/AuthContext";
import {
  createSchedule, deleteReport, deleteSchedule, downloadReport,
  generateReport, getReportHistory, getReportTemplates, getSchedules,
  toggleSchedule, updateSchedule,
} from "../api/reportApi";
import { formatFileSize } from "../utils/formatters";

const TABS = [
  { id: "generate", label: "Generate Reports", icon: BarChart2 },
  { id: "history",  label: "Report Archive",   icon: FolderOpen },
  { id: "schedules",label: "Schedules",         icon: Clock },
];

export default function Reports() {
  const { user } = useAuth();
  const isManager = ["manager", "admin"].includes(user?.role);
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState("generate");
  const [templates, setTemplates] = useState([]);
  const [reports, setReports] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [isSchedModalOpen, setIsSchedModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState({ templates: true, reports: true, schedules: true });

  const fetchAll = useCallback(async () => {
    const [tmplRes, rptRes, schedRes] = await Promise.allSettled([
      getReportTemplates(), getReportHistory(), isManager ? getSchedules() : Promise.resolve([]),
    ]);
    if (tmplRes.status === "fulfilled") setTemplates(tmplRes.value);
    if (rptRes.status === "fulfilled") setReports(rptRes.value);
    if (schedRes.status === "fulfilled") setSchedules(schedRes.value);
    setLoading({ templates: false, reports: false, schedules: false });
  }, [isManager]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Generate
  const handleGenerate = useCallback(async (template, config) => {
    setGeneratingId(template.id);
    setIsGenModalOpen(false);
    try {
      const result = await generateReport(config);
      toast.success(`Report ready: ${result.report_name} (${formatFileSize(result.file_size_bytes)})`);
      const updated = await getReportHistory();
      setReports(updated);
      setActiveTab("history");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Report generation failed");
    } finally {
      setGeneratingId(null);
    }
  }, []);

  const openGenModal = (template) => { setSelectedTemplate(template); setIsGenModalOpen(true); };

  // Download
  const handleDownload = useCallback(async (report) => {
    setDownloadingId(report.id);
    try {
      await downloadReport(report.id, report.report_name, report.output_format);
      toast.success("Download started");
    } catch {
      toast.error("Download failed. The report may have expired.");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // Delete report
  const handleDeleteReport = useCallback(async (reportId) => {
    try {
      await deleteReport(reportId);
      setReports((r) => r.filter((x) => x.id !== reportId));
      toast.success("Report deleted");
    } catch { toast.error("Failed to delete report"); }
  }, []);

  // Schedule actions
  const handleSaveSchedule = async (data) => {
    setIsSaving(true);
    try {
      if (editingSchedule) {
        const updated = await updateSchedule(editingSchedule.id, data);
        setSchedules((s) => s.map((x) => x.id === updated.id ? updated : x));
        toast.success("Schedule updated");
      } else {
        const created = await createSchedule(data);
        setSchedules((s) => [created, ...s]);
        toast.success("Report scheduled");
      }
      setIsSchedModalOpen(false);
      setEditingSchedule(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save schedule");
    } finally { setIsSaving(false); }
  };

  const handleToggleSchedule = async (id) => {
    try {
      const updated = await toggleSchedule(id);
      setSchedules((s) => s.map((x) => x.id === updated.id ? updated : x));
    } catch { toast.error("Failed to toggle schedule"); }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await deleteSchedule(id);
      setSchedules((s) => s.filter((x) => x.id !== id));
      toast.success("Schedule deleted");
    } catch { toast.error("Failed to delete schedule"); }
  };

  const handleRunNow = (schedule) => {
    const tmpl = templates.find((t) => t.id === schedule.template_id);
    if (tmpl) openGenModal(tmpl);
    else toast.error("Template not found");
  };

  // Stats
  const readyReports = reports.filter((r) => r.status === "ready");
  const totalSize = readyReports.reduce((a, r) => a + (r.file_size_bytes || 0), 0);
  const pdfCount = readyReports.filter((r) => r.output_format === "pdf").length;
  const csvCount = readyReports.filter((r) => r.output_format === "csv").length;

  return (
    <AppLayout title="Automated Reporting">
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Automated Reporting</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate, schedule, and download platform reports</p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = id === "history" ? reports.length : id === "schedules" ? schedules.length : null;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}>
                <Icon className="h-4 w-4" />
                {label}
                {count !== null && (
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab: Generate */}
        {activeTab === "generate" && (
          <div className="space-y-6">
            <ReportTemplateGrid
              templates={templates}
              onGenerate={openGenModal}
              onSchedule={(t) => { setSelectedTemplate(t); setEditingSchedule(null); setIsSchedModalOpen(true); }}
              generatingId={generatingId}
              canSchedule={isManager}
              isLoading={loading.templates}
            />
            {/* Quick stats */}
            {!loading.reports && readyReports.length > 0 && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-3 flex flex-wrap gap-4 text-sm">
                <span className="text-gray-500">Total archive:</span>
                <span className="font-medium text-gray-800">{pdfCount} PDF</span>
                <span className="font-medium text-gray-800">{csvCount} CSV</span>
                <span className="text-gray-400">•</span>
                <span className="font-medium text-gray-800">{formatFileSize(totalSize)} stored</span>
              </div>
            )}
          </div>
        )}

        {/* Tab: History */}
        {activeTab === "history" && (
          <ReportHistoryTable
            reports={reports}
            isLoading={loading.reports}
            onDownload={handleDownload}
            onDelete={handleDeleteReport}
            currentUser={user}
            downloadingId={downloadingId}
          />
        )}

        {/* Tab: Schedules */}
        {activeTab === "schedules" && (
          <div className="space-y-4">
            {isManager && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setEditingSchedule(null); setSelectedTemplate(templates[0] || null); setIsSchedModalOpen(true); }}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Schedule
                </button>
              </div>
            )}
            <ScheduleListTable
              schedules={schedules}
              isLoading={loading.schedules}
              onEdit={(s) => { setEditingSchedule(s); setSelectedTemplate(templates.find((t) => t.id === s.template_id) || null); setIsSchedModalOpen(true); }}
              onToggle={handleToggleSchedule}
              onDelete={handleDeleteSchedule}
              onRunNow={handleRunNow}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <GenerateReportModal
        isOpen={isGenModalOpen}
        onClose={() => setIsGenModalOpen(false)}
        onGenerate={(config) => handleGenerate(selectedTemplate, config)}
        template={selectedTemplate}
        isGenerating={!!generatingId}
      />
      <ScheduleReportModal
        isOpen={isSchedModalOpen}
        onClose={() => { setIsSchedModalOpen(false); setEditingSchedule(null); }}
        onSave={handleSaveSchedule}
        template={selectedTemplate}
        editingSchedule={editingSchedule}
        isSaving={isSaving}
      />
    </AppLayout>
  );
}

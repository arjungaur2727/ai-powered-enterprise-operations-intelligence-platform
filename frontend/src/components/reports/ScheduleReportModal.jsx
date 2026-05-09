/**
 * src/components/reports/ScheduleReportModal.jsx
 * Create/edit report schedule with cron expression and delivery options.
 */
import React, { useEffect, useState } from "react";
import { X, Mail, HardDrive, Info, Loader2 } from "lucide-react";

const COMMON_CRONS = [
  { label: "Every Monday 9 AM",   value: "0 9 * * 1" },
  { label: "Every day 8 AM",      value: "0 8 * * *" },
  { label: "1st of month 9 AM",   value: "0 9 1 * *" },
  { label: "Every Sunday midnight",value: "0 0 * * 0" },
];

export default function ScheduleReportModal({ isOpen, onClose, onSave, template, editingSchedule, isSaving }) {
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 9 * * 1");
  const [timezone, setTimezone] = useState("UTC");
  const [outputFormat, setOutputFormat] = useState("pdf");
  const [delivery, setDelivery] = useState("store");
  const [emailList, setEmailList] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailSubject, setEmailSubject] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (editingSchedule) {
      setName(editingSchedule.name);
      setCron(editingSchedule.cron_expression);
      setTimezone(editingSchedule.timezone || "UTC");
      setOutputFormat(editingSchedule.output_format || "pdf");
      setDelivery(editingSchedule.delivery_method || "store");
      setEmailList(editingSchedule.email_recipients || []);
      setEmailSubject(editingSchedule.email_subject || "");
    } else if (template) {
      setName(`${template.name} — Weekly`);
      setCron("0 9 * * 1");
      setOutputFormat((template.output_formats || ["pdf"])[0]);
      setDelivery("store");
      setEmailList([]);
      setEmailSubject("");
    }
  }, [isOpen, template, editingSchedule]);

  if (!isOpen) return null;

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !emailList.includes(e)) {
      setEmailList((l) => [...l, e]);
      setEmailInput("");
    }
  };

  const handleSubmit = () => {
    onSave({
      template_id: template?.id || editingSchedule?.template_id,
      name,
      cron_expression: cron,
      timezone,
      output_format: outputFormat,
      delivery_method: delivery,
      email_recipients: emailList,
      email_subject: emailSubject || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{editingSchedule ? "Edit Schedule" : "Schedule Report"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Schedule Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Cron presets */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Schedule</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_CRONS.map((c) => (
                <button key={c.value} onClick={() => setCron(c.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${cron === c.value ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <input type="text" value={cron} onChange={(e) => setCron(e.target.value)}
              placeholder="Custom cron (e.g. 0 9 * * 1)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Format + Delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Format</label>
              <div className="flex gap-2">
                {["pdf", "csv"].map((f) => (
                  <button key={f} onClick={() => setOutputFormat(f)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${outputFormat === f ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-200"}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Delivery</label>
              <div className="flex gap-2">
                <button onClick={() => setDelivery("store")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-colors ${delivery === "store" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-200"}`}>
                  <HardDrive className="h-3.5 w-3.5" />Store
                </button>
                <button onClick={() => setDelivery("both")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-colors ${delivery === "both" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-blue-200"}`}>
                  <Mail className="h-3.5 w-3.5" />Email
                </button>
              </div>
            </div>
          </div>

          {/* Email config */}
          {delivery === "both" && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">Email delivery requires SMTP configuration (Phase 7 Alert Engine).</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Recipients</label>
                <div className="flex gap-2">
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addEmail()}
                    placeholder="email@example.com"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={addEmail} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Add</button>
                </div>
                {emailList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {emailList.map((e) => (
                      <span key={e} className="flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 text-xs px-2 py-0.5">
                        {e}
                        <button onClick={() => setEmailList((l) => l.filter((x) => x !== e))} className="hover:text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject (optional)"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={isSaving || !name || !cron}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editingSchedule ? "Save Changes" : "Schedule Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

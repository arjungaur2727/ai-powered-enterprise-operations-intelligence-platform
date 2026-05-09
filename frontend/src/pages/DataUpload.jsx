/**
 * src/pages/DataUpload.jsx
 *
 * Full 4-step data ingestion page:
 *   Step 1 — Upload File (UploadDropzone)
 *   Step 2 — Preview & Validate (DataPreviewTable + ValidationErrorPanel)
 *   Step 3 — Confirming (loading animation)
 *   Step 4 — Complete (success summary)
 *
 * Below the stepper: persistent UploadHistoryTable.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  ScrollText,
} from "lucide-react";

import AppLayout from "../components/layout/AppLayout";
import UploadStatusStepper from "../components/upload/UploadStatusStepper";
import UploadDropzone from "../components/upload/UploadDropzone";
import DataPreviewTable from "../components/upload/DataPreviewTable";
import ValidationErrorPanel from "../components/upload/ValidationErrorPanel";
import UploadHistoryTable from "../components/upload/UploadHistoryTable";

import { uploadFile, confirmUpload, getUploadHistory } from "../api/uploadApi";
import { formatFileSize, formatDuration, formatRowCount } from "../utils/formatters";

const INITIAL_STATE = {
  step: 1,
  selectedFile: null,
  targetTable: "",
  uploadInitData: null,
  columnMapping: {},
  confirmResult: null,
  isLoading: false,
};

export default function DataUpload() {
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetTable, setTargetTable] = useState("");
  const [uploadInitData, setUploadInitData] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [confirmResult, setConfirmResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const historyRef = useRef(null);

  // -----------------------------------------------------------------------
  // Load upload history
  // -----------------------------------------------------------------------
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await getUploadHistory(0, 20);
      setHistory(data);
    } catch {
      // silent — don't block the UI
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // -----------------------------------------------------------------------
  // Reset all state to step 1
  // -----------------------------------------------------------------------
  const reset = () => {
    setStep(1);
    setSelectedFile(null);
    setTargetTable("");
    setUploadInitData(null);
    setColumnMapping({});
    setConfirmResult(null);
    setIsLoading(false);
  };

  // -----------------------------------------------------------------------
  // Step 1 → 2: Parse file
  // -----------------------------------------------------------------------
  const handleFileSelected = async (file, table) => {
    setSelectedFile(file);
    setTargetTable(table);
    setIsLoading(true);
    try {
      const data = await uploadFile(file, table);
      setUploadInitData(data);
      setColumnMapping(data.column_mapping || {});
      setStep(2);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to parse file. Please try again.";
      toast.error(msg);
      // Increment notification badge in localStorage
      const prev = parseInt(localStorage.getItem("unread_alerts") || "0", 10);
      localStorage.setItem("unread_alerts", String(prev + 1));
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Step 2 → 3 → 4: Confirm import
  // -----------------------------------------------------------------------
  const handleConfirm = async () => {
    if (!uploadInitData) return;
    setStep(3);
    setIsLoading(true);
    try {
      const result = await confirmUpload(
        uploadInitData.upload_id,
        columnMapping,
        targetTable
      );
      setConfirmResult(result);
      setStep(4);
      toast.success(result.message);
      fetchHistory(); // refresh history
    } catch (err) {
      const msg = err?.response?.data?.detail || "Import failed. Please try again.";
      toast.error(msg);
      const prev = parseInt(localStorage.getItem("unread_alerts") || "0", 10);
      localStorage.setItem("unread_alerts", String(prev + 1));
      setStep(2); // go back to preview
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Derived: blocking errors prevent confirm
  // -----------------------------------------------------------------------
  const hasBlockingErrors = uploadInitData?.validation_errors?.some(
    (e) => e.is_blocking
  );

  return (
    <AppLayout title="Data Ingestion">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-bold text-text-primary">Data Upload</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Import CSV or Excel files directly into your PostgreSQL database.
          </p>
        </div>

        {/* Stepper */}
        <div className="card py-5">
          <UploadStatusStepper currentStep={step} />
        </div>

        {/* ── STEP 1: Drop zone ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="card">
            <h3 className="font-semibold text-text-primary mb-4">Upload Your File</h3>
            <UploadDropzone onFileSelected={handleFileSelected} isLoading={isLoading} />
          </div>
        )}

        {/* ── STEP 2: Preview & Validate ────────────────────────────── */}
        {step === 2 && uploadInitData && (
          <div className="space-y-4">
            {/* File summary bar */}
            <div className="card flex flex-wrap items-center gap-4 py-4">
              <FileSpreadsheet className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary truncate">
                  {uploadInitData.file_name}
                </p>
                <p className="text-sm text-text-muted">
                  {formatRowCount(uploadInitData.row_count)} ·{" "}
                  {uploadInitData.column_count} columns ·{" "}
                  {formatFileSize(uploadInitData.file_size)} ·{" "}
                  {uploadInitData.file_type.toUpperCase()}
                </p>
              </div>
              <span
                className={`badge ${hasBlockingErrors
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                  }`}
              >
                {hasBlockingErrors ? "Errors found" : "Validation passed"}
              </span>
            </div>

            {/* Validation panel */}
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">Validation Results</h3>
              <ValidationErrorPanel errors={uploadInitData.validation_errors} />
            </div>

            {/* Preview + mapping */}
            <div className="card">
              <DataPreviewTable
                columns={uploadInitData.columns}
                previewRows={uploadInitData.preview_data}
                columnMapping={columnMapping}
                onMappingChange={setColumnMapping}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                id="upload-back-btn"
                onClick={reset}
                className="btn-secondary flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                id="upload-confirm-btn"
                onClick={handleConfirm}
                disabled={hasBlockingErrors || isLoading}
                className="btn-primary flex items-center gap-2 px-6"
              >
                Confirm Import
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Inserting ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="card flex flex-col items-center justify-center gap-5 py-16">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-text-primary">Inserting data…</p>
              <p className="text-sm text-text-muted mt-1">
                Importing {formatRowCount(uploadInitData?.row_count)} into{" "}
                <span className="font-mono font-medium text-primary">{targetTable}</span>
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 4: Complete ──────────────────────────────────────── */}
        {step === 4 && confirmResult && (
          <div className="card flex flex-col items-center gap-6 py-10">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-text-primary">Import Successful!</h3>
              <p className="text-text-secondary mt-1">{confirmResult.message}</p>
            </div>

            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-xl">
              {[
                { label: "Rows Inserted", value: confirmResult.rows_inserted?.toLocaleString(), icon: ScrollText },
                { label: "Target Table", value: confirmResult.target_table, icon: Database },
                { label: "Processing Time", value: formatDuration(confirmResult.processing_ms), icon: Loader2 },
                { label: "Status", value: confirmResult.status, icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="text-center p-4 bg-surface rounded-xl border border-surface-border">
                  <p className="text-lg font-bold text-text-primary">{item.value}</p>
                  <p className="text-xs text-text-muted mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                id="upload-again-btn"
                onClick={reset}
                className="btn-secondary flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Upload Another File
              </button>
              <button
                id="upload-view-history-btn"
                onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="btn-primary flex items-center gap-2"
              >
                <ScrollText className="h-4 w-4" />
                View Upload History
              </button>
            </div>
          </div>
        )}

        {/* ── Upload History (always visible) ───────────────────────── */}
        <div ref={historyRef}>
          <UploadHistoryTable
            uploads={history}
            isLoading={historyLoading}
            onViewDetail={(id) => toast(`Upload ID: ${id}`, { icon: "📋" })}
          />
        </div>
      </div>
    </AppLayout>
  );
}

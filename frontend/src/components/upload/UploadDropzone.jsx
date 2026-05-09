/**
 * src/components/upload/UploadDropzone.jsx
 *
 * Drag-and-drop file upload zone with table name input.
 *
 * Props:
 *   onFileSelected(file: File, targetTable: string) — called on upload button click
 *   isLoading {boolean}
 */

import React, { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { formatFileSize } from "../../utils/formatters";

const TABLE_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;

export default function UploadDropzone({ onFileSelected, isLoading }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetTable, setTargetTable] = useState("");
  const [tableError, setTableError] = useState("");

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setSelectedFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setSelectedFile(f);
  };

  const validateTableName = (value) => {
    if (!value) return "Table name is required.";
    if (!TABLE_NAME_RE.test(value))
      return "Only lowercase letters, digits, underscores. Must start with a letter.";
    return "";
  };

  const handleTableChange = (e) => {
    const val = e.target.value;
    setTargetTable(val);
    setTableError(validateTableName(val));
  };

  const handleSubmit = () => {
    const err = validateTableName(targetTable);
    if (err) { setTableError(err); return; }
    if (!selectedFile) return;
    onFileSelected(selectedFile, targetTable);
  };

  const isValid = selectedFile && targetTable && !tableError;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : selectedFile
            ? "border-emerald-400 bg-emerald-50"
            : "border-surface-border bg-surface hover:border-primary/60 hover:bg-primary/5"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{selectedFile.name}</p>
              <p className="text-sm text-text-muted mt-0.5">
                {formatFileSize(selectedFile.size)} ·{" "}
                {selectedFile.name.split(".").pop()?.toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="h-3 w-3" />
              Remove file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                dragActive ? "bg-primary/20" : "bg-surface-border"
              }`}
            >
              <UploadCloud
                className={`h-7 w-7 ${dragActive ? "text-primary" : "text-text-muted"}`}
              />
            </div>
            <div>
              <p className="font-semibold text-text-primary">
                Drag &amp; drop your CSV or Excel file here
              </p>
              <p className="mt-1 text-sm text-text-muted">
                or <span className="text-primary underline">browse files</span> · Supports .csv,
                .xlsx up to 50MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Target table name */}
      <div>
        <label htmlFor="upload-target-table" className="label">
          Target Table Name
          <span className="ml-1 text-text-muted font-normal">(where data will be inserted)</span>
        </label>
        <input
          id="upload-target-table"
          type="text"
          value={targetTable}
          onChange={handleTableChange}
          placeholder="e.g. sales_data_q1"
          className={`input ${tableError ? "border-red-400 focus:ring-red-400" : ""}`}
        />
        {tableError && <p className="mt-1 text-xs text-red-500">{tableError}</p>}
        {!tableError && targetTable && (
          <p className="mt-1 text-xs text-emerald-600">✓ Valid table name</p>
        )}
      </div>

      {/* Upload button */}
      <button
        id="upload-parse-btn"
        type="button"
        onClick={handleSubmit}
        disabled={!isValid || isLoading}
        className="btn-primary w-full py-2.5"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Parsing file…
          </span>
        ) : (
          "Parse & Preview File"
        )}
      </button>
    </div>
  );
}

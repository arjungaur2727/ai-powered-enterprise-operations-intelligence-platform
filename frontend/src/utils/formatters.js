/**
 * src/utils/formatters.js
 * Reusable formatting utilities used across the platform.
 */

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string} e.g. "1.4 MB" | "230 KB" | "512 B"
 */
export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Format an ISO datetime string into a locale-friendly display.
 * @param {string|null} isoString
 * @returns {string} e.g. "May 9, 2026 at 3:45 PM"
 */
export function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

/**
 * Truncate text to maxLength characters with ellipsis.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateText(text, maxLength = 30) {
  if (!text) return "";
  const str = String(text);
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}

/**
 * Format a number with comma thousands separators + "rows" suffix.
 * @param {number} n
 * @returns {string} e.g. "1,234 rows"
 */
export function formatRowCount(n) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toLocaleString()} rows`;
}

/**
 * Format processing duration in milliseconds.
 * @param {number} ms
 * @returns {string} e.g. "1.23s" | "450ms"
 */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

/** Format relative time: "Just now" | "5 min ago" | "2 hours ago" */
export function formatRelativeTime(isoString) {
  if (!isoString) return "—";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  return formatDateTime(isoString);
}

/** Format large token counts: 1234 → "1.2K", 1234567 → "1.2M" */
export function formatTokenCount(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format milliseconds with context-aware units */
export function formatMs(ms) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1) return "< 1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/** Format a percentage value */
export function formatPercentage(value, decimals = 1) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(decimals)}%`;
}

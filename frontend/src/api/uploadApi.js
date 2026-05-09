/**
 * src/api/uploadApi.js
 * Upload-related API calls.
 */

import axiosClient from "./axiosClient";

/**
 * Parse a CSV/Excel file and return a preview + validation result.
 * @param {File} file
 * @param {string} targetTable
 * @returns {Promise<object>} UploadInitResponse
 */
export async function uploadFile(file, targetTable) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target_table", targetTable);

  const { data } = await axiosClient.post("/api/v1/upload/file", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/**
 * Confirm upload and trigger DB insertion.
 * @param {string} uploadId
 * @param {Record<string,string>} columnMapping
 * @param {string} targetTable
 * @returns {Promise<object>} UploadConfirmResponse
 */
export async function confirmUpload(uploadId, columnMapping, targetTable) {
  const { data } = await axiosClient.post(`/api/v1/upload/confirm/${uploadId}`, {
    column_mapping: columnMapping,
    target_table: targetTable,
  });
  return data;
}

/**
 * Fetch paginated upload history.
 * @param {number} skip
 * @param {number} limit
 * @param {string|null} uploadStatus
 * @returns {Promise<object[]>}
 */
export async function getUploadHistory(skip = 0, limit = 20, uploadStatus = null) {
  const params = { skip, limit };
  if (uploadStatus) params.status = uploadStatus;
  const { data } = await axiosClient.get("/api/v1/upload/history", { params });
  return data;
}

/**
 * Get full detail for a single upload.
 * @param {string} uploadId
 * @returns {Promise<object>}
 */
export async function getUploadDetail(uploadId) {
  const { data } = await axiosClient.get(`/api/v1/upload/${uploadId}`);
  return data;
}

/**
 * src/api/authApi.js
 * Auth-related API calls wrapping the axiosClient.
 */

import axiosClient from "./axiosClient";

/**
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ access_token: string, token_type: string, user: object }>}
 */
export const login = (credentials) =>
  axiosClient.post("/api/v1/auth/login", credentials).then((r) => r.data);

/**
 * @returns {Promise<object>} Current user profile
 */
export const getMe = () =>
  axiosClient.get("/api/v1/auth/me").then((r) => r.data);

/**
 * @param {object} payload
 * @returns {Promise<object>} Created user
 */
export const register = (payload) =>
  axiosClient.post("/api/v1/auth/register", payload).then((r) => r.data);

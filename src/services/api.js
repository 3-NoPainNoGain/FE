import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_BASE || import.meta?.env?.VITE_API_BASE || "https://handdoc.store";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

"use client";

// NEXT_PUBLIC_API_URL is replaced by Next.js at build time as a literal string.
// Declare it so TypeScript knows about it without needing @types/node.
declare const process: { env: { NEXT_PUBLIC_API_URL?: string } };

const DEFAULT_API_BASE: string = (() => {
  try {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      return envUrl.replace(/\/api\/v1\/?$/, "");
    }
  } catch (_) {}
  return "http://localhost:8000";
})();

export const getApiUrl = (path: string): string => {
  if (typeof window === "undefined") {
    return `${DEFAULT_API_BASE}${path}`;
  }
  const savedEndpoint = localStorage.getItem("platform_api_endpoint");
  const base = savedEndpoint ? savedEndpoint.trim() : DEFAULT_API_BASE;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}${path}`;
};

export const getAuthHeaders = (): HeadersInit => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = token ? { "Authorization": `Bearer ${token}` } : {};
  
  // Custom API key overrides from localStorage
  const groqKey = localStorage.getItem("user_groq_api_key");
  if (groqKey) {
    headers["X-Groq-Api-Key"] = groqKey.trim();
  }
  
  const groqModel = localStorage.getItem("user_groq_model");
  if (groqModel) {
    headers["X-Groq-Model"] = groqModel.trim();
  }
  
  const hfKey = localStorage.getItem("user_huggingface_key");
  if (hfKey) {
    headers["X-HuggingFace-Api-Key"] = hfKey.trim();
  }
  
  return headers;
};

import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await storage.secureGet("gcaan_token", "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) || `خطأ ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(p: string, body?: any) =>
    request<T>(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
};

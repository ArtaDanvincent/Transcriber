const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  private async handleResponse(response: Response, retry?: () => Promise<Response>): Promise<unknown> {
    if (response.status === 401 && retry) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
      }
      const retryResponse = await retry();
      return this.handleResponse(retryResponse);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  async get(path: string) {
    const doFetch = () => fetch(`${API_URL}${path}`, { headers: this.getHeaders() });
    const response = await doFetch();
    return this.handleResponse(response, doFetch);
  }

  async post(path: string, body?: unknown) {
    const doFetch = () => fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const response = await doFetch();
    return this.handleResponse(response, doFetch);
  }

  async patch(path: string, body: unknown) {
    const doFetch = () => fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    const response = await doFetch();
    return this.handleResponse(response, doFetch);
  }

  async put(path: string, body: unknown) {
    const doFetch = () => fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    const response = await doFetch();
    return this.handleResponse(response, doFetch);
  }

  async delete(path: string) {
    const doFetch = () => fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    const response = await doFetch();
    return this.handleResponse(response, doFetch);
  }

  async upload(path: string, formData: FormData) {
    const doFetch = () => {
      const headers: Record<string, string> = {};
      const token = this.getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`${API_URL}${path}`, {
        method: "POST",
        headers,
        body: formData,
      });
    };
    const response = await doFetch();
    return this.handleResponse(response, doFetch);
  }

  getMediaUrl(jobId: string): string {
    return `${API_URL}/api/jobs/${jobId}/media`;
  }

  getDownloadUrl(exportId: string): string {
    return `${API_URL}/api/exports/${exportId}/download`;
  }
}

export const api = new ApiClient();

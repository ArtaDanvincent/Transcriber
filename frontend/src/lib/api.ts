const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private getHeaders(): Record<string, string> {
    return { "Content-Type": "application/json" };
  }

  private async handleResponse(response: Response): Promise<unknown> {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async get(path: string) {
    const response = await fetch(`${API_URL}${path}`, { headers: this.getHeaders() });
    return this.handleResponse(response);
  }

  async post(path: string, body?: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse(response);
  }

  async patch(path: string, body: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async put(path: string, body: unknown) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async delete(path: string) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async upload(path: string, formData: FormData) {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      body: formData,
    });
    return this.handleResponse(response);
  }

  getMediaUrl(jobId: string): string {
    return `${API_URL}/api/jobs/${jobId}/media`;
  }

  getDownloadUrl(exportId: string): string {
    return `${API_URL}/api/exports/${exportId}/download`;
  }
}

export const api = new ApiClient();

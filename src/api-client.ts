import type { ApiClientConfig, ApiResponse } from './types.js'

export class ApiClient {
  private baseUrl: string
  private apiKey: string

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
      }
    }
    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      },
    })
    try {
      return await res.json()
    } catch {
      return { error: { code: 'PARSE_ERROR', message: `HTTP ${res.status}: ${res.statusText}` } }
    }
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    try {
      return await res.json()
    } catch {
      return { error: { code: 'PARSE_ERROR', message: `HTTP ${res.status}: ${res.statusText}` } }
    }
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    try {
      return await res.json()
    } catch {
      return { error: { code: 'PARSE_ERROR', message: `HTTP ${res.status}: ${res.statusText}` } }
    }
  }
}

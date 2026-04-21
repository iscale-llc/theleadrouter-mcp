/**
 * Auth adapters bridge MCP tool handlers to different auth mechanisms.
 * - SessionAuthAdapter: forwards session cookie (for in-app agent chat)
 * - ApiKeyAuthAdapter: Bearer token (for external MCP consumers)
 */

export interface AuthAdapter {
  fetch(path: string, opts?: {
    method?: string
    body?: unknown
    params?: Record<string, string>
  }): Promise<unknown>
}

export class SessionAuthAdapter implements AuthAdapter {
  constructor(
    private cookie: string,
    private baseUrl: string = process.env.ROUTING_API_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4005')
  ) {}

  async fetch(path: string, opts?: { method?: string; body?: unknown; params?: Record<string, string> }): Promise<unknown> {
    const url = new URL(path, this.baseUrl)
    if (opts?.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        url.searchParams.set(key, value)
      }
    }

    const res = await globalThis.fetch(url.toString(), {
      method: opts?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.cookie,
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const apiErr = (err as any).error
      return {
        error: true,
        code: apiErr?.code || 'UNKNOWN',
        message: apiErr?.message || `Failed (${res.status})`,
        details: apiErr?.details || undefined,
        status: res.status,
      }
    }

    // Handle 204 No Content (common for DELETE)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return { success: true }
    }

    return res.json()
  }
}

export class ApiKeyAuthAdapter implements AuthAdapter {
  constructor(
    private apiKey: string,
    private baseUrl: string
  ) {}

  async fetch(path: string, opts?: { method?: string; body?: unknown; params?: Record<string, string> }): Promise<unknown> {
    const url = new URL(path, this.baseUrl)
    if (opts?.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        url.searchParams.set(key, value)
      }
    }

    const res = await globalThis.fetch(url.toString(), {
      method: opts?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const apiErr = (err as any).error
      return {
        error: true,
        code: apiErr?.code || 'UNKNOWN',
        message: apiErr?.message || `Failed (${res.status})`,
        details: apiErr?.details || undefined,
        status: res.status,
      }
    }

    // Handle 204 No Content (common for DELETE)
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return { success: true }
    }

    return res.json()
  }
}

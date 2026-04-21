export type ApiClientConfig = {
  baseUrl: string
  apiKey: string
}

export type ApiResponse<T = unknown> = {
  data?: T
  pagination?: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

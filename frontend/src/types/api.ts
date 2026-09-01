export interface ErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface ErrorEnvelope {
  error?: string;
  message?: string;
  details?: ErrorDetail[];
  retry_after_seconds?: number;
}

export interface PageMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface HomeResponse {
  message: string;
}

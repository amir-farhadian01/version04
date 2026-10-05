export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; response?: { data?: { error?: unknown; message?: unknown } } };
    const apiMessage = candidate.response?.data?.error ?? candidate.response?.data?.message ?? candidate.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
  }
  return fallback;
}

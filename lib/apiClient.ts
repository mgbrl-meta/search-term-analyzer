import type {
  AnalyzeResponse,
  TermsResponse,
  TermsQuery,
  NgramsResponse,
  Recommendation,
  HealthResponse,
} from '@/types/api';

const BASE = '/api';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = data?.error || data?.message || JSON.stringify(data);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(
      `Request failed (${res.status}${res.statusText ? ' ' + res.statusText : ''})${
        detail ? ': ' + detail : ''
      }`
    );
  }
  return res.json() as Promise<T>;
}

export async function analyzeFile(file: File): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    body: form,
  });
  return handle<AnalyzeResponse>(res);
}

export async function getTerms(query: TermsQuery): Promise<TermsResponse> {
  const params = new URLSearchParams();
  params.set('session_id', query.session_id);
  if (query.page != null) params.set('page', String(query.page));
  if (query.per_page != null) params.set('per_page', String(query.per_page));
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.tier) params.set('tier', query.tier);
  if (query.intent) params.set('intent', query.intent);
  if (query.category) params.set('category', query.category);
  if (query.q) params.set('q', query.q);

  const res = await fetch(`${BASE}/terms?${params.toString()}`);
  return handle<TermsResponse>(res);
}

export async function getNgrams(
  sessionId: string,
  n: 1 | 2 | 3
): Promise<NgramsResponse> {
  const res = await fetch(
    `${BASE}/ngrams?session_id=${encodeURIComponent(sessionId)}&n=${n}`
  );
  return handle<NgramsResponse>(res);
}

export async function getRecommendations(
  sessionId: string
): Promise<Recommendation[]> {
  const res = await fetch(
    `${BASE}/recommendations?session_id=${encodeURIComponent(sessionId)}`
  );
  return handle<Recommendation[]>(res);
}

export function exportCsvUrl(sessionId: string): string {
  return `${BASE}/export/csv?session_id=${encodeURIComponent(sessionId)}`;
}

export function exportXlsxUrl(sessionId: string): string {
  return `${BASE}/export/xlsx?session_id=${encodeURIComponent(sessionId)}`;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`);
  return handle<HealthResponse>(res);
}

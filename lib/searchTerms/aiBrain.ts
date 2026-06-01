import type { AiBrainResponse } from "./types";

export const AI_BRAIN_STORAGE_KEY = "search_term_os_manual_ai_brain";

export function saveAiBrain(response: AiBrainResponse) {
  localStorage.setItem(AI_BRAIN_STORAGE_KEY, JSON.stringify(response));
  window.dispatchEvent(new Event("search-term-os-ai-brain-updated"));
}

export function loadAiBrain(): AiBrainResponse | null {
  try {
    const raw = localStorage.getItem(AI_BRAIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiBrainResponse;
  } catch {
    return null;
  }
}

export function clearAiBrain() {
  localStorage.removeItem(AI_BRAIN_STORAGE_KEY);
  window.dispatchEvent(new Event("search-term-os-ai-brain-updated"));
}

export function parseAiBrainResponse(raw: string): AiBrainResponse {
  const cleaned = raw
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response must be a JSON object.");
  }

  if (!parsed.detected_theme || typeof parsed.detected_theme !== "string") {
    throw new Error("AI response missing detected_theme.");
  }

  if (!Array.isArray(parsed.categories)) {
    throw new Error("AI response missing categories array.");
  }

  return parsed as AiBrainResponse;
}

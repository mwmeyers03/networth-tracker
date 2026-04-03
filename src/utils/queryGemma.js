/**
 * queryGemma - shared helper for local Ollama/Gemma inference.
 *
 * Environment variables (set in .env, prefixed with REACT_APP_ for CRA):
 *   REACT_APP_OLLAMA_BASE_URL - Ollama generate endpoint
 *   REACT_APP_MODEL_CPU       - lighter model for fast tasks
 *   REACT_APP_MODEL_GPU       - heavier model for deeper strategy tasks
 *   REACT_APP_SYSTEM_PROMPT   - system instruction prepended to every request
 *   REACT_APP_LLM_MODE        - local | cloud | auto (default: auto)
 *   REACT_APP_CLOUD_LLM_URL   - optional cloud proxy endpoint for web fallback
 */

const OLLAMA_BASE_URL =
  process.env.REACT_APP_OLLAMA_BASE_URL ||
  'http://localhost:11434/api/generate';
const OLLAMA_HEALTH_URL = OLLAMA_BASE_URL.replace('/api/generate', '/api/tags');

const MODEL_CPU = process.env.REACT_APP_MODEL_CPU || 'gemma4:4b';
const MODEL_GPU = process.env.REACT_APP_MODEL_GPU || 'gemma4:26b-moe';
const SYSTEM_PROMPT =
  process.env.REACT_APP_SYSTEM_PROMPT ||
  'Never store sensitive data. Respond only with valid JSON not markdown fences.';

const LLM_MODE = (process.env.REACT_APP_LLM_MODE || 'auto').toLowerCase();
const CLOUD_LLM_URL = process.env.REACT_APP_CLOUD_LLM_URL || '';

/** true when running inside the Electron desktop shell */
export const isElectron =
  typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const DEFAULT_TIMEOUT_MS = 15000;
const MODEL_CACHE_TTL_MS = 60000;

let modelCache = {
  expiresAt: 0,
  models: [],
};

const stripMarkdownFences = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
};

const tryParseJson = (value) => {
  try {
    return { ok: true, data: JSON.parse(value) };
  } catch {
    return { ok: false, data: null };
  }
};

const extractJsonCandidate = (raw) => {
  const cleaned = stripMarkdownFences(raw);

  const direct = tryParseJson(cleaned);
  if (direct.ok) return direct.data;

  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart !== -1 && objectEnd > objectStart) {
    const objectParse = tryParseJson(cleaned.slice(objectStart, objectEnd + 1));
    if (objectParse.ok) return objectParse.data;
  }

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    const arrayParse = tryParseJson(cleaned.slice(arrayStart, arrayEnd + 1));
    if (arrayParse.ok) return arrayParse.data;
  }

  throw new Error('Model response was not valid JSON.');
};

const extractResponseText = (payload) => {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.response === 'string') return payload.response;
  if (typeof payload.output === 'string') return payload.output;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.message?.content === 'string') return payload.message.content;
  if (typeof payload.data?.response === 'string') return payload.data.response;
  return JSON.stringify(payload);
};

const resolveEndpoints = (mode) => {
  if (mode === 'local') {
    return [{ name: 'local', url: OLLAMA_BASE_URL }];
  }
  if (mode === 'cloud') {
    return CLOUD_LLM_URL ? [{ name: 'cloud', url: CLOUD_LLM_URL }] : [];
  }

  const endpoints = [{ name: 'local', url: OLLAMA_BASE_URL }];
  if (CLOUD_LLM_URL) endpoints.push({ name: 'cloud', url: CLOUD_LLM_URL });
  return endpoints;
};

const parseBillionSize = (model) => {
  const direct = String(model?.details?.parameter_size || '').match(/([0-9]+(?:\.[0-9]+)?)B/i);
  if (direct) return Number(direct[1]);

  const fromName = String(model?.name || '').match(/([0-9]+(?:\.[0-9]+)?)b/i);
  if (fromName) return Number(fromName[1]);

  return Number.POSITIVE_INFINITY;
};

const fetchLocalModelCatalog = async (timeoutMs) => {
  const now = Date.now();
  if (modelCache.expiresAt > now && modelCache.models.length > 0) {
    return modelCache.models;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OLLAMA_HEALTH_URL, { signal: controller.signal });
    if (!res.ok) return [];
    const payload = await res.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];
    modelCache = {
      expiresAt: now + MODEL_CACHE_TTL_MS,
      models,
    };
    return models;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
};

const resolveLocalModel = async (requestedModel, timeoutMs) => {
  const models = await fetchLocalModelCatalog(timeoutMs);
  if (!models.length) return { model: requestedModel, note: '' };

  const names = models.map((m) => m.name);
  if (names.includes(requestedModel)) {
    return { model: requestedModel, note: '' };
  }

  const gemmaModels = models.filter((m) => String(m.name).toLowerCase().includes('gemma'));
  const candidates = gemmaModels.length > 0 ? gemmaModels : models;

  const sorted = [...candidates].sort((a, b) => parseBillionSize(a) - parseBillionSize(b));
  const fallback =
    requestedModel === MODEL_GPU
      ? sorted[sorted.length - 1]
      : sorted[0];

  return {
    model: fallback?.name || requestedModel,
    note: fallback?.name
      ? `Requested model "${requestedModel}" not found. Using "${fallback.name}".`
      : '',
  };
};

const postRequest = async (url, payload, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * @template T
 * @typedef {Object} AIResponse
 * @property {boolean} success
 * @property {T=} data
 * @property {string=} error
 * @property {string} model
 * @property {string=} resolvedModel
 * @property {number} latencyMs
 * @property {'local'|'cloud'|null} endpoint
 * @property {string=} warning
 * @property {string=} raw
 */

/**
 * Send a prompt to a configured LLM endpoint and parse JSON safely.
 * Never throws. All failures are returned in AIResponse.error.
 *
 * @template T
 * @param {string} prompt
 * @param {string} [model]
 * @param {{ expectJson?: boolean, timeoutMs?: number, mode?: 'local'|'cloud'|'auto' }} [options]
 * @returns {Promise<AIResponse<T>>}
 */
export async function queryGemma(prompt, model = MODEL_CPU, options = {}) {
  const expectJson = options.expectJson ?? true;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const mode = (options.mode || LLM_MODE || 'auto').toLowerCase();

  if (!prompt || !String(prompt).trim()) {
    return {
      success: false,
      error: 'Prompt cannot be empty.',
      model,
      latencyMs: 0,
      endpoint: null,
    };
  }

  const endpoints = resolveEndpoints(mode);
  if (!endpoints.length) {
    return {
      success: false,
      error: 'No LLM endpoint configured. Set REACT_APP_OLLAMA_BASE_URL or REACT_APP_CLOUD_LLM_URL.',
      model,
      latencyMs: 0,
      endpoint: null,
    };
  }

  const errors = [];
  const startedAt = performance.now();

  for (const endpoint of endpoints) {
    try {
      let resolvedModel = model;
      let warning = '';

      if (endpoint.name === 'local') {
        const resolved = await resolveLocalModel(model, timeoutMs);
        resolvedModel = resolved.model;
        warning = resolved.note;
      }

      const requestPayload = {
        model: resolvedModel,
        prompt,
        system: SYSTEM_PROMPT,
        stream: false,
        format: expectJson ? 'json' : undefined,
      };

      const payload = await postRequest(endpoint.url, requestPayload, timeoutMs);
      const raw = extractResponseText(payload).trim();
      const data = expectJson ? extractJsonCandidate(raw) : raw;

      return {
        success: true,
        data,
        model,
        resolvedModel,
        latencyMs: Math.round(performance.now() - startedAt),
        endpoint: endpoint.name,
        warning,
        raw,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${endpoint.name}: ${message}`);
    }
  }

  return {
    success: false,
    error: errors.join(' | '),
    model,
    latencyMs: Math.round(performance.now() - startedAt),
    endpoint: null,
  };
}

/**
 * @param {string} csvData
 * @param {string} [model]
 * @param {{ timeoutMs?: number, mode?: 'local'|'cloud'|'auto' }} [options]
 */
export function categorizeTransactions(csvData, model = MODEL_CPU, options = {}) {
  const prompt = [
    'Categorize the following bank CSV rows into normalized transactions.',
    'Return only valid JSON as an array of objects with keys:',
    'vendor (string), category (string), amount (number).',
    '',
    'CSV:',
    csvData,
  ].join('\n');

  return queryGemma(prompt, model, { ...options, expectJson: true });
}

/**
 * @param {object} assets
 * @param {object} goals
 * @param {string} [model]
 * @param {{ timeoutMs?: number, mode?: 'local'|'cloud'|'auto' }} [options]
 */
export function getRetirementProjection(assets, goals, model = MODEL_GPU, options = {}) {
  const prompt = [
    'Create a structured retirement projection in valid JSON only.',
    'Include milestones, estimated peak net worth, risks, and target zero-balance age.',
    'Use concise fields and numeric values where applicable.',
    '',
    `Assets: ${JSON.stringify(assets)}`,
    `Goals: ${JSON.stringify(goals)}`,
  ].join('\n');

  return queryGemma(prompt, model, { ...options, expectJson: true });
}

export {
  MODEL_CPU,
  MODEL_GPU,
  SYSTEM_PROMPT,
  OLLAMA_BASE_URL,
  LLM_MODE,
  CLOUD_LLM_URL,
};

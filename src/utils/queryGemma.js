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

const MODEL_CPU = process.env.REACT_APP_MODEL_CPU || 'gemma4:e4b-it-q4_K_M';
const MODEL_GPU = process.env.REACT_APP_MODEL_GPU || 'gemma4:26b-a4b-it-q4_K_M';
const SYSTEM_PROMPT =
  process.env.REACT_APP_SYSTEM_PROMPT ||
  'Never store sensitive data. Respond only with valid JSON not markdown fences.';

const LLM_MODE = (process.env.REACT_APP_LLM_MODE || 'auto').toLowerCase();
const CLOUD_LLM_URL = process.env.REACT_APP_CLOUD_LLM_URL || '';
const FREE_WEB_LLM_URL =
  process.env.REACT_APP_FREE_WEB_LLM_URL ||
  'https://text.pollinations.ai/openai';
const FREE_WEB_LLM_MODEL = process.env.REACT_APP_FREE_WEB_LLM_MODEL || 'openai';
const ENABLE_FREE_WEB_LLM =
  String(process.env.REACT_APP_ENABLE_FREE_WEB_LLM ?? 'true').toLowerCase() !== 'false';
const OLLAMA_KEEP_ALIVE = process.env.REACT_APP_OLLAMA_KEEP_ALIVE || '30m';
const OLLAMA_TEMPERATURE = Number(process.env.REACT_APP_OLLAMA_TEMPERATURE || 0.15);
const OLLAMA_NUM_CTX = Number(process.env.REACT_APP_OLLAMA_NUM_CTX || 2048);
const OLLAMA_NUM_PREDICT = Number(process.env.REACT_APP_OLLAMA_NUM_PREDICT || 850);

/** true when running inside the Electron desktop shell */
export const isElectron =
  typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const DEFAULT_TIMEOUT_MS = 45000;
const MAX_TIMEOUT_MS = 180000;
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
  if (Array.isArray(payload.choices) && payload.choices.length > 0) {
    const first = payload.choices[0] || {};
    if (typeof first?.message?.content === 'string') return first.message.content;
    if (typeof first?.text === 'string') return first.text;
  }
  if (typeof payload.response === 'string') return payload.response;
  if (typeof payload.output === 'string') return payload.output;
  if (typeof payload.text === 'string') return payload.text;
  if (typeof payload.message?.content === 'string') return payload.message.content;
  if (typeof payload.data?.response === 'string') return payload.data.response;
  return JSON.stringify(payload);
};

const toMsFromNs = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.round(value / 1_000_000);
};

const extractOllamaMetrics = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const promptTokens = Number.isFinite(payload.prompt_eval_count)
    ? payload.prompt_eval_count
    : null;
  const generatedTokens = Number.isFinite(payload.eval_count)
    ? payload.eval_count
    : null;
  const promptMs = toMsFromNs(payload.prompt_eval_duration);
  const generationMs = toMsFromNs(payload.eval_duration);
  const loadMs = toMsFromNs(payload.load_duration);
  const totalMs = toMsFromNs(payload.total_duration);
  const tokensPerSecond =
    generatedTokens && generationMs && generationMs > 0
      ? Math.round((generatedTokens / generationMs) * 1000)
      : null;

  if (
    promptTokens === null &&
    generatedTokens === null &&
    promptMs === null &&
    generationMs === null &&
    loadMs === null &&
    totalMs === null
  ) {
    return null;
  }

  return {
    promptTokens,
    generatedTokens,
    promptMs,
    generationMs,
    loadMs,
    totalMs,
    tokensPerSecond,
  };
};

const extractCloudMetrics = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  if (payload.usage && typeof payload.usage === 'object') {
    const promptTokens = Number.isFinite(payload.usage.prompt_tokens)
      ? payload.usage.prompt_tokens
      : null;
    const generatedTokens = Number.isFinite(payload.usage.completion_tokens)
      ? payload.usage.completion_tokens
      : null;

    if (promptTokens !== null || generatedTokens !== null) {
      return {
        promptTokens,
        generatedTokens,
        promptMs: null,
        generationMs: null,
        loadMs: null,
        totalMs: null,
        tokensPerSecond: null,
      };
    }
  }

  return null;
};

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];

  return images
    .map((entry) => {
      if (typeof entry !== 'string') return '';
      const trimmed = entry.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('data:image/')) {
        const idx = trimmed.indexOf(',');
        return idx !== -1 ? trimmed.slice(idx + 1) : '';
      }
      return trimmed;
    })
    .filter(Boolean);
};

const looksLikeImageUnsupportedError = (message) =>
  /(image|vision|multimodal|does not support)/i.test(String(message || ''));

const isWebRuntime = () =>
  typeof window !== 'undefined' && !isElectron;

const resolveEndpoints = (mode, { mixedContentRisk = false } = {}) => {
  const freeWeb =
    isWebRuntime() && ENABLE_FREE_WEB_LLM && FREE_WEB_LLM_URL
      ? [{ name: 'free-web', url: FREE_WEB_LLM_URL }]
      : [];

  if (mode === 'local') {
    return mixedContentRisk ? [] : [{ name: 'local', url: OLLAMA_BASE_URL }];
  }

  if (mode === 'cloud') {
    if (CLOUD_LLM_URL) return [{ name: 'cloud', url: CLOUD_LLM_URL }];
    return freeWeb;
  }

  const endpoints = [];
  if (!mixedContentRisk) endpoints.push({ name: 'local', url: OLLAMA_BASE_URL });
  if (CLOUD_LLM_URL) endpoints.push({ name: 'cloud', url: CLOUD_LLM_URL });
  endpoints.push(...freeWeb);
  return endpoints;
};

const buildTextFallbackData = (raw) => {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraph = lines.join(' ');
  const details = lines.length > 0
    ? lines.slice(0, 18)
    : paragraph
      ? [paragraph]
      : [];

  return {
    answer: {
      directAnswer: paragraph || 'No model content returned.',
      executiveSummary: paragraph ? paragraph.slice(0, 420) : '',
      deepAnalysis: details,
      scenarioResults: [],
      assumptions: [],
      risks: [],
      recommendations: [],
      nextActions: [],
      warnings: [],
      followUps: [],
    },
    edits: {},
  };
};

const uniqueStrings = (arr) => [...new Set(arr.filter(Boolean))];

const getTierFallbackModels = (tier) => {
  if (tier === 'gpu') {
    return [
      MODEL_GPU,
      'gemma4:26b-a4b-it-q4_K_M',
      'gemma4:26b-moe',
      'gemma4:e4b-it-q4_K_M',
      'gemma4:4b',
      'gemma4:e2b',
    ];
  }

  return [
    MODEL_CPU,
    'gemma4:e4b-it-q4_K_M',
    'gemma4:4b',
    'gemma4:e2b',
  ];
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

const resolveLocalModelsToTry = async (requestedModel, timeoutMs, tier = 'cpu') => {
  const models = await fetchLocalModelCatalog(timeoutMs);
  if (!models.length) {
    return { models: [requestedModel], note: '' };
  }

  const names = models.map((m) => m.name);

  const preferredByName = uniqueStrings([
    requestedModel,
    ...getTierFallbackModels(tier),
  ]).filter((candidate) => names.includes(candidate));

  if (preferredByName.length > 0) {
    const note = preferredByName[0] === requestedModel
      ? ''
      : `Requested model "${requestedModel}" not found. Using "${preferredByName[0]}".`;
    return { models: preferredByName.slice(0, 4), note };
  }

  const gemmaModels = models.filter((m) => String(m.name).toLowerCase().includes('gemma'));
  const candidates = gemmaModels.length > 0 ? gemmaModels : models;

  const sorted = [...candidates].sort((a, b) => parseBillionSize(a) - parseBillionSize(b));
  const order = tier === 'gpu' ? [...sorted].reverse() : sorted;
  const fallbackModels = order.map((m) => m.name).slice(0, 4);

  if (fallbackModels.length === 0) {
    return { models: [requestedModel], note: '' };
  }

  return {
    models: fallbackModels,
    note: fallbackModels[0]
      ? `Requested model "${requestedModel}" not found. Using "${fallbackModels[0]}".`
      : '',
  };
};

const postRequest = async (url, payload, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs} ms`);
      }
      throw error;
    }

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
 * @property {'local'|'cloud'|'free-web'|null} endpoint
 * @property {string=} warning
 * @property {{promptTokens?: number|null, generatedTokens?: number|null, promptMs?: number|null, generationMs?: number|null, loadMs?: number|null, totalMs?: number|null, tokensPerSecond?: number|null}=} metrics
 * @property {string=} raw
 */

const isBrowserMixedContentRisk = () => {
  if (typeof window === 'undefined') return false;
  if (isElectron) return false;
  if (window.location.protocol !== 'https:') return false;
  return /^http:\/\//i.test(OLLAMA_BASE_URL);
};

/**
 * Send a prompt to a configured LLM endpoint and parse JSON safely.
 * Never throws. All failures are returned in AIResponse.error.
 *
 * @template T
 * @param {string} prompt
 * @param {string} [model]
 * @param {{ expectJson?: boolean, timeoutMs?: number, mode?: 'local'|'cloud'|'auto', tier?: 'cpu'|'gpu', images?: string[], generationOptions?: Record<string, number> }} [options]
 * @returns {Promise<AIResponse<T>>}
 */
export async function queryGemma(prompt, model = MODEL_CPU, options = {}) {
  const expectJson = options.expectJson ?? true;
  const timeoutMs = Math.max(10000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const mode = (options.mode || LLM_MODE || 'auto').toLowerCase();
  const tier = options.tier || (model === MODEL_GPU ? 'gpu' : 'cpu');

  if (!prompt || !String(prompt).trim()) {
    return {
      success: false,
      error: 'Prompt cannot be empty.',
      model,
      latencyMs: 0,
      endpoint: null,
    };
  }

  const mixedContentRisk = isBrowserMixedContentRisk();

  if (mode === 'local' && mixedContentRisk) {
    return {
      success: false,
      error:
        'Web app is running on HTTPS while Ollama URL is HTTP localhost. Browser mixed-content security blocks local mode. Switch to auto/cloud mode, desktop EXE, or configure REACT_APP_CLOUD_LLM_URL.',
      model,
      latencyMs: 0,
      endpoint: null,
    };
  }

  const endpoints = resolveEndpoints(mode, { mixedContentRisk });
  if (!endpoints.length) {
    return {
      success: false,
      error:
        'No LLM endpoint configured. Set REACT_APP_CLOUD_LLM_URL, run desktop EXE for local Ollama, or enable REACT_APP_ENABLE_FREE_WEB_LLM.',
      model,
      latencyMs: 0,
      endpoint: null,
    };
  }

  const imagePayloads = normalizeImages(options.images);
  const generationOverrides =
    options.generationOptions && typeof options.generationOptions === 'object'
      ? options.generationOptions
      : {};

  const errors = [];
  const startedAt = performance.now();

  for (const endpoint of endpoints) {
    try {
      let warning = '';
      let modelCandidates = [model];

      if (endpoint.name === 'local') {
        const resolved = await resolveLocalModelsToTry(model, Math.min(timeoutMs, 8000), tier);
        modelCandidates = resolved.models;
        warning = resolved.note;
      } else if (endpoint.name === 'free-web') {
        modelCandidates = [FREE_WEB_LLM_MODEL];
        warning = 'Using free HTTPS web fallback provider.';
      }

      for (let i = 0; i < modelCandidates.length; i += 1) {
        const resolvedModel = modelCandidates[i];
        const attemptTimeout = Math.min(
          timeoutMs + i * (tier === 'gpu' ? 30000 : 12000),
          MAX_TIMEOUT_MS
        );

        try {
          const {
            reasoning_effort: reasoningEffortOverride,
            max_tokens: maxTokensOverride,
            ...ollamaGenerationOverrides
          } = generationOverrides;

          const baseRequestPayload = endpoint.name === 'free-web'
            ? {
                model: resolvedModel,
                messages: [
                  { role: 'system', content: SYSTEM_PROMPT },
                  {
                    role: 'user',
                    content: imagePayloads.length
                      ? [
                          { type: 'text', text: prompt },
                          ...imagePayloads.map((imageBase64) => ({
                            type: 'image_url',
                            image_url: { url: `data:image/png;base64,${imageBase64}` },
                          })),
                        ]
                      : prompt,
                  },
                ],
                stream: false,
                temperature:
                  Number.isFinite(generationOverrides.temperature)
                    ? generationOverrides.temperature
                    : OLLAMA_TEMPERATURE,
                max_tokens:
                  Number.isFinite(maxTokensOverride)
                    ? maxTokensOverride
                    : Number.isFinite(generationOverrides.num_predict)
                      ? generationOverrides.num_predict
                      : OLLAMA_NUM_PREDICT,
                response_format: expectJson ? { type: 'json_object' } : undefined,
                reasoning_effort: reasoningEffortOverride,
              }
            : {
                model: resolvedModel,
                prompt,
                system: SYSTEM_PROMPT,
                stream: false,
                format: expectJson ? 'json' : undefined,
                keep_alive: OLLAMA_KEEP_ALIVE,
                options: {
                  temperature: OLLAMA_TEMPERATURE,
                  num_ctx: OLLAMA_NUM_CTX,
                  num_predict: OLLAMA_NUM_PREDICT,
                  ...ollamaGenerationOverrides,
                },
              };

          const requestPayload = imagePayloads.length
            ? endpoint.name === 'free-web'
              ? baseRequestPayload
              : { ...baseRequestPayload, images: imagePayloads }
            : baseRequestPayload;

          let payload;
          try {
            payload = await postRequest(endpoint.url, requestPayload, attemptTimeout);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (imagePayloads.length && looksLikeImageUnsupportedError(message)) {
              payload = await postRequest(endpoint.url, baseRequestPayload, attemptTimeout);
              warning = [
                warning,
                'Image input unsupported by this model; used text-only context.',
              ].filter(Boolean).join(' ');
            } else {
              throw error;
            }
          }

          const raw = extractResponseText(payload).trim();
          let data;
          if (expectJson) {
            try {
              data = extractJsonCandidate(raw);
            } catch {
              data = buildTextFallbackData(raw);
              warning = [
                warning,
                'Model returned non-JSON content; converted to text fallback structure.',
              ].filter(Boolean).join(' ');
            }
          } else {
            data = raw;
          }

          const metrics = endpoint.name === 'local'
            ? extractOllamaMetrics(payload)
            : extractCloudMetrics(payload);

          return {
            success: true,
            data,
            model,
            resolvedModel,
            latencyMs: Math.round(performance.now() - startedAt),
            endpoint: endpoint.name,
            warning,
            metrics,
            raw,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${endpoint.name}/${resolvedModel}: ${message}`);
        }
      }
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
  OLLAMA_HEALTH_URL,
  LLM_MODE,
  CLOUD_LLM_URL,
  FREE_WEB_LLM_URL,
  FREE_WEB_LLM_MODEL,
  ENABLE_FREE_WEB_LLM,
  OLLAMA_KEEP_ALIVE,
};

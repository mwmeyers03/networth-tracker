/**
 * queryGemma – shared helper for local Ollama/Gemma inference.
 *
 * Environment variables (set in .env, prefixed with REACT_APP_ for CRA):
 *   REACT_APP_OLLAMA_BASE_URL  – Ollama generate endpoint
 *                                (default: http://localhost:11434/api/generate)
 *   REACT_APP_MODEL_CPU        – lighter model (default: gemma4:4b)
 *   REACT_APP_MODEL_GPU        – heavier model (default: gemma4:26b-moe)
 *   REACT_APP_SYSTEM_PROMPT    – system instruction injected into every request
 */

const OLLAMA_BASE_URL =
  process.env.REACT_APP_OLLAMA_BASE_URL ||
  'http://localhost:11434/api/generate';

const MODEL_CPU =
  process.env.REACT_APP_MODEL_CPU || 'gemma4:4b';

const MODEL_GPU =
  process.env.REACT_APP_MODEL_GPU || 'gemma4:26b-moe';

const SYSTEM_PROMPT =
  process.env.REACT_APP_SYSTEM_PROMPT ||
  'Never store sensitive data. Respond only with valid JSON not markdown fences.';

/**
 * Send a prompt to the local Ollama instance and return the model's response.
 *
 * @param {string} prompt  – the user prompt to send
 * @param {string} [model] – model tag to use; defaults to MODEL_CPU
 * @returns {Promise<string>} the raw text returned by the model
 * @throws {Error} when the request fails or the server returns a non-OK status
 */
export async function queryGemma(prompt, model = MODEL_CPU) {
  const body = JSON.stringify({
    model,
    prompt,
    system: SYSTEM_PROMPT,
    stream: false,
  });

  const response = await fetch(OLLAMA_BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(
      `Ollama request failed [${response.status}]: ${errorText}`
    );
  }

  const data = await response.json();
  return data.response ?? '';
}

export { MODEL_CPU, MODEL_GPU, SYSTEM_PROMPT, OLLAMA_BASE_URL };

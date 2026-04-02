/**
 * Gemma AI Financial Co-Pilot Service
 *
 * SERVER-SIDE ONLY — placed in src/lib/server/ so SvelteKit's module
 * isolation rules prevent any client-side bundle from importing it.
 * Local financial data never leaves the server process.
 *
 * Requires a running Ollama instance: https://ollama.com
 *   ollama pull gemma4:4b          # CPU-optimised — fast categorisation
 *   ollama pull gemma4:26b-moe     # GPU-optimised — deep strategy analysis
 */

// ──────────────────────────────────────────────
// CONFIGURATION
// ──────────────────────────────────────────────

/** Ollama local inference endpoint */
const OLLAMA_BASE_URL = 'http://localhost:11434/api/generate';

/**
 * Lightweight 4-billion-parameter model.
 * Used for CPU-bound tasks like transaction categorisation.
 */
const MODEL_CPU = 'gemma4:4b';

/**
 * 26-billion-parameter mixture-of-experts model.
 * Offloaded to RTX 3080 for GPU-bound strategy analysis.
 */
const MODEL_GPU = 'gemma4:26b-moe';

/**
 * System-level instruction prepended to every request.
 * Enforces JSON-only output and forbids data retention.
 */
const SYSTEM_PROMPT =
  'You are a private financial co-pilot running entirely on-device. ' +
  'You must NEVER store, log, or repeat any personal financial data beyond this single response. ' +
  'You MUST return ONLY valid, minified JSON with no markdown fences, no prose, and no trailing commas. ' +
  'If you cannot comply, return {"error":"Unable to process request"}.';

// ──────────────────────────────────────────────
// INTERFACES
// ──────────────────────────────────────────────

/**
 * Snapshot of a user's current financial position passed to the AI.
 * All monetary values are in USD.
 */
export interface FinancialContext {
  /** Current age of the primary account holder */
  age: number;
  /** US state of residence (affects tax modelling) */
  state: string;
  /** Schwab taxable brokerage balance */
  brokerageBalance: number;
  /** Traditional 401(k) balance */
  traditional401kBalance: number;
  /** Roth IRA / Roth 401(k) balance */
  rothBalance: number;
  /** High-yield savings / emergency fund balance */
  savingsBalance: number;
  /** Any additional account balances keyed by a human-readable label */
  otherAccounts?: Record<string, number>;
}

/**
 * A single bank transaction after AI categorisation.
 */
export interface Transaction {
  /** Original vendor string from the bank statement (e.g. "Starling Honda") */
  vendor: string;
  /**
   * Normalised spending category returned by the model.
   * Examples: "Auto", "Food & Dining", "Entertainment", "Income"
   */
  category: string;
  /**
   * Transaction amount in USD.
   * Positive = credit/income, Negative = debit/expense.
   */
  amount: number;
}

/**
 * Wrapper for every response returned by queryGemma().
 * The generic parameter T is the parsed JSON payload type.
 */
export interface AIResponse<T = unknown> {
  /** Whether Ollama returned a usable response */
  success: boolean;
  /** Parsed JSON payload — present only when success is true */
  data?: T;
  /** Human-readable error description — present only when success is false */
  error?: string;
  /** The model variant that produced this response */
  model: string;
  /** Wall-clock latency in milliseconds */
  latencyMs: number;
}

// ──────────────────────────────────────────────
// CORE QUERY FUNCTION
// ──────────────────────────────────────────────

/**
 * Sends a prompt to the local Ollama inference server and returns
 * the parsed JSON payload wrapped in an {@link AIResponse}.
 *
 * @param prompt    The user / task prompt to send to the model.
 * @param model     Ollama model tag to use (defaults to {@link MODEL_CPU}).
 * @returns         A resolved {@link AIResponse} — never throws.
 */
export async function queryGemma<T = unknown>(
  prompt: string,
  model: string = MODEL_CPU
): Promise<AIResponse<T>> {
  const start = Date.now();

  const fullPrompt = `${SYSTEM_PROMPT}\n\n${prompt}`;

  let raw: string;
  try {
    const response = await fetch(OLLAMA_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.1,   // Low temperature for deterministic JSON output
          top_p: 0.9
        }
      })
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Ollama HTTP ${response.status}: ${response.statusText}`,
        model,
        latencyMs: Date.now() - start
      };
    }

    const json = (await response.json()) as { response?: string };
    raw = (json.response ?? '').trim();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown fetch error',
      model,
      latencyMs: Date.now() - start
    };
  }

  // Strip optional markdown code fences the model may still emit
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const data = JSON.parse(cleaned) as T;
    return { success: true, data, model, latencyMs: Date.now() - start };
  } catch {
    return {
      success: false,
      error: `Model returned non-JSON output: ${cleaned.slice(0, 200)}`,
      model,
      latencyMs: Date.now() - start
    };
  }
}

// ──────────────────────────────────────────────
// FINANCIAL LOGIC FUNCTIONS
// ──────────────────────────────────────────────

/**
 * Categorises raw bank transaction strings using the 4B (CPU) model.
 *
 * @param csvData   Raw CSV text from a bank export.
 *                  Each non-header row should contain at minimum a vendor
 *                  description and an amount column.
 * @returns         An {@link AIResponse} whose `data` is an array of
 *                  {@link Transaction} objects when successful.
 *
 * @example
 * ```ts
 * const result = await categorizeTransactions(
 *   'vendor,amount\nStarling Honda,-350\nDominos,-18.99\nNorthrop Grumman,4200'
 * );
 * if (result.success) console.log(result.data);
 * // [
 * //   { vendor: "Starling Honda", category: "Auto", amount: -350 },
 * //   { vendor: "Dominos",        category: "Food & Dining", amount: -18.99 },
 * //   { vendor: "Northrop Grumman", category: "Income", amount: 4200 }
 * // ]
 * ```
 */
export async function categorizeTransactions(
  csvData: string
): Promise<AIResponse<Transaction[]>> {
  const prompt =
    'Categorise each row in the following bank CSV into a JSON array. ' +
    'Each element must conform exactly to: { "vendor": string, "category": string, "amount": number }. ' +
    'Use standard personal-finance categories such as "Auto", "Food & Dining", "Entertainment", ' +
    '"Utilities", "Housing", "Healthcare", "Income", "Savings", "Insurance", or "Other". ' +
    'Positive amounts are credits/income; negative amounts are debits/expenses. ' +
    'Return ONLY the JSON array.\n\n' +
    `CSV DATA:\n${csvData}`;

  return queryGemma<Transaction[]>(prompt, MODEL_CPU);
}

/**
 * Generates a "Die With Zero" retirement projection using the 26B (GPU) model.
 *
 * Tailored for a 22-year-old Florida resident with Schwab / 401(k) accounts.
 * The model is instructed to produce a structured JSON summary covering
 * projected retirement age, peak net worth year, optimal drawdown schedule,
 * and legacy / zero-balance target.
 *
 * @param assets   Current account balances (keys mirror {@link FinancialContext}).
 * @param goals    Retirement goals and constraints (e.g. target retirement age,
 *                 annual spending in retirement, legacy amount).
 * @returns        An {@link AIResponse} whose `data` is a free-form object
 *                 containing the projection summary when successful.
 *
 * @example
 * ```ts
 * const result = await getRetirementProjection(
 *   { age: 22, state: 'FL', brokerageBalance: 5000, traditional401kBalance: 8000,
 *     rothBalance: 3000, savingsBalance: 12000 },
 *   { targetRetirementAge: 50, annualSpending: 60000, legacyTarget: 0 }
 * );
 * if (result.success) console.log(result.data);
 * ```
 */
export async function getRetirementProjection(
  assets: FinancialContext,
  goals: Record<string, unknown>
): Promise<AIResponse<Record<string, unknown>>> {
  const prompt =
    'You are analysing the retirement outlook for a 22-year-old living in Florida (no state income tax). ' +
    'Apply the "Die With Zero" philosophy: optimise life experiences over legacy wealth accumulation. ' +
    'Account for Roth IRA / 401(k) tax advantages, Florida residency (0% state income tax), ' +
    'and standard US federal tax brackets. ' +
    'Return a JSON object with these exact keys:\n' +
    '  "projectedRetirementAge": number,\n' +
    '  "peakNetWorthYear": number,\n' +
    '  "peakNetWorthAmount": number,\n' +
    '  "recommendedAnnualWithdrawal": number,\n' +
    '  "zeroBalanceTargetAge": number,\n' +
    '  "keyMilestones": [{ "age": number, "event": string, "netWorth": number }],\n' +
    '  "summary": string\n\n' +
    `CURRENT ASSETS (USD):\n${JSON.stringify(assets, null, 2)}\n\n` +
    `RETIREMENT GOALS:\n${JSON.stringify(goals, null, 2)}`;

  return queryGemma<Record<string, unknown>>(prompt, MODEL_GPU);
}

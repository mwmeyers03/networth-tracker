const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  delete process.env.REACT_APP_CLOUD_LLM_URL;
  global.fetch = jest.fn();
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

test.each([undefined, '', 'false', '0', 'typo'])('external fallback is disabled for %s and sends no financial prompt', async value => {
  if (value === undefined) delete process.env.REACT_APP_ENABLE_FREE_WEB_LLM;
  else process.env.REACT_APP_ENABLE_FREE_WEB_LLM = value;
  const { ENABLE_FREE_WEB_LLM, queryGemma } = require('./queryGemma');
  expect(ENABLE_FREE_WEB_LLM).toBe(false);
  const response = await queryGemma('Analyze a private financial scenario', undefined, { mode: 'cloud' });
  expect(response.success).toBe(false);
  expect(response.error).toMatch(/No LLM endpoint configured/);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('external fallback requires an explicit true configuration', () => {
  process.env.REACT_APP_ENABLE_FREE_WEB_LLM = ' true ';
  const { ENABLE_FREE_WEB_LLM } = require('./queryGemma');
  expect(ENABLE_FREE_WEB_LLM).toBe(true);
  expect(global.fetch).not.toHaveBeenCalled();
});

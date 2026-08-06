import { puzzleJsonSchema } from './puzzleContract.js';

const OPENAI_URL = 'https://api.openai.com/v1/responses';

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output || []) {
    if (item.type !== 'message') continue;
    for (const content of item.content || []) if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
  }
  return null;
}

export class OpenAIPuzzleService {
  constructor({ apiKey, model, fetchImpl = fetch } = {}) {
    this.apiKey = apiKey; this.model = model; this.fetchImpl = fetchImpl;
  }

  async generate(prompt, { userId, requestId } = {}) {
    const apiKey = this.apiKey || process.env.OPENAI_API_KEY;
    const model = this.model || process.env.OPENAI_MODEL || 'gpt-5.6-terra';
    if (!apiKey) throw Object.assign(new Error('OpenAI is not configured'), { code: 'OPENAI_NOT_CONFIGURED', status: 503 });
    const response = await this.fetchImpl(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
      body: JSON.stringify({
        model,
        input: prompt,
        reasoning: { effort: 'medium' },
        safety_identifier: userId,
        text: { format: { type: 'json_schema', name: 'parsons_puzzle', strict: true, schema: puzzleJsonSchema } }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error?.message || 'OpenAI request failed'), { code: 'OPENAI_REQUEST_FAILED', status: response.status >= 500 ? 503 : 502 });
    const outputText = extractOutputText(payload);
    if (!outputText) throw Object.assign(new Error('OpenAI returned no structured output'), { code: 'OPENAI_EMPTY_RESPONSE', status: 502 });
    try { return { candidate: JSON.parse(outputText), responseId: payload.id, model: payload.model || model, usage: payload.usage }; }
    catch { throw Object.assign(new Error('OpenAI returned invalid JSON'), { code: 'OPENAI_INVALID_JSON', status: 502 }); }
  }
}

export default new OpenAIPuzzleService();

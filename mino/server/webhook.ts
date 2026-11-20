import { GoogleGenAI } from '@google/genai';
import { db, Message, WebhookMeta } from './db';

let genAI: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!genAI && process.env.GEMINI_API_KEY) {
    try {
      genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (e) {
      console.warn('[Gemini] Could not initialize GoogleGenAI client:', e);
    }
  }
  return genAI;
}

export interface WebhookDispatchResult {
  text: string;
  meta: WebhookMeta;
}

/**
 * Robustly generates a conversational AI response using Gemini
 * with multi-turn history support and sequential model fallbacks.
 */
export async function generateConversationalAIResponse(
  userPrompt: string,
  history: Message[] = [],
  systemInstruction?: string
): Promise<string> {
  const client = getGeminiClient();
  if (!client) {
    return `Hello! I received your message: "${userPrompt}". I am your AI assistant, but the server GEMINI_API_KEY is not configured yet.`;
  }

  // Format history for Gemini SDK (user -> 'user', assistant -> 'model')
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Filter recent conversation turns
  const recentHistory = history.slice(-8);
  for (const m of recentHistory) {
    if (m.role === 'user' && m.content.trim()) {
      contents.push({ role: 'user', parts: [{ text: m.content.trim() }] });
    } else if (m.role === 'assistant' && m.content.trim()) {
      // Exclude technical error notices from conversation context
      if (!m.content.startsWith('⚠️') && !m.content.startsWith('❌') && !m.content.includes('Activepieces Webhook Triggered Successfully')) {
        contents.push({ role: 'model', parts: [{ text: m.content.trim() }] });
      }
    }
  }

  // Ensure current user message is at the end of the context
  const lastItem = contents[contents.length - 1];
  if (!lastItem || lastItem.role !== 'user' || lastItem.parts[0]?.text !== userPrompt.trim()) {
    contents.push({ role: 'user', parts: [{ text: userPrompt.trim() }] });
  }

  // Fallback chain across supported Gemini models
  const models = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const result = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction:
            systemInstruction ||
            'You are an intelligent, friendly, and articulate AI assistant. Provide helpful, thorough, and well-structured responses in markdown with code snippets or bullet points when appropriate.',
        },
      });

      const text = result.text?.trim();
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Model ${model} generation attempt failed:`, err?.message?.slice(0, 100));
    }
  }

  console.error('[Gemini] All models encountered errors:', lastError);
  return `I received your message: "${userPrompt}". I am your AI assistant, but all AI models are momentarily experiencing high traffic. Please try asking again in a moment!`;
}

/**
 * Check if the payload returned by Activepieces contains a substantive AI answer
 */
function extractSubstantiveAnswer(rawJson: any, responseText: string): string | null {
  if (rawJson && typeof rawJson === 'object') {
    // Check known response keys from Activepieces pieces (e.g. OpenAI / Claude / Custom response)
    const candidates = [
      rawJson.reply,
      rawJson.response,
      rawJson.message,
      rawJson.answer,
      rawJson.text,
      rawJson.output,
      rawJson.result,
      rawJson.content,
      rawJson.data,
      rawJson.choices?.[0]?.message?.content,
      rawJson.choices?.[0]?.text,
    ];

    for (const cand of candidates) {
      if (typeof cand === 'string' && cand.trim().length > 0) {
        return cand.trim();
      }
    }

    // Check if it's an object with keys other than empty or simple status acknowledgment
    const keys = Object.keys(rawJson);
    if (keys.length > 0) {
      const isSimpleAck = keys.every((k) =>
        ['status', 'success', 'ok', 'ping', 'received', 'acknowledged'].includes(k.toLowerCase())
      );
      if (!isSimpleAck) {
        return '```json\n' + JSON.stringify(rawJson, null, 2) + '\n```';
      }
    }
    return null;
  }

  if (typeof responseText === 'string' && responseText.trim().length > 0) {
    const trimmed = responseText.trim();
    if (trimmed !== '{}' && trimmed !== '[]' && trimmed.toLowerCase() !== 'ok') {
      return trimmed;
    }
  }

  return null;
}

/**
 * Dispatch message to Activepieces webhook with latency tracking,
 * automatic fallback from production to /test URL if 404,
 * and guaranteed conversational AI response generation.
 */
export async function dispatchToActivepieces(
  userMessage: string,
  conversationId: string,
  history: Message[] = []
): Promise<WebhookDispatchResult> {
  const settings = db.getSettings();
  let targetUrl = settings.url.trim();

  // Prepare standard history window (last 6 messages)
  const historyPayload = history.slice(-6).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const payload = {
    message: userMessage,
    prompt: userMessage,
    text: userMessage,
    query: userMessage,
    conversationId,
    timestamp: new Date().toISOString(),
    history: historyPayload,
  };

  const startTime = Date.now();
  let responseText = '';
  let statusCode = 0;
  let rawJson: any = null;
  let urlUsed = targetUrl;
  let usedTestFallback = false;
  let errorMsg: string | undefined = undefined;

  try {
    let response: Response;

    // Attempt 1: Call configured URL
    try {
      response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
          ...(settings.customHeaders || {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000), // 20s timeout
      });
      statusCode = response.status;
    } catch (fetchErr: any) {
      errorMsg = fetchErr?.message || 'Connection failed';
      statusCode = 504;
      response = new Response(JSON.stringify({ error: errorMsg }), { status: 504 });
    }

    // Attempt 2: If 404 and fallbackToTestUrl is enabled, try /test suffix
    if (statusCode === 404 && settings.fallbackToTestUrl && !targetUrl.endsWith('/test')) {
      const testUrl = `${targetUrl.replace(/\/+$/, '')}/test`;
      try {
        console.log(`[Webhook] Primary URL returned 404. Trying Activepieces /test endpoint: ${testUrl}`);
        const testRes = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });
        if (testRes.ok || testRes.status === 200) {
          response = testRes;
          statusCode = testRes.status;
          urlUsed = testUrl;
          usedTestFallback = true;
          errorMsg = undefined;
        }
      } catch (testErr) {
        console.warn('[Webhook] Fallback to /test failed:', testErr);
      }
    }

    const latencyMs = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';

    // Read response body
    if (contentType.includes('application/json')) {
      try {
        rawJson = await response.json();
      } catch {
        responseText = await response.text();
      }
    } else {
      responseText = await response.text();
    }

    // Update settings with last status & test timestamp
    db.updateSettings({
      lastTestedAt: new Date().toISOString(),
      lastStatus: statusCode,
    });

    // Check if the Activepieces flow returned a substantive answer directly
    const flowAnswer = extractSubstantiveAnswer(rawJson, responseText);
    if (flowAnswer && settings.aiMode !== 'hybrid') {
      return {
        text: flowAnswer,
        meta: {
          latencyMs,
          statusCode,
          urlCalled: urlUsed,
          isTestMode: usedTestFallback,
          rawResponse: rawJson || responseText,
          source: 'activepieces',
        },
      };
    }

    // Otherwise, generate a full conversational AI response for the user
    // while recording the webhook dispatch metrics
    console.log(`[Webhook] Dispatched to Activepieces (status ${statusCode} in ${latencyMs}ms). Generating AI answer...`);
    const aiResponse = await generateConversationalAIResponse(
      userMessage,
      history,
      settings.systemPrompt
    );

    return {
      text: aiResponse,
      meta: {
        latencyMs,
        statusCode,
        urlCalled: urlUsed,
        isTestMode: usedTestFallback,
        rawResponse: rawJson || responseText || {},
        source: flowAnswer ? 'activepieces' : 'gemini-hybrid',
        error: statusCode >= 400 ? errorMsg || `HTTP ${statusCode}` : undefined,
      },
    };
  } catch (outerErr: any) {
    const latencyMs = Date.now() - startTime;
    console.error('[Webhook] Network error contacting webhook, generating AI response anyway:', outerErr);

    // Even if the webhook connection fails, still give the user their AI response!
    const aiResponse = await generateConversationalAIResponse(
      userMessage,
      history,
      settings.systemPrompt
    );

    return {
      text: aiResponse,
      meta: {
        latencyMs,
        statusCode: 500,
        urlCalled: targetUrl,
        error: outerErr?.message || 'Network error',
        source: 'gemini-hybrid',
      },
    };
  }
}

/**
 * Ping test to verify webhook status
 */
export async function testWebhookConnection(urlToTest?: string): Promise<{
  success: boolean;
  statusCode: number;
  latencyMs: number;
  urlCalled: string;
  response: any;
  message: string;
}> {
  const settings = db.getSettings();
  const url = (urlToTest || settings.url).trim();
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true, test: true, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Date.now() - start;
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }

    return {
      success: res.ok || res.status === 200,
      statusCode: res.status,
      latencyMs,
      urlCalled: url,
      response: data,
      message:
        res.status === 200
          ? 'Webhook endpoint connected and responding (HTTP 200 OK).'
          : res.status === 404
          ? 'Endpoint returned 404. In Activepieces, publish the flow or use the /test URL.'
          : `Endpoint responded with status ${res.status}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 0,
      latencyMs: Date.now() - start,
      urlCalled: url,
      response: null,
      message: err?.message || 'Connection timed out or failed.',
    };
  }
}

import type { ChatGptSessionInfo, ChatGptSessionResponse } from './types';

const SESSION_URL = 'https://chatgpt.com/api/auth/session';

export async function fetchChatGptSession(): Promise<ChatGptSessionResponse> {
  let response: Response;
  try {
    response = await fetch(SESSION_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
  } catch (error) {
    return fail(`Failed to request the ChatGPT session: ${String(error)}`);
  }

  const text = await response.text();
  const data = parseJson(text);
  if (!response.ok) {
    return fail(`ChatGPT session HTTP ${response.status}：${shorten(text || response.statusText)}`);
  }

  if (!isRecord(data)) {
    return fail('The ChatGPT session response is not a JSON object');
  }

  const session = extractSessionInfo(data);
  if (!session.accessToken) {
    return {
      ok: false,
      message: session.email ? 'Account info was loaded, but the session has no accessToken' : 'No login session was found',
      session,
    };
  }

  return {
    ok: true,
    message: 'ChatGPT session loaded',
    session,
  };
}

function extractSessionInfo(data: Record<string, unknown>): ChatGptSessionInfo {
  const user = isRecord(data.user) ? data.user : {};
  const account = isRecord(data.account) ? data.account : {};
  return {
    email: stringValue(user.email),
    planType: stringValue(account.planType) || stringValue(account.plan_type),
    accessToken: stringValue(data.accessToken),
    fetchedAt: Date.now(),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function fail(message: string): ChatGptSessionResponse {
  return { ok: false, message };
}

function shorten(text: string, limit = 400): string {
  return String(text || '').replace(/\s+/g, ' ').slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

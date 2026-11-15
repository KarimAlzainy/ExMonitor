import type { ChatRoleMessage } from './aiModels';

/**
 * Talks to an Ollama server running on the same machine. This lets the console
 * use a model that is already downloaded, with no 2 GB browser download and no
 * graphics-memory requirement.
 */

export interface OllamaConfig {
  url: string;
  model: string;
}

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'phi3:3.8b-mini-4k-instruct-q8_0';

const URL_KEY = 'exmonitor.ollama.url';
const MODEL_KEY = 'exmonitor.ollama.model';

function cleanUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed || DEFAULT_OLLAMA_URL;
}

export function readOllamaConfig(): OllamaConfig {
  try {
    const storedUrl = window.localStorage.getItem(URL_KEY);
    const storedModel = window.localStorage.getItem(MODEL_KEY);
    return {
      url: cleanUrl(storedUrl ?? DEFAULT_OLLAMA_URL),
      model: (storedModel ?? DEFAULT_OLLAMA_MODEL).trim() || DEFAULT_OLLAMA_MODEL
    };
  } catch {
    return { url: DEFAULT_OLLAMA_URL, model: DEFAULT_OLLAMA_MODEL };
  }
}

export function storeOllamaConfig(config: OllamaConfig): void {
  try {
    window.localStorage.setItem(URL_KEY, cleanUrl(config.url));
    window.localStorage.setItem(MODEL_KEY, config.model.trim() || DEFAULT_OLLAMA_MODEL);
  } catch {
    // Ignore.
  }
}

/** The advice shown when the browser blocks the request or the server is not up. */
export const OLLAMA_HELP =
  'Start Ollama on this computer, then allow this page: run Ollama with OLLAMA_ORIGINS set to the page address. ' +
  'For example, set OLLAMA_ORIGINS=* before starting Ollama. See the README for the exact command.';

function describeFailure(error: unknown, url: string): string {
  if (error instanceof TypeError) {
    return `Cannot reach the Ollama server at ${url}. ${OLLAMA_HELP}`;
  }
  if (error instanceof Error) return error.message;
  return `The Ollama request to ${url} failed.`;
}

export async function listOllamaModels(url: string): Promise<string[]> {
  const base = cleanUrl(url);
  let response: Response;
  try {
    response = await fetch(`${base}/api/tags`, { method: 'GET' });
  } catch (error) {
    throw new Error(describeFailure(error, base));
  }
  if (!response.ok) throw new Error(`The Ollama server at ${base} answered ${response.status}.`);
  const data = (await response.json()) as { models?: { name?: string }[] };
  return (data.models ?? [])
    .map((entry) => entry.name ?? '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Streams one answer from the local model. Ollama replies with one JSON object
 * per line, so the reply is read line by line and each token is handed on as it
 * arrives.
 */
export async function askOllama(
  config: OllamaConfig,
  messages: ChatRoleMessage[],
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const base = cleanUrl(config.url);
  const model = config.model.trim() || DEFAULT_OLLAMA_MODEL;

  let response: Response;
  try {
    response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature: 0.2 }
      }),
      signal
    });
  } catch (error) {
    throw new Error(describeFailure(error, base));
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Ollama answered ${response.status} for model "${model}". ${detail.slice(0, 160)}`.trim()
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let chunk: { message?: { content?: string }; error?: string };
      try {
        chunk = JSON.parse(trimmed) as typeof chunk;
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(chunk.error);
      const delta = chunk.message?.content ?? '';
      if (delta) {
        text += delta;
        onToken(delta);
      }
    }
  }

  return text;
}

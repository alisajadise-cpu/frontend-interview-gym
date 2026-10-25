export type SSEEvent = { event: string; data: string; id: string };

export type ByteSource = ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

function isReadableStream(source: ByteSource): source is ReadableStream<Uint8Array> {
  return typeof (source as ReadableStream<Uint8Array>).getReader === 'function';
}

/** Turns either kind of source into chunks, and cancels the stream if the consumer stops early. */
async function* chunksOf(source: ByteSource): AsyncGenerator<Uint8Array> {
  if (!isReadableStream(source)) {
    yield* source;
    return;
  }
  const reader = source.getReader();
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        return;
      }
      yield value;
    }
  } finally {
    // `break` in the consumer lands here: tell the server we don't need more bytes.
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Splits decoded text into lines, handling \n, \r\n and \r even when split across chunks. */
async function* linesOf(source: ByteSource): AsyncGenerator<string> {
  // ONE decoder with stream: true keeps partial multi-byte characters between chunks.
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let first = true;

  function* takeLines(final: boolean): Generator<string> {
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (ch !== '\n' && ch !== '\r') continue;
      if (ch === '\r') {
        // A lone \r at the end of the buffer might be the first half of \r\n.
        if (i === buffer.length - 1 && !final) break;
        yield buffer.slice(start, i);
        if (buffer[i + 1] === '\n') i++;
      } else {
        yield buffer.slice(start, i);
      }
      start = i + 1;
    }
    buffer = buffer.slice(start);
  }

  for await (const chunk of chunksOf(source)) {
    buffer += decoder.decode(chunk, { stream: true });
    if (first && buffer.length > 0) {
      if (buffer.charCodeAt(0) === 0xfeff) buffer = buffer.slice(1);
      first = false;
    }
    yield* takeLines(false);
  }
  buffer += decoder.decode(); // flush
  yield* takeLines(true);
  // Whatever is left has no line ending: it is an unfinished line and is dropped.
}

export async function* parseSSE(source: ByteSource): AsyncGenerator<SSEEvent> {
  let data = '';
  let eventType = '';
  let lastEventId = '';

  for await (const line of linesOf(source)) {
    if (line === '') {
      // Blank line: dispatch.
      if (data !== '') {
        yield { event: eventType || 'message', data: data.slice(0, -1), id: lastEventId };
      }
      data = '';
      eventType = '';
      continue;
    }
    if (line.startsWith(':')) continue; // comment / keep-alive

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        data += value + '\n';
        break;
      case 'event':
        eventType = value;
        break;
      case 'id':
        if (!value.includes('\0')) lastEventId = value;
        break;
      default:
        break; // retry and unknown fields are ignored here
    }
  }
  // End of stream: an event without a trailing blank line is discarded (per spec).
}

type ChatChunk = {
  choices?: { delta?: { content?: unknown; role?: string } }[];
  error?: { message?: string };
};

export async function* streamChatCompletion(source: ByteSource): AsyncGenerator<string> {
  for await (const { data } of parseSSE(source)) {
    if (data === '[DONE]') return; // returning also cancels the underlying stream

    let json: ChatChunk;
    try {
      json = JSON.parse(data);
    } catch (cause) {
      throw new Error(`Malformed JSON in stream event: ${data.slice(0, 80)}`, { cause });
    }
    if (json.error) throw new Error(json.error.message ?? 'Stream error');

    const content = json.choices?.[0]?.delta?.content;
    if (typeof content === 'string' && content.length > 0) yield content;
  }
}

export type SSEEvent = { event: string; data: string; id: string };

export type ByteSource = ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

export async function* parseSSE(source: ByteSource): AsyncGenerator<SSEEvent> {
  throw new Error('Not implemented: parseSSE');
}

export async function* streamChatCompletion(source: ByteSource): AsyncGenerator<string> {
  throw new Error('Not implemented: streamChatCompletion');
}

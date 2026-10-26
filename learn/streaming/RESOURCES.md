# Streaming in the browser — Resources

## Primary sources (specs)

- [WHATWG HTML — Server-sent events: parsing an event stream](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)
  The normative rules for line endings, BOM, comments, fields, dispatch, and end-of-stream. The `ai/01` requirements are a direct translation of this section.
- [WHATWG Encoding Standard](https://encoding.spec.whatwg.org/)
  Defines `TextDecoder`, the `stream` option, and how incomplete byte sequences become U+FFFD.
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)
  Defines `ReadableStream`, readers, cancel, and backpressure.

## Guides (high trust)

- [MDN — Using readable streams](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams)
  Best first read: `response.body`, `getReader()`, the `{ done, value }` loop, `for await`, cancel vs releaseLock.
- [MDN — TextDecoder.decode()](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode)
  The exact meaning of `{ stream: true }`.
- [MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
  Friendly walkthrough of the event stream format with examples.
- [javascript.info — Fetch: Download progress](https://javascript.info/fetch-progress)
  Reader loop explained step by step; confirms chunks are `Uint8Array`s and that a body can only be read once.

## Real-world code to study

- [`eventsource-parser`](https://github.com/rexxars/eventsource-parser) — small, spec-compliant SSE parser used by many AI SDKs.
- [`@microsoft/fetch-event-source`](https://github.com/Azure/fetch-event-source) — SSE over `fetch` (POST, headers, retries).

## Communities (wisdom)

- [r/Frontend](https://www.reddit.com/r/Frontend/) and [r/webdev](https://www.reddit.com/r/webdev/) — ask "how would you design X" questions, read interview experiences.
- [Reactiflux Discord](https://www.reactiflux.com/) — large, well-moderated; good for streaming-UI questions.

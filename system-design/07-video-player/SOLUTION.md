# 07 · Video Player — Solution

## 1. Requirements

### Functional
1. Play on-demand video with standard controls: play/pause, seek bar, volume, fullscreen, picture-in-picture, playback speed.
2. **Adaptive quality:** automatically pick the best quality the network allows, plus a manual quality menu.
3. **Seek preview:** thumbnails when hovering the seek bar.
4. **Captions/subtitles** in many languages, with style settings.
5. **Resume** playback position across devices.
6. **DRM** for premium content.
7. **Analytics:** views, watch time, quality and buffering stats.
8. **Embeddable** player (iframe) for other sites.

### Non-functional (these are the real goals)
- **Fast start:** time to first frame under ~1–2 s on a decent network.
- **Minimal rebuffering:** rebuffering ratio (stall time / watch time) under ~1%. Users hate stalls more than lower quality.
- **Best quality the network supports**, without oscillating up and down.
- Smooth on low-end devices: no dropped frames from JS work on the main thread.
- **Efficient data use:** don't download much more than will be watched.
- Accessible (keyboard, screen reader, captions), localized, RTL UI.

---

## 2. Background: why not `<video src="movie.mp4">`?

A single MP4 file has **one quality**. On a slow network it stalls. On a fast network a low-quality file wastes the screen. Seeking far ahead needs byte ranges and the server must support them. You can't switch quality mid-play.

**Adaptive bitrate streaming (HLS or MPEG-DASH)** solves this:
- The video is encoded at several qualities ("renditions"): e.g. 240p @ 400 kbps, 480p @ 1 Mbps, 720p @ 3 Mbps, 1080p @ 6 Mbps, 4K @ 16 Mbps.
- Each rendition is cut into small **segments** (2–6 seconds), usually fMP4 (CMAF) so HLS and DASH can share the same files.
- A **manifest** (HLS `.m3u8` playlist or DASH `.mpd`) lists renditions and segment URLs.
- The player downloads the manifest, then picks one segment at a time, choosing the quality for each segment. Segments are aligned at keyframes, so switching quality between segments is seamless.

**Media Source Extensions (MSE):** a browser API that lets JavaScript create a `MediaSource`, attach it to a `<video>` element, and append media bytes into `SourceBuffer`s (one for video, one for audio). The JS player decides what to download and when. Players like hls.js, dash.js, Shaka Player, and Video.js work this way. Safari on iPhone historically did not support MSE (newer iOS versions support **Managed Media Source**), but it plays HLS **natively** in `<video>`. So the player must also support native HLS as a fallback.

---

## 3. Architecture

```
┌──────────────────────────────────────── Browser ─────────────────────────────────────────┐
│                                                                                           │
│  ┌──────────────── Player UI (React or vanilla, lazy-loaded parts) ─────────────────────┐ │
│  │ Controls bar · Seek bar + thumbnail preview · Settings menu · Captions renderer      │ │
│  │ Big play button · Spinner · Error overlay · Keyboard shortcuts                        │ │
│  └────────────────────────────▲──────────────────────────┬──────────────────────────────┘ │
│                    state/events│                          │ commands (play, seek, setQuality)
│  ┌────────────────────────────┴──────────────────────────▼──────────────────────────────┐ │
│  │ Player core (framework-independent)                                                   │ │
│  │  state machine: idle → loading → ready → playing ⇄ paused ⇄ buffering → ended/error  │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────┐ ┌────────────┐ ┌─────────────┐  │ │
│  │  │ Manifest     │ │ ABR          │ │ Buffer        │ │ Text track │ │ DRM (EME)   │  │ │
│  │  │ parser       │ │ controller   │ │ controller    │ │ manager    │ │ manager     │  │ │
│  │  └──────┬───────┘ └──────▲───────┘ └──────┬────────┘ └─────┬──────┘ └──────┬──────┘  │ │
│  │         │      bandwidth │ estimates      │ append/remove  │ cues          │ licenses │ │
│  │  ┌──────▼────────────────┴────────────────▼────────────────▼───────────────▼───────┐ │ │
│  │  │ Segment loader (fetch with streams, retries, CDN failover, measures throughput) │ │ │
│  │  └─────────────────────────────────────────────────────────────────────────────────┘ │ │
│  │  Analytics collector (QoE events, batched, sendBeacon)                                │ │
│  └────────────────────────────▲─────────────────────────────────────────────────────────┘ │
│                               │ MediaSource / SourceBuffer (MSE)  or  native HLS (Safari) │
│                     ┌─────────┴─────────┐                                                 │
│                     │  <video> element  │ ← hardware decoding, rendering                   │
│                     └───────────────────┘                                                 │
└─────────────────────────────────┬────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼─────────────────────────────┬──────────────────────┐
         ▼                        ▼                             ▼                      ▼
   Playback API            CDN: manifests + segments      License server (DRM)   Analytics endpoint
   (metadata, resume,      (multi-CDN, edge cached)
    signed URLs)
```

**Key design decision:** the **player core is framework-independent** (plain TypeScript with an event emitter). The UI is a thin layer. This lets the same core run in the main site, the embed (where a small bundle matters), and maybe other frameworks. Heavy parts (settings menus, DRM, thumbnails) are lazy-loaded.

---

## 4. Data model

```ts
interface VideoMetadata {
  id: string;
  title: string;
  durationSec: number;
  posterUrl: string;                 // shown before playback; LCP of the watch page
  manifestUrls: { hls?: string; dash?: string };   // signed, expiring
  drm?: { widevine?: string; playready?: string; fairplay?: { licenseUrl: string; certificateUrl: string } };
  textTracks: Array<{ lang: string; label: string; url: string; kind: 'subtitles' | 'captions' }>;
  thumbnailsUrl: string;             // sprite sheets + VTT/JSON index
  resumePositionSec?: number;
}

interface Rendition {
  id: string;
  bandwidth: number;                 // bits per second (declared in manifest)
  width: number;
  height: number;
  codecs: string;                    // e.g. 'avc1.64001f' (H.264), 'av01...' (AV1), 'vp09...'
  segments: Segment[];
}

interface Segment {
  url: string;
  startSec: number;
  durationSec: number;
  byteRange?: { start: number; end: number };
}

type PlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'seeking' | 'ended' | 'error';

interface PlayerSnapshot {
  state: PlayerState;
  currentTime: number;
  bufferedAheadSec: number;
  currentRendition: Rendition['id'];
  autoQuality: boolean;
  estimatedBandwidth: number;        // bps
  volume: number;
  muted: boolean;
  playbackRate: number;
  activeTextTrack: string | null;
}
```

---

## 5. Interface (API)

```
GET /api/videos/:id/playback?device=web&drm=widevine
→ VideoMetadata          (manifest URLs are signed with a short expiry, e.g. 1–6 hours)

GET https://cdn.../v/:id/master.m3u8            HLS master playlist (lists renditions)
GET https://cdn.../v/:id/720p/index.m3u8        media playlist (lists segments)
GET https://cdn.../v/:id/720p/seg_00042.m4s     segment (Cache-Control: public, max-age=31536000, immutable)

POST /license/widevine   (binary license request from EME → license response)

PUT /api/videos/:id/progress   { positionSec: 1312, watchedAt }   // every ~10–30 s and on pause/exit
POST /api/qoe/events            batched analytics (see below), via sendBeacon on page hide
```

Segments are **immutable**, so CDNs and browsers can cache them forever. Manifests for on-demand content are also cacheable. For live, the media playlist is updated every segment and has a very short TTL.

---

## 6. Deep dives

### 6.1 Startup (time to first frame)

The startup path: page → metadata API → manifest → init segment → first media segment → decode → first frame.

Ways to make it faster:
- **Preconnect** to the CDN and license server domains (`<link rel="preconnect">`).
- **Embed the manifest URL (or the whole master manifest) in the page HTML** so one request disappears.
- Start with a **conservative-but-not-tiny rendition** (e.g. 480p) or one chosen from the last session's bandwidth estimate (stored in `localStorage`). Starting at the lowest quality looks bad. Starting at the highest stalls.
- Small first segments (or partial segments, CMAF chunks) for the start.
- Show the **poster image** immediately (it's the page's LCP), with correct size and `fetchpriority="high"`.
- **Prefetch** the first segment(s) on hover over a thumbnail or when the next episode is about to play.
- Autoplay rules: browsers only allow autoplay **muted** (or after user interaction). Handle the rejected `play()` promise and show a play button.

### 6.2 ABR (adaptive bitrate) algorithm

Goal: highest quality **without stalls**, and **few switches**.

**Throughput-based:** measure download speed of recent segments (bytes / time). Use a smoothed estimate (EWMA, exponentially weighted moving average, with fast and slow averages and take the **lower** one for safety). Pick the highest rendition with `bandwidth < estimate × safety factor (~0.8)`.
- Problem: measurements are noisy (small segments, TCP slow start, cached segments that arrive instantly).

**Buffer-based (e.g. BOLA, BBA):** decide from **how many seconds are buffered**. Little buffer → low quality. Lots of buffer → high quality.
- Stable and avoids stalls, but slow to ramp up at startup.

**Hybrid (used in practice):** throughput for startup and fast reactions, buffer level to stay stable once the buffer is healthy. Rules:
- **Switch down fast** (stall risk), **switch up slowly** (only after the estimate is stable for some segments, and only if the buffer is above a threshold).
- If the download of the current segment is taking too long (it will finish after the buffer runs out), **abort it** and fetch a lower quality instead (emergency down-switch).
- Cap quality by **player size**: don't download 4K into a 400 px wide player (use `width × devicePixelRatio`). Big data saving.
- Cap by **dropped frames**: if `video.getVideoPlaybackQuality().droppedVideoFrames` grows, the device can't decode this quality. Step down.
- Respect **Save-Data** and the user's data-saver setting.
- Check **codec support**: `MediaSource.isTypeSupported(...)` or `navigator.mediaCapabilities.decodingInfo()` (which also tells if decoding is "smooth" and "power efficient"). Prefer AV1/VP9 when hardware-decoded, H.264 otherwise.

### 6.3 Buffer management

- **Buffer goal:** keep ~30 s ahead for on-demand (tunable). Don't download the whole movie: it wastes data if the user leaves (most do not watch to the end).
- **Back buffer:** keep ~30 s behind for quick back-seeks, remove older data with `SourceBuffer.remove()`. Browsers have **SourceBuffer quota limits** (roughly 100–150 MB for video in Chrome). Appending beyond that throws `QuotaExceededError`, which must be handled by evicting.
- `SourceBuffer` operations are **async and one at a time** (`updating` flag, `updateend` event). The buffer controller keeps a queue of append/remove operations.
- **Gaps:** small gaps between segments can stall the video. Detect and jump over them (`currentTime += tiny amount`).
- **Seeking:** abort in-flight downloads for the old position, find the segment containing the target time, fetch it (maybe at lower quality for a fast resume), and keep already-buffered ranges if they cover the target (check `video.buffered`).
- When the tab is hidden: keep audio playing for music-like content, but you can pause video downloads above a lower buffer goal.

### 6.4 Seek preview thumbnails

- Generated on the server as **sprite sheets** (e.g. a 10×10 grid of small frames, one every N seconds) plus an index (WebVTT with `#xywh=` fragments, or JSON).
- Load the sprite sheet lazily on the first hover. Show the right tile with CSS `background-position`.
- On touch devices, show while dragging the scrubber.

### 6.5 Captions and subtitles

- Format: **WebVTT** (native `<track>` support) or TTML/IMSC in DASH.
- Options: native rendering with `<track>` (simple, accessible, but limited styling and positioning across browsers), or **custom rendering**: parse cues, show them in a positioned overlay `div` synchronized with `timeupdate`/`requestVideoFrameCallback`. Custom rendering allows consistent styling and user settings (size, color, background), as required by accessibility rules (e.g. FCC rules in the US for TV content).
- In fullscreen, the overlay must be inside the fullscreen element (call `requestFullscreen` on the player container, not on `<video>`), otherwise custom captions disappear.
- **RTL subtitles:** set `dir="rtl"`/`dir="auto"` on cue elements; Persian/Arabic fonts; correct bidi for mixed text.
- Remember the user's caption language and settings.

### 6.6 Player UI, accessibility and keyboard

- All controls are real `<button>`s with labels that change with state ("Play"/"Pause", "Mute"/"Unmute"). `aria-pressed` for toggles.
- The seek bar is a **slider**: `role="slider"`, `aria-valuemin/max/now`, and `aria-valuetext="12 minutes 30 seconds of 1 hour 40 minutes"`. Arrow keys seek 5 s, Page Up/Down 10%, Home/End.
- Standard shortcuts (YouTube-like): `Space`/`K` play/pause, `J`/`L` ±10 s, `←`/`→` ±5 s, `M` mute, `F` fullscreen, `C` captions. Only when the player has focus, and not when the user types in a text field.
- Announce state changes (e.g. "Captions on") via `aria-live`, not every time update.
- Controls auto-hide during playback, but stay visible while focused (keyboard users) and respect `prefers-reduced-motion`.
- Audio description tracks (alternate audio) for blind users on premium content.
- RTL: the player **UI** is mirrored (menus, text), but the **timeline goes left to right** in most players (video time direction is a convention; YouTube keeps it LTR). Volume slider too. State the decision.

### 6.7 DRM (overview)

- **EME (Encrypted Media Extensions)**: browser API that connects the `<video>` element to a **CDM** (Content Decryption Module) inside the browser/OS.
- Key systems: **Widevine** (Chrome, Firefox, Android), **PlayReady** (Edge/Windows), **FairPlay** (Safari). One encrypted file set (CENC/CBCS encryption in CMAF) can work with several systems.
- Flow: the player finds encryption info (`encrypted` event / manifest), calls `navigator.requestMediaKeySystemAccess`, creates a session, sends the license request to **our license server** (with the user's auth token), and gives the license back to the CDM. Decryption and often decoding happen inside the CDM, so JS never sees the decrypted frames.
- Higher security levels (hardware DRM) are required for HD/4K on some studios' content, so quality may be capped on some browsers.
- DRM is not perfect protection: also use watermarking and short-lived signed URLs.

### 6.8 Network resilience

- Retry segment downloads with backoff. On repeated failure, **switch CDN** (multi-CDN: the manifest or API gives a list of base URLs).
- Signed URLs expire: refresh the playback session before expiry for long movies.
- Offline/slow network: drop quality early. If the buffer is empty, show a spinner, and only after ~1 s (avoid flicker for tiny stalls).
- Errors that are fatal (unsupported codec, DRM failure): a clear message with an error code users can report.

### 6.9 Performance of the page

- The player script is **not** needed for the poster and page content: SSR the watch page (title, description, poster), then load the player JS. LCP is the poster.
- The embed (`<iframe>`) is used on third-party sites where performance is critical: a **facade** (just the poster + play button, very small HTML) that loads the full player only on click.
- Keep main-thread work small during playback: no React re-render on every `timeupdate` (fires ~4 times/s). Update the progress bar with direct DOM writes or a `requestAnimationFrame` loop, and re-render React only on state changes.
- Parse manifests and handle transmuxing (e.g. MPEG-TS → fMP4 for old HLS streams) in a **Web Worker**.

### 6.10 Analytics (QoE: quality of experience)

Events: `play_request`, `first_frame` (startup time), `rebuffer_start/end`, `quality_change` (from/to, reason), `seek`, `error` (code), `heartbeat` (every 30–60 s: watch time, current quality, bandwidth estimate, dropped frames), `end`.

Key metrics:
- **Video start time**, **video start failures**, **exit before video start** (people who gave up).
- **Rebuffering ratio** and **rebuffer count per hour**.
- **Average bitrate** and time at each quality.
- **Errors** by code, browser, CDN, and country.

Implementation: collect in memory, batch, send every 30 s and on `visibilitychange` → `hidden` with `navigator.sendBeacon` (survives page close). Never block playback for analytics. Sample very chatty events.

Resume position: save every ~15–30 s and on pause/exit (`sendBeacon`). On load, use the server value, or local if newer.

---

## 7. Trade-offs

| Topic | Options | Choice |
|---|---|---|
| Protocol | Progressive MP4 / HLS / DASH | **CMAF segments with both HLS and DASH manifests**: one set of files, native HLS on Apple, MSE elsewhere. |
| Player | Build own / Shaka / hls.js / Video.js | **Use a proven engine** (Shaka/hls.js) with our own UI and ABR tuning. Building MSE handling from scratch is huge. |
| ABR | Throughput / buffer / hybrid | **Hybrid**, fast down, slow up, capped by player size and dropped frames. |
| Buffer goal | Large (fewer stalls) / small (less waste, memory) | **~30 s ahead**, more on unstable networks. |
| Captions | Native `<track>` / custom overlay | **Custom overlay** for styling and consistency, with native fallback. |
| UI framework | React for everything / vanilla core | **Vanilla core + thin UI.** Small embed, no re-render per time update. |

---

## 8. Follow-up questions

**"How would you support live streaming?"**
The media playlist is refreshed every target duration. The player stays near the **live edge** with a small buffer (latency vs stall trade-off). Low-latency HLS / DASH with CMAF chunks (partial segments) brings latency to ~2–5 s. Handle "behind live" (show a "Go live" button) and DVR windows (seek back in a time window).

**"How do you insert ads?"**
Client-side (pause content, play an ad with a separate player, e.g. using IMA SDK with VAST/VMAP) or server-side ad insertion (ads stitched into the stream, harder to block, needs discontinuity handling in the manifest).

**"The rebuffering ratio went up last week in one country. How do you investigate?"**
Slice QoE data by CDN, ISP, browser, player version, and rendition. Check if a release changed ABR settings, or a CDN had issues in that region. Compare segment download times per CDN. Mitigate with CDN switching rules.

**"How do you make 'next episode' start instantly?"**
Near the end of the current episode, fetch the next episode's metadata, manifest, and first segments at a low priority (and, for DRM, the license). Optionally use a second `MediaSource`.

**"Why not just use the native `<video>` with an HLS URL everywhere?"**
Only Safari (and some mobile browsers) play HLS natively. Chrome/Firefox on desktop need MSE. Native playback also gives you little control over ABR, buffering, and analytics.

---

## 9. What separates a senior answer from a mid-level one

- **Mid-level:** a `<video>` tag with custom controls and maybe "we'll use HLS".
- **Senior:**
  - Explains **renditions, segments, manifests, MSE/SourceBuffer**, and native HLS fallback.
  - Designs an **ABR strategy** (hybrid, fast down/slow up, cap by player size and dropped frames, emergency down-switch).
  - Talks about **buffer goals, back-buffer eviction, quota errors, seeking**.
  - Optimizes **startup** concretely (preconnect, manifest in HTML, initial rendition from history, poster LCP).
  - Knows **autoplay policies** and **fullscreen on the container** for custom captions.
  - **QoE metrics** (start time, rebuffering ratio, exit before start) and how they're collected (`sendBeacon`).
  - DRM via **EME/CDM** at the right level of detail.
  - Keeps the main thread free: **no React re-render on `timeupdate`**, workers for parsing.

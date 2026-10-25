# 07 · Design a Video Player (YouTube / Netflix Web)

**Difficulty:** Very hard · **Time:** 45–60 min

## The prompt (as the interviewer says it)

> "Design the web video player for a streaming service like YouTube or Netflix. Videos should start fast, play without buffering on slow networks, look as good as the network allows, and support captions. We also need playback analytics."

## Clarifying questions to ask (and the assumed answers)

| Question | Assumed answer |
|---|---|
| On-demand or live streaming? | On-demand first. Live is a follow-up. |
| Video length? | From 1 minute to 3 hours. |
| Paid content that needs DRM? | Some content (movies) needs DRM. User videos don't. |
| Devices? | Desktop and mobile browsers. Smart TVs are out of scope. |
| Features? | Play/pause, seek with thumbnail previews, quality selection (auto + manual), speed, captions/subtitles, fullscreen, picture-in-picture, keyboard shortcuts. |
| Ads? | Out of scope (mention where they'd fit). |
| Resume where you left off? | Yes, across devices. |
| Embeddable on other sites? | Yes (iframe embed). |
| Languages? | Subtitles in many languages including RTL (Persian, Arabic). Player UI localized. |

## What the interviewer is looking for

- Why a plain `<video src="movie.mp4">` is not enough: **adaptive streaming (HLS/DASH)**, segments, manifests.
- **Media Source Extensions (MSE)** and how a JS player feeds segments to the video element.
- An **ABR (adaptive bitrate) algorithm**: throughput-based, buffer-based, hybrid.
- **Buffering strategy**: buffer goals, startup, seeking, memory limits.
- Fast **startup** (time to first frame) and the metrics that matter (rebuffering ratio).
- **Captions** (WebVTT), accessibility of the controls.
- **DRM** overview (EME, Widevine/FairPlay/PlayReady).
- **Analytics** without hurting playback.

## Suggested time split

- Requirements: 5–7 min
- Architecture (streaming formats, MSE, player modules): 12 min
- Data model + API (manifest, segments, playback events): 8 min
- Deep dive (ABR, buffering, startup, seeking): 15 min
- Captions, a11y, DRM, analytics: 8 min
- Wrap-up: 3 min

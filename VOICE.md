# Hotel voice entry — 1.7.0

Open **New Entry** and tap the microphone. Tap it again to stop; recording also
stops after 60 seconds. Whisper transcribes locally and automatically fills hotel
name, city, country, notes and rating. Review the normal form and tap **Save entry**.

Example: “Aman Tokyo in Tokyo, Japan. Rating four point seven five out of five.
Notes: quiet rooms and excellent breakfast.”

You can also choose **Speak or type a hotel entry**, type or edit the transcript,
and tap **Fill fields**. **Undo fill** reverses the last fill while retaining manual
changes. Existing nonempty fields are preserved; clear a field before filling it
again to replace a manual value. New recordings replace the transcript, not the
saved entry. One hotel per recording.

## Recognition

- Supports labeled fields in any order, “Hotel X in City, Country”, and comma
  separated hotel/city/country entries, followed by notes.
- Accepts numeric ratings, “four point seven five”, “four point seventy five”,
  “four and a half”, and “4.75 out of 5”. Contextual “for” becomes 4 only within
  rating expressions. Hotel names such as Four Seasons remain unchanged.
- Ratings use the existing 0–5 scale and two decimals. Scores outside that range
  are flagged rather than clamped; a five-star hotel description is not a rating.
- Uses common destination names and your existing local journal to identify
  locations. Exact existing hotel names can supply missing city/country when
  unambiguous. This is local parsing, not a worldwide hotel directory or an LLM.
  For unfamiliar or ambiguous places, say “City: … Country: …” or edit the fields.
- “To try” keeps its existing behavior: switch to Stayed before applying a rating.
- Missing fields stay blank. Speech recognition and location guesses can be wrong;
  the transcript and every resulting field remain editable before Save.

## Privacy and compatibility

This reuses the Lifting app's Transformers.js 3.8.1 and quantized Whisper tiny.en
worker, pinned to model revision `79fb389fc764e7c395bd330e9531d9d32ada7049`.
Transformers.js is vendored with its Apache-2.0 license. Model and WASM files download
from Hugging Face and jsDelivr when first used. These hosts receive normal download
metadata, but no audio or transcript. No API key, cloud transcription, telemetry,
or automatic OS dictation fallback is added.

Audio stays in memory and is discarded after processing or cancellation. The raw
transcript is not persisted, exported, or synced. Saving uses the app's existing
hotel storage and optional Gist sync for the completed hotel fields. Closing the
entry or leaving the foreground cancels pending recording/processing and prevents
late results from changing another draft.

Use HTTPS in Safari or the Home Screen web app and grant microphone permission.
The model can take time to download/process; **Prepare Whisper** loads it in advance.
Model files use browser caching, which iOS may evict. This change does not add an
offline app shell. Typed parsing works without downloading the speech model.

## Verification

Run `node tests/voice-parser.test.cjs` and `node tests/voice-privacy.test.cjs`.
With Playwright available, run `node tests/voice-ui.test.cjs`; optionally set
`CHROMIUM_PATH` for an existing browser. The UI test starts its own local server.

The checks cover all requested fields, decimals and homophones, ambiguity,
unrecognized places, local save/reload, manual changes during transcription, undo,
wishlist ratings, injection safety, microphone start/stop, permission denial,
background cancellation, late permission grants, and stale worker results.
Physical iPhone Air microphone accuracy, speed and memory behavior still need a
device check. Synthetic capture tests do not establish physical-device performance.
Actual Whisper inference also passed in desktop Chromium using a public speech
sample, with no network writes or failed downloads observed.

Implementation references reviewed:

1. [Lifting voice implementation](https://github.com/asre1212/Lifting/blob/e82b92456cb64aa8292204cea817c9cd4ff88d2a/voice.js)
2. [Transformers.js speech recognition](https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.AutomaticSpeechRecognitionPipeline)
3. [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
4. [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

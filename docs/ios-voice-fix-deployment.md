# iOS voice recognition deployment fix

Deployment marker for the 2026-08-17 iPhone Safari voice-input repair.

The functional changes are already on `main`:

- Keep the floating Comic Adventure CTA clear of the chat composer microphone controls.
- Accept mobile `MediaRecorder` Data URLs in the server transcription path.
- Prefer the configured Gemini API for Korean speech-to-text, with the legacy Forge service retained as an optional fallback.

This marker commit intentionally creates a normal branch/PR Git event so the connected Vercel project can pick up the latest `main` state and produce a fresh deployment.

Production trigger: use a regular merge commit so the Vercel Git integration receives an explicit `main` push event after the validated preview deployment.

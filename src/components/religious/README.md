# Religious Section — Branch & Scope Rules

- Work only on the `religious-section` branch.
- Allowed paths for this work:
  - `src/components/religious/**`
  - `public/quran/**`
  - `public/sounds/**`
  - `public/manifest.json`
  - `public/service-worker.js`
  - `.env.example`
  - `src/App.tsx` for routing only
- Do not modify `main`, `auth-system`, other branches, or any files outside the allowed paths.
- Never place real API keys or secrets in source control or chat.
- Put local secrets in `.env.local` and keep that file untracked.
- If a task requires changing anything outside this scope, stop and ask before proceeding.

## Religious API keys

The example variables are `EVERYAYAH_KEY` and `QURAN_API_KEY`. The values in `.env.example` must remain blank.

When a key is needed, ask the project owner to add it locally using this exact instruction:

يا مالك حط المفتاح في .env.local باسم EVERYAYAH_KEY ولا توريهولي في الشات، قولي تم فقط

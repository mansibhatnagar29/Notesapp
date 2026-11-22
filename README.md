# NotePilot — Meeting capture & notes

A Vite + React meeting notes web app intended for GitHub and Vercel. Captures browser-tab audio (Google Meet/Teams/Zoom web) or microphone audio, sends audio chunks to OpenAI Whisper for transcription, and summarizes the transcript into decisions/action items with an OpenAI chat model.


## Important limitations (MVP)
- For browser-tab capture, Chrome/Edge lets you pick a tab and enable **Share tab audio**. The app records audio from the shared tab; video is immediately discarded.
- Microphone mode captures mic input. It may not capture remote participants when you use headphones.
- It does **not** auto-join Zoom/Teams/Meet, detect speaker names, or support system-audio capture from native desktop meeting apps.
- Transcription and summarization require an OpenAI API key. Audio chunks are sent to your deployed server endpoint and OpenAI for processing. Do not record without participants' consent.
- This is a starter MVP; consider chunk overlap, retries, speaker diarization, auth, secure storage, and deletion controls before production.

## Run locally
1. Install Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env.local`, add your OpenAI API key.
4. Local Vercel API endpoints need the Vercel dev runtime: install Vercel CLI and run `vercel dev`. For frontend-only preview, `npm run dev` will work but `/api` endpoints require Vercel dev environment.
5. Deploy to Vercel and set `OPENAI_API_KEY` in Project Settings → Environment Variables.

## Deploy
1. Push this folder to a GitHub repository.
2. Import that repository in Vercel.
3. Framework preset: Vite (or Other); build command `npm run build`, output directory `dist`.
4. Add `OPENAI_API_KEY` as a Vercel environment variable, then redeploy.

## Costs and privacy
Audio is sent to your Vercel function and OpenAI for transcription; transcript text is sent to OpenAI for summarization. Review provider policies and costs, and get meeting participants' permission. Do not use for confidential meetings until authentication and retention controls are implemented.

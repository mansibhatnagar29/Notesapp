export const config = { api: { bodyParser: false } };
import OpenAI from 'openai';
import { IncomingForm } from 'formidable';
import fs from 'fs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY environment variable.' });
  try {
    const form = new IncomingForm({ maxFileSize: 24 * 1024 * 1024 });
    const [fields, files] = await new Promise((resolve, reject) => form.parse(req, (err, fields, files) => err ? reject(err) : resolve([fields, files])));
    const audio = Array.isArray(files.audio) ? files.audio[0] : files.audio;
    if (!audio) return res.status(400).json({ error: 'Audio file missing.' });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.audio.transcriptions.create({ file: fs.createReadStream(audio.filepath), model: 'whisper-1' });
    try { fs.unlinkSync(audio.filepath); } catch {}
    return res.status(200).json({ text: result.text || '' });
  } catch (e) { return res.status(500).json({ error: e.message || 'Transcription error.' }); }
}

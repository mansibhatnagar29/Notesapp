import OpenAI from 'openai';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY environment variable.' });
  try {
    const { title = 'Meeting', transcript = '' } = req.body || {};
    if (!transcript.trim()) return res.status(400).json({ error: 'Transcript is required.' });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({ model: 'gpt-4o-mini', temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert meeting note-taker. Return valid JSON with keys summary (string, concise), decisions (array of strings), actionItems (array of objects with task, owner, due; use empty strings when unknown), notes (string with structured notes in plain text). Do not invent details. If speaker or owner is unclear, leave owner blank.' },
        { role: 'user', content: `Meeting title: ${title}\nTranscript:\n${transcript}` }
      ] });
    const content = response.choices?.[0]?.message?.content || '{}';
    return res.status(200).json(JSON.parse(content));
  } catch (e) { return res.status(500).json({ error: e.message || 'Summarization error.' }); }
}

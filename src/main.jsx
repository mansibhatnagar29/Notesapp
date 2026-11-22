import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';


function App() {
  const [title, setTitle] = useState('Untitled meeting');
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('idle');
  const [source, setSource] = useState('tab');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);

  useEffect(() => {
    if (status !== 'recording') return;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const fmt = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2,'0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;

  async function transcribeBlob(blob) {
    if (!blob || blob.size < 1000) return;
    if (busyRef.current) { chunksRef.current.push(blob); return; }
    busyRef.current = true;
    try {
      const file = new File([blob], 'meeting-audio.webm', { type: blob.type || 'audio/webm' });
      const form = new FormData(); form.append('audio', file);
      const response = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      if (data.text?.trim()) setTranscript(prev => prev + (prev ? '\n' : '') + data.text.trim());
    } catch (e) { setError(e.message || 'Transcription error'); }
    finally {
      busyRef.current = false;
      const next = chunksRef.current.shift();
      if (next) transcribeBlob(next);
    }
  }

  async function startCapture() {
    setError(''); setSummary(null); setStatus('starting');
    try {
      const stream = source === 'tab'
        ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        : await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (source === 'tab' && !stream.getAudioTracks().length) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('No tab audio captured. Select a browser tab and enable “Share tab audio”.');
      }
      if (source === 'tab') stream.getVideoTracks().forEach(t => t.stop());
      const audioStream = new MediaStream(stream.getAudioTracks());
      const recorder = new MediaRecorder(audioStream);
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data?.size) transcribeBlob(e.data); };
      recorder.onstop = () => { setStatus('idle'); stream.getTracks().forEach(t => t.stop()); streamRef.current = null; };
      recorder.start(15000);
      startedAtRef.current = Date.now(); setElapsed(0); setStatus('recording');
      stream.getAudioTracks().forEach(track => track.addEventListener('ended', stopCapture));
    } catch (e) { setStatus('idle'); setError(e.message || 'Could not start audio capture'); }
  }
  function stopCapture() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStatus('idle');
  }
  async function generateSummary() {
    if (!transcript.trim()) { setError('Capture or paste a transcript before generating notes.'); return; }
    setError(''); setStatus('summarizing');
    try {
      const r = await fetch('/api/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, transcript }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Summary failed');
      setSummary(data); setNotes(data.notes || '');
    } catch(e) { setError(e.message); }
    finally { setStatus('idle'); }
  }
  function downloadMarkdown() {
    const md = `# ${title}\n\n## Summary\n${summary?.summary || ''}\n\n## Decisions\n${(summary?.decisions || []).map(x => '- ' + x).join('\n')}\n\n## Action Items\n${(summary?.actionItems || []).map(x => `- [ ] ${x.task}${x.owner ? ' — ' + x.owner : ''}${x.due ? ' (Due: ' + x.due + ')' : ''}`).join('\n')}\n\n## Notes\n${notes}\n\n## Transcript\n${transcript}`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = (title.replace(/[^a-z0-9]/gi,'-').toLowerCase() || 'meeting-notes') + '.md'; a.click(); URL.revokeObjectURL(a.href);
  }
  const isBusy = status === 'starting' || status === 'summarizing';
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-icon">✦</span> NotePilot</div><div className="tagline">Meet. Capture. Summarize.</div><span className="pill">PRIVATE WORKSPACE</span></header>
    <main className="layout">
      <aside className="sidebar"><div className="side-label">WORKSPACE</div><div className="nav active"><span>◉</span> Meeting notes</div><div className="nav muted"><span>⌕</span> Search notes <small>Coming soon</small></div><div className="side-bottom"><div className="mini-card"><div className="mini-icon">✧</div><b>Stay in the conversation.</b><p>NotePilot captures the details so you can focus on the people in the room.</p></div><div className="privacy">🔒 Audio is sent to your configured transcription API for processing.</div></div></aside>
      <section className="main-area"><div className="page-heading"><div><p className="eyebrow">MEETING WORKSPACE</p><h1>Capture what matters.</h1><p className="subtitle">Record audio, keep a transcript, and turn discussions into useful notes.</p></div><button className="download" onClick={downloadMarkdown} disabled={!transcript && !summary}>↓ Export notes</button></div>
      <div className="capture-card"><div className="capture-head"><div><div className="card-title">Live capture</div><div className="card-sub">Choose an audio source and start capturing your meeting.</div></div><div className={`status ${status}`}>{status === 'recording' ? '● RECORDING' : status === 'summarizing' ? 'GENERATING NOTES' : status === 'starting' ? 'CONNECTING' : 'READY'}</div></div>
      <div className="capture-controls"><div className="source-select"><label>Audio source</label><select value={source} onChange={e=>setSource(e.target.value)} disabled={status==='recording'}><option value="tab">Browser tab (Meet / Teams / Zoom web)</option><option value="mic">Microphone</option></select><p>{source==='tab'?'Choose the meeting tab in the sharing dialog and enable tab audio.':'Captures audio from your microphone.'}</p></div><div className="timer">{fmt(elapsed)}</div><div className="control-buttons">{status==='recording'?<button className="stop" onClick={stopCapture}>■ Stop capture</button>:<button className="start" onClick={startCapture} disabled={isBusy}>● Start capture</button>}</div></div>
      <div className="capture-tip"><span>ⓘ</span> Make sure you have permission to record. For browser tab capture, select the meeting tab and enable audio sharing.</div></div>
      {error && <div className="error">⚠ {error}</div>}
      <div className="columns"><div className="panel transcript-panel"><div className="panel-header"><div><h2>Transcript</h2><p>Live speech-to-text</p></div><span className="count">{transcript.trim()?transcript.trim().split(/\s+/).length:0} words</span></div><textarea value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Your transcript will appear here as audio is captured. You can also paste a transcript…"/><div className="panel-footer">Transcript is editable. Add or correct anything you missed.</div></div>
      <div className="panel notes-panel"><div className="panel-header"><div><h2>Meeting notes</h2><p>AI-generated notes</p></div><span className="spark">✦ AI</span></div><input className="title-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Meeting title"/><div className="summary-area">{summary?<><h3>Summary</h3><p>{summary.summary}</p>{summary.decisions?.length>0&&<><h3>Decisions</h3><ul>{summary.decisions.map((d,i)=><li key={i}>{d}</li>)}</ul></>}{summary.actionItems?.length>0&&<><h3>Action items</h3><ul className="actions">{summary.actionItems.map((a,i)=><li key={i}><b>{a.task}</b>{a.owner&&<span> · {a.owner}</span>}{a.due&&<small> · Due {a.due}</small>}</li>)}</ul></>}</>:<div className="empty"><div className="empty-icon">✧</div><b>Your notes will take shape here.</b><p>Generate a concise summary, decisions and action items from your transcript.</p></div>}</div><textarea className="notes-editor" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add your own notes…"/><button className="summarize" onClick={generateSummary} disabled={isBusy || !transcript.trim()}>{status==='summarizing'?'Working…':'✦ Generate meeting notes'}</button></div></div>
      <div className="footnote">NotePilot is an independent note-taking tool. It does not automatically join meetings or identify speakers in this MVP.</div></section></main></div>;
}

createRoot(document.getElementById('root')).render(<App/>);

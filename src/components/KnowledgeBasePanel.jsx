import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Trash2, RefreshCw, Search, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../api.js';

/**
 * Documents the assistant may quote.
 *
 * The model already knows the live figures. What it could never answer was
 * anything written down rather than recorded — a service procedure, a storage
 * temperature, what an error code means. Those go here, and the assistant cites
 * them by name so an answer can be traced back to the page it came from.
 */

const label = { display: 'block', fontSize: 12, fontWeight: 600, color: '#4A5568', marginBottom: 6 };
const hint = { fontSize: 11, color: '#94A3B8', marginTop: 5 };
const field = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13 };

const kb = (bytes) => {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  // A short note rounds to "0 KB", which reads as a failed upload.
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
};

export default function KnowledgeBasePanel({ notify }) {
  const [state, setState] = useState(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [hits, setHits] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const res = await api.getKbDocuments();
    if (res) setState(res);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await api.getKbDocuments();
      if (alive && res) setState(res);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const addPasted = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await api.addKbDocument({ title: title.trim() || 'Pasted note', text });
    setBusy(false);
    if (!res.ok) {
      notify?.('Not Added', res.error, 'error');
      return;
    }
    setTitle('');
    setText('');
    await load();
    notify?.('Added', `${res.chunks} passages indexed${res.embedded ? ' and embedded' : ''}.`, 'success');
  };

  const addFile = async (file) => {
    if (!file) return;
    setBusy(true);
    // Read as base64 so a spreadsheet survives the trip intact; the server owns
    // the extraction, because that is where the xlsx reader already lives.
    const buf = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    const res = await api.addKbDocument({
      title: file.name,
      filename: file.name,
      mime: file.type,
      content: btoa(binary),
      encoding: 'base64',
    });
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!res.ok) {
      notify?.('Not Added', res.error, 'error');
      return;
    }
    await load();
    notify?.('Added', `${file.name}: ${res.chunks} passages indexed.`, 'success');
  };

  const remove = async (id, docTitle) => {
    if (!window.confirm(`Delete "${docTitle}"? The assistant will stop quoting it.`)) return;
    const ok = await api.deleteKbDocument(id);
    if (!ok) return notify?.('Not Deleted', 'That document could not be removed.', 'error');
    await load();
    notify?.('Deleted', `"${docTitle}" is no longer in the knowledge base.`, 'success');
  };

  const reindex = async (id) => {
    setBusy(true);
    const res = await api.reindexKbDocument(id);
    setBusy(false);
    await load();
    notify?.(
      res?.embedded ? 'Reindexed' : 'Not Embedded',
      res?.embedded ? `Embedded with ${res.model}.` : 'No provider with an embedding key — keyword search still works.',
      res?.embedded ? 'success' : 'info',
    );
  };

  const runSearch = async () => {
    if (!testQuery.trim()) return;
    setHits(null);
    const res = await api.searchKb(testQuery.trim());
    setHits(res?.hits || []);
  };

  if (!state) return <div style={{ fontSize: 12, color: '#94A3B8' }}>Loading knowledge base…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          fontSize: 12,
          color: state.embedding ? '#065F46' : '#92400E',
          background: state.embedding ? '#D1FAE5' : '#FEF3C7',
          border: `1px solid ${state.embedding ? '#A7F3D0' : '#FDE68A'}`,
          borderRadius: 9,
          padding: '9px 12px',
        }}
      >
        {state.embedding
          ? `Meaning-based search is on, using ${state.embedding.provider} (${state.embedding.model}).`
          : 'Keyword search only. Add an OpenAI or Gemini key to also match questions that use different words to the document.'}
      </div>

      <div>
        <label style={label}>Add a document</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. MACS Separator service procedure"
          style={field}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the text here…"
          rows={5}
          style={{ ...field, marginTop: 8, fontFamily: 'inherit', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="bp" onClick={addPasted} disabled={busy || !text.trim()} style={{ width: 'fit-content' }}>
            {busy ? <Loader2 size={14} /> : <FileText size={14} />} Add Text
          </button>
          <button
            className="bs"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{ width: 'fit-content' }}
          >
            <Upload size={14} /> Upload File
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={state.accepted.join(',')}
            onChange={(e) => addFile(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
        </div>
        <p style={hint}>
          Accepted: {state.accepted.join(', ')} — up to 5 MB. PDFs and Word files need converting to text first; the
          upload will say so rather than indexing something half-read.
        </p>
      </div>

      <div>
        <label style={label}>Documents ({state.documents.length})</label>
        <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {state.documents.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 12, color: '#94A3B8' }}>
              Nothing yet. Until something is added here, the assistant answers only from live system data.
            </div>
          )}
          {state.documents.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderTop: '1px solid #F1F5F9',
                fontSize: 12.5,
              }}
            >
              <FileText size={15} color="#0B7A3E" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.title}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {d.chunk_count} passages · {kb(d.bytes)} ·{' '}
                  {d.status === 'embedded' ? `embedded (${d.embedding_model})` : 'keyword only'}
                  {d.uploaded_by ? ` · ${d.uploaded_by}` : ''}
                </div>
                {d.error && (
                  <div style={{ fontSize: 11, color: '#B91C1C' }}>
                    <AlertTriangle size={11} /> {d.error}
                  </div>
                )}
              </div>
              {d.status !== 'embedded' && (
                <button className="bs" onClick={() => reindex(d.id)} disabled={busy} title="Embed this document">
                  <RefreshCw size={13} />
                </button>
              )}
              <button className="bs" onClick={() => remove(d.id, d.title)} title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <details>
        <summary style={{ fontSize: 12, fontWeight: 600, color: '#4A5568', cursor: 'pointer' }}>Try a question</summary>
        <p style={{ ...hint, marginTop: 8 }}>
          Shows exactly which passages the assistant would be given. Useful before deciding the model got something
          wrong — often it was handed the wrong page.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="e.g. how should reagents be stored?"
            style={field}
          />
          <button className="bs" onClick={runSearch} style={{ width: 'fit-content' }}>
            <Search size={14} />
          </button>
        </div>
        {hits && hits.length === 0 && (
          <p style={{ ...hint, marginTop: 10 }}>
            Nothing matched well enough. The assistant would answer from live data alone rather than stretch a weak
            match into a policy.
          </p>
        )}
        {hits?.map((h, i) => (
          <div
            key={`${h.docId}-${h.ordinal}`}
            style={{
              marginTop: 10,
              padding: '10px 12px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 9,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 600, color: '#0F172A' }}>
              [{i + 1}] {h.title} · part {h.ordinal + 1} · score {h.score.toFixed(2)}
            </div>
            <div style={{ color: '#475569', marginTop: 5, whiteSpace: 'pre-wrap' }}>{h.content}</div>
          </div>
        ))}
      </details>
    </div>
  );
}

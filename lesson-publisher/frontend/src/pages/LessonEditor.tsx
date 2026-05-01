import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { RichTextEditor } from '../components/RichTextEditor.js';

const BLOCK_TYPES = [
  { type: 'text', icon: '📝', label: 'Text' },
  { type: 'image', icon: '🖼', label: 'Image' },
  { type: 'video', icon: '🎬', label: 'Video' },
  { type: 'quiz', icon: '✅', label: 'Quiz' },
  { type: 'file', icon: '📎', label: 'File' },
] as const;

const DEFAULT_CONTENT: Record<string, any> = {
  text: { html: '<p>Enter your content here...</p>' },
  image: { url: '', alt: '', caption: '' },
  video: { provider: 'youtube', embed_url: '', duration_seconds: 0 },
  quiz: { questions: [{ id: 'q1', text: 'Enter your question', options: [{ id: 'a', text: 'Option A', is_correct: true }, { id: 'b', text: 'Option B', is_correct: false }], explanation: '' }] },
  file: { url: '', filename: '', size_bytes: 0, mime_type: 'application/pdf' },
};

export function LessonEditor() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!lessonId) return;
    api.getLesson(lessonId).then(({ lesson, blocks }) => {
      setLesson(lesson);
      setBlocks(blocks);
      setTitle(lesson.title);
    }).catch(console.error);
  }, [lessonId]);

  async function handleAddBlock(type: string) {
    if (!lessonId) return;
    const { block } = await api.createBlock(lessonId, {
      type,
      position: blocks.length,
      content: DEFAULT_CONTENT[type],
    });
    setBlocks([...blocks, block]);
    setSelectedBlock(block.id);
  }

  async function handleDeleteBlock(blockId: string) {
    if (!lessonId) return;
    await api.deleteBlock(lessonId, blockId);
    setBlocks(blocks.filter((b) => b.id !== blockId));
    if (selectedBlock === blockId) setSelectedBlock(null);
  }

  async function handlePublish() {
    if (!lessonId) return;
    const { lesson: updated } = await api.publishLesson(lessonId);
    setLesson(updated);
  }

  async function handleUnpublish() {
    if (!lessonId) return;
    const { lesson: updated } = await api.unpublishLesson(lessonId);
    setLesson(updated);
  }

  async function handleTitleBlur() {
    if (!lessonId || title === lesson?.title) return;
    await api.updateLesson(lessonId, { title });
  }

  if (!lesson) return <div style={{ padding: 48 }}>Loading...</div>;

  const selected = blocks.find((b) => b.id === selectedBlock);

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e5e5ea' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            style={{ fontSize: 18, fontWeight: 600, border: '1px dashed #d1d1d6', padding: '6px 12px', borderRadius: 6, width: 500 }}
          />
        </div>
        <div>
          {lesson.status === 'published' ? (
            <button onClick={handleUnpublish} style={btnSecondary}>Unpublish</button>
          ) : (
            <button onClick={handlePublish} style={btnPrimary}>Publish & Get Link</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
        {/* Sidebar - block list */}
        <div style={{ width: 280, background: '#fff', borderRight: '1px solid #e5e5ea', padding: 16, overflowY: 'auto' }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#8e8e93', letterSpacing: 1, marginBottom: 12 }}>Lesson Blocks</h3>

          {blocks.map((block) => (
            <div
              key={block.id}
              onClick={() => setSelectedBlock(block.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                marginBottom: 6, cursor: 'pointer', fontSize: 13,
                border: `1px solid ${selectedBlock === block.id ? '#6c5ce7' : '#e5e5ea'}`,
                background: selectedBlock === block.id ? '#f0edff' : '#fafafa',
              }}
            >
              <span>{BLOCK_TYPES.find((t) => t.type === block.type)?.icon ?? '📄'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {block.title || `${block.type} block`}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                style={{ background: 'none', border: 'none', color: '#c7c7cc', cursor: 'pointer', fontSize: 14 }}
              >×</button>
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: '#8e8e93', textTransform: 'uppercase', marginBottom: 8 }}>Add block</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BLOCK_TYPES.map((bt) => (
                <button
                  key={bt.type}
                  onClick={() => handleAddBlock(bt.type)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px dashed #c7c7cc', background: 'none', cursor: 'pointer', fontSize: 12 }}
                >
                  {bt.icon} {bt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main editor area */}
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
          {selected ? (
            <BlockEditor block={selected} lessonId={lessonId!} onUpdate={(updated) => {
              setBlocks(blocks.map((b) => b.id === updated.id ? updated : b));
            }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#8e8e93', marginTop: 100 }}>
              <p style={{ fontSize: 18 }}>Select a block to edit, or add a new one from the sidebar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ block, lessonId, onUpdate }: { block: any; lessonId: string; onUpdate: (b: any) => void }) {
  const [content, setContent] = useState(block.content);
  const [title, setTitle] = useState(block.title ?? '');

  useEffect(() => {
    setContent(block.content);
    setTitle(block.title ?? '');
  }, [block.id]);

  async function save() {
    const { block: updated } = await api.updateBlock(lessonId, block.id, { title: title || undefined, content });
    onUpdate(updated);
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e5ea' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, textTransform: 'uppercase', color: '#8e8e93', letterSpacing: 1 }}>{block.type} block</h4>
        <button onClick={save} style={btnPrimary}>Save</button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Block title (optional)"
        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e5ea', borderRadius: 6, marginBottom: 16, fontSize: 14 }}
      />

      {block.type === 'text' && (
        <RichTextEditor
          content={content.html ?? ''}
          onChange={(html) => setContent({ html })}
          placeholder="Start writing your content..."
        />
      )}

      {block.type === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={content.url ?? ''} onChange={(e) => setContent({ ...content, url: e.target.value })} placeholder="Image URL" style={inputStyle} />
          <input value={content.alt ?? ''} onChange={(e) => setContent({ ...content, alt: e.target.value })} placeholder="Alt text" style={inputStyle} />
          <input value={content.caption ?? ''} onChange={(e) => setContent({ ...content, caption: e.target.value })} placeholder="Caption" style={inputStyle} />
        </div>
      )}

      {block.type === 'video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={content.embed_url ?? ''} onChange={(e) => setContent({ ...content, embed_url: e.target.value })} placeholder="Video URL (YouTube, Loom, Vimeo)" style={inputStyle} />
        </div>
      )}

      {block.type === 'quiz' && (
        <QuizEditor content={content} onChange={setContent} />
      )}

      {block.type === 'file' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={content.url ?? ''} onChange={(e) => setContent({ ...content, url: e.target.value })} placeholder="File URL" style={inputStyle} />
          <input value={content.filename ?? ''} onChange={(e) => setContent({ ...content, filename: e.target.value })} placeholder="Filename (e.g. template.pdf)" style={inputStyle} />
        </div>
      )}
    </div>
  );
}

function QuizEditor({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const questions = content.questions ?? [];

  function updateQuestion(qIdx: number, field: string, value: any) {
    const updated = [...questions];
    updated[qIdx] = { ...updated[qIdx], [field]: value };
    onChange({ questions: updated });
  }

  function updateOption(qIdx: number, oIdx: number, field: string, value: any) {
    const updated = [...questions];
    const opts = [...updated[qIdx].options];
    opts[oIdx] = { ...opts[oIdx], [field]: value };
    updated[qIdx] = { ...updated[qIdx], options: opts };
    onChange({ questions: updated });
  }

  function addOption(qIdx: number) {
    const updated = [...questions];
    const opts = [...updated[qIdx].options, { id: `o${Date.now()}`, text: '', is_correct: false }];
    updated[qIdx] = { ...updated[qIdx], options: opts };
    onChange({ questions: updated });
  }

  return (
    <div>
      {questions.map((q: any, qIdx: number) => (
        <div key={q.id} style={{ marginBottom: 16 }}>
          <input
            value={q.text}
            onChange={(e) => updateQuestion(qIdx, 'text', e.target.value)}
            placeholder="Question text"
            style={{ ...inputStyle, fontWeight: 600, marginBottom: 8 }}
          />
          {q.options.map((opt: any, oIdx: number) => (
            <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <input
                type="radio"
                checked={opt.is_correct}
                onChange={() => {
                  q.options.forEach((_: any, i: number) => updateOption(qIdx, i, 'is_correct', i === oIdx));
                }}
              />
              <input
                value={opt.text}
                onChange={(e) => updateOption(qIdx, oIdx, 'text', e.target.value)}
                placeholder={`Option ${oIdx + 1}`}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
          ))}
          <button onClick={() => addOption(qIdx)} style={{ ...btnSecondary, fontSize: 12, padding: '4px 12px', marginTop: 4 }}>+ Add option</button>
          <input
            value={q.explanation ?? ''}
            onChange={(e) => updateQuestion(qIdx, 'explanation', e.target.value)}
            placeholder="Explanation (shown after answering)"
            style={{ ...inputStyle, marginTop: 8 }}
          />
        </div>
      ))}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#636366', border: '1px solid #e5e5ea', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #e5e5ea', borderRadius: 6, fontSize: 14 };

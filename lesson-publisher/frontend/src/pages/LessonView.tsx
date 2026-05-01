import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { learnerApi } from '../lib/api.js';

export function LessonView() {
  const { trainerSlug, lessonSlug } = useParams();
  const [data, setData] = useState<any>(null);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());
  const [quizAnswers, setQuizAnswers] = useState<Record<string, { optionId: string; isCorrect: boolean; explanation?: string }>>({}); // key: blockId-questionId
  const [lessonComplete, setLessonComplete] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('learner_data');
    if (stored) {
      const parsed = JSON.parse(stored);
      setData(parsed);
      setCompletedBlocks(new Set(parsed.progress?.filter((p: any) => p.completed).map((p: any) => p.block_id) ?? []));
      setLessonComplete(parsed.enrollment?.status === 'completed');
      const answers: Record<string, any> = {};
      for (const qr of parsed.quizResponses ?? []) {
        answers[`${qr.block_id}-${qr.question_id}`] = { optionId: qr.selected_option_id, isCorrect: qr.is_correct };
      }
      setQuizAnswers(answers);
    }
  }, []);

  async function handleBlockComplete(blockId: string) {
    if (completedBlocks.has(blockId)) return;
    await learnerApi.completeBlock(blockId);
    setCompletedBlocks((prev) => new Set([...prev, blockId]));
  }

  async function handleQuizAnswer(blockId: string, questionId: string, optionId: string) {
    const key = `${blockId}-${questionId}`;
    if (quizAnswers[key]) return;
    const result = await learnerApi.submitQuiz(blockId, { questionId, selectedOptionId: optionId });
    setQuizAnswers((prev) => ({ ...prev, [key]: { optionId, ...result } }));
  }

  async function handleLessonComplete() {
    await learnerApi.completeLesson();
    setLessonComplete(true);
  }

  if (!data) return <div style={{ padding: 48, textAlign: 'center', color: '#8e8e93' }}>Loading...</div>;

  const blocks = data.blocks ?? [];
  const totalBlocks = blocks.length;
  const completedCount = completedBlocks.size;
  const progressPct = totalBlocks > 0 ? (completedCount / totalBlocks) * 100 : 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 48px' }}>
      {/* Progress bar */}
      <div style={{ position: 'sticky', top: 0, background: '#f5f5f7', padding: '16px 0 12px', zIndex: 10, borderBottom: '1px solid #e5e5ea', marginBottom: 24 }}>
        <div style={{ height: 6, background: '#e5e5ea', borderRadius: 3 }}>
          <div style={{ height: '100%', background: '#6c5ce7', borderRadius: 3, width: `${progressPct}%`, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 6 }}>{Math.round(progressPct)}% complete · {completedCount} of {totalBlocks} sections</div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{data.lesson.title}</h1>
        {data.lesson.description && <p style={{ fontSize: 14, color: '#636366', marginBottom: 8, lineHeight: 1.6 }}>{data.lesson.description}</p>}
        <div style={{ fontSize: 13, color: '#8e8e93' }}>~{data.lesson.estimatedMinutes ?? '?'} min · Self-paced</div>
      </div>

      {/* Blocks */}
      {blocks.map((block: any, index: number) => (
        <div key={block.id} style={{ marginBottom: 12 }}>
          {/* Block card */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e5ea', padding: '24px 28px', marginBottom: 0 }}>
            {/* Block title */}
            {block.title && block.type !== 'quiz' && (
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f2' }}>{block.title}</h3>
            )}

            {block.type === 'text' && (
              <div style={{ fontSize: 15, lineHeight: 1.8, color: '#3a3a4a' }} dangerouslySetInnerHTML={{ __html: block.content.html }} />
            )}

            {block.type === 'image' && (
              <div>
                {block.content.url ? (
                  <img src={block.content.url} alt={block.content.alt ?? ''} style={{ width: '100%', borderRadius: 8 }} loading="lazy" />
                ) : (
                  <div style={{ width: '100%', height: 200, borderRadius: 8, background: 'linear-gradient(135deg, #e5e5ea 0%, #d1d1d6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 32, opacity: 0.5 }}>🖼</span>
                    <span style={{ fontSize: 13, color: '#8e8e93' }}>{block.content.alt || 'Image'}</span>
                  </div>
                )}
                {block.content.caption && <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 8 }}>{block.content.caption}</p>}
              </div>
            )}

            {block.type === 'video' && (
              <div>
                {block.content.embed_url ? (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden', background: '#1a1a2e' }}>
                    <iframe
                      src={toEmbedUrl(block.content.embed_url)}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div style={{ width: '100%', paddingBottom: '56.25%', borderRadius: 8, background: '#1a1a2e', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 48 }}>▶</div>
                  </div>
                )}
                {block.content.duration_seconds > 0 && (
                  <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 8 }}>
                    Duration: {Math.floor(block.content.duration_seconds / 60)}:{String(block.content.duration_seconds % 60).padStart(2, '0')}
                  </p>
                )}
              </div>
            )}

            {block.type === 'quiz' && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{block.title ?? 'Knowledge Check'}</h3>
                <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16 }}>{block.content.questions?.length ?? 0} question{block.content.questions?.length !== 1 ? 's' : ''}</p>
                {block.content.questions?.map((q: any) => {
                  const answerKey = `${block.id}-${q.id}`;
                  const answer = quizAnswers[answerKey];

                  return (
                    <div key={q.id} style={{ marginBottom: 20 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{q.text}</p>
                      {q.options.map((opt: any) => {
                        const isSelected = answer?.optionId === opt.id;
                        let borderColor = '#e5e5ea';
                        let bg = '#fff';
                        if (answer) {
                          if (isSelected && answer.isCorrect) { borderColor = '#34c759'; bg = '#f0fff4'; }
                          else if (isSelected && !answer.isCorrect) { borderColor = '#fc8181'; bg = '#fff5f5'; }
                          else if (opt.is_correct) { borderColor = '#34c759'; bg = '#f0fff4'; }
                        }

                        return (
                          <div
                            key={opt.id}
                            onClick={() => !answer && handleQuizAnswer(block.id, q.id, opt.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                              margin: '8px 0', border: `1.5px solid ${borderColor}`, borderRadius: 10,
                              fontSize: 14, cursor: answer ? 'default' : 'pointer', background: bg,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span style={{ color: isSelected ? '#6c5ce7' : '#c7c7cc', fontSize: 16 }}>{isSelected ? '●' : '○'}</span>
                            <span style={{ flex: 1 }}>{opt.text}</span>
                            {answer && isSelected && (
                              <span style={{ fontSize: 14 }}>{answer.isCorrect ? '✓' : '✗'}</span>
                            )}
                          </div>
                        );
                      })}
                      {answer && (
                        <div style={{
                          marginTop: 12, padding: 14, borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                          background: answer.isCorrect ? '#f0fff4' : '#fff5f5',
                          color: answer.isCorrect ? '#1b7a3d' : '#c53030',
                          border: `1px solid ${answer.isCorrect ? '#34c759' : '#fc8181'}`,
                        }}>
                          <strong>{answer.isCorrect ? '✓ Correct!' : '✗ Incorrect.'}</strong> {answer.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {block.type === 'file' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0edff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.content.filename || block.title || 'Attachment'}</div>
                  <div style={{ fontSize: 12, color: '#8e8e93' }}>
                    {block.content.size_bytes > 0 ? formatBytes(block.content.size_bytes) : 'PDF'}
                  </div>
                </div>
                {block.content.url && (
                  <a href={block.content.url} download style={{
                    background: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 20px',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
                  }}>Download</a>
                )}
              </div>
            )}
          </div>

          {/* Section complete checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px' }}>
            <input
              type="checkbox"
              checked={completedBlocks.has(block.id)}
              onChange={() => handleBlockComplete(block.id)}
              style={{ accentColor: '#6c5ce7', width: 16, height: 16, cursor: 'pointer' }}
            />
            <label style={{ fontSize: 13, color: completedBlocks.has(block.id) ? '#34c759' : '#8e8e93', cursor: 'pointer' }} onClick={() => handleBlockComplete(block.id)}>
              {completedBlocks.has(block.id) ? 'Completed' : 'Mark as complete'}
            </label>
          </div>
        </div>
      ))}

      {/* Mark lesson complete */}
      <button
        onClick={handleLessonComplete}
        disabled={lessonComplete}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: 18, borderRadius: 12, fontSize: 16, fontWeight: 600,
          border: 'none', cursor: lessonComplete ? 'default' : 'pointer',
          background: lessonComplete ? '#34c759' : '#6c5ce7', color: '#fff',
          marginTop: 24, boxShadow: lessonComplete ? 'none' : '0 2px 8px rgba(108,92,231,0.3)',
        }}
      >
        {lessonComplete ? '✓ Lesson completed' : '✓ Mark lesson complete'}
      </button>
    </div>
  );
}

function toEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const loomMatch = url.match(/loom\.com\/share\/([^?]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  return url;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

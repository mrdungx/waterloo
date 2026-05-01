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
      // Restore quiz answers
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
    if (quizAnswers[key]) return; // already answered
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      {/* Progress bar */}
      <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '12px 0', zIndex: 10, borderBottom: '1px solid #e5e5ea', marginBottom: 24 }}>
        <div style={{ height: 6, background: '#e5e5ea', borderRadius: 3 }}>
          <div style={{ height: '100%', background: '#6c5ce7', borderRadius: 3, width: `${progressPct}%`, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 4 }}>{Math.round(progressPct)}% complete · {completedCount} of {totalBlocks} sections</div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{data.lesson.title}</h1>
        {data.lesson.description && <p style={{ fontSize: 14, color: '#636366', marginBottom: 8 }}>{data.lesson.description}</p>}
        <div style={{ fontSize: 13, color: '#8e8e93' }}>~{data.lesson.estimatedMinutes ?? '?'} min · Self-paced</div>
      </div>

      {/* Blocks */}
      {blocks.map((block: any) => (
        <div key={block.id} style={{ marginBottom: 28 }}>
          {block.type === 'text' && (
            <div style={{ fontSize: 15, lineHeight: 1.8, color: '#3a3a4a' }} dangerouslySetInnerHTML={{ __html: block.content.html }} />
          )}

          {block.type === 'image' && (
            <div>
              {block.content.url ? (
                <img src={block.content.url} alt={block.content.alt ?? ''} style={{ width: '100%', borderRadius: 8 }} loading="lazy" />
              ) : (
                <div style={{ width: '100%', height: 200, borderRadius: 8, background: '#e5e5ea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e8e93' }}>
                  [ Image placeholder ]
                </div>
              )}
              {block.content.caption && <p style={{ fontSize: 12, color: '#8e8e93', marginTop: 4 }}>{block.content.caption}</p>}
            </div>
          )}

          {block.type === 'video' && (
            <div>
              {block.content.embed_url ? (
                <iframe
                  src={toEmbedUrl(block.content.embed_url)}
                  style={{ width: '100%', height: 400, borderRadius: 8, border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <div style={{ width: '100%', height: 200, borderRadius: 8, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 40 }}>▶</div>
              )}
              {block.title && <p style={{ fontSize: 13, color: '#8e8e93', marginTop: 8 }}>{block.title}</p>}
            </div>
          )}

          {block.type === 'quiz' && (
            <div style={{ background: '#fafafa', border: '1px solid #e5e5ea', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{block.title ?? 'Knowledge Check'}</h3>
              {block.content.questions?.map((q: any, qi: number) => {
                const answerKey = `${block.id}-${q.id}`;
                const answer = quizAnswers[answerKey];

                return (
                  <div key={q.id} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{q.text}</p>
                    {q.options.map((opt: any) => {
                      const isSelected = answer?.optionId === opt.id;
                      let borderColor = '#e5e5ea';
                      let bg = '#fff';
                      if (answer && isSelected) {
                        borderColor = answer.isCorrect ? '#34c759' : '#fc8181';
                        bg = answer.isCorrect ? '#f0fff4' : '#fff5f5';
                      }

                      return (
                        <div
                          key={opt.id}
                          onClick={() => !answer && handleQuizAnswer(block.id, q.id, opt.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            margin: '6px 0', border: `1px solid ${borderColor}`, borderRadius: 8,
                            fontSize: 14, cursor: answer ? 'default' : 'pointer', background: bg,
                          }}
                        >
                          <span>{isSelected ? '●' : '○'}</span>
                          <span>{opt.text}</span>
                        </div>
                      );
                    })}
                    {answer && (
                      <div style={{
                        marginTop: 12, padding: 12, borderRadius: 8, fontSize: 13,
                        background: answer.isCorrect ? '#f0fff4' : '#fff5f5',
                        color: answer.isCorrect ? '#1b7a3d' : '#c53030',
                        border: `1px solid ${answer.isCorrect ? '#34c759' : '#fc8181'}`,
                      }}>
                        {answer.isCorrect ? '✓ Correct!' : '✗ Incorrect.'} {answer.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {block.type === 'file' && (
            <div style={{ background: '#fafafa', border: '1px solid #e5e5ea', borderRadius: 8, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{block.content.filename || 'Download file'}</div>
                {block.content.size_bytes > 0 && (
                  <div style={{ fontSize: 12, color: '#8e8e93' }}>{formatBytes(block.content.size_bytes)}</div>
                )}
              </div>
              {block.content.url && (
                <a href={block.content.url} download style={{
                  background: '#6c5ce7', color: '#fff', border: 'none', padding: '8px 16px',
                  borderRadius: 6, fontSize: 13, textDecoration: 'none',
                }}>Download</a>
              )}
            </div>
          )}

          {/* Section complete checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={completedBlocks.has(block.id)}
              onChange={() => handleBlockComplete(block.id)}
              style={{ accentColor: '#6c5ce7', width: 16, height: 16 }}
            />
            <label style={{ fontSize: 13, color: '#636366' }}>Section complete</label>
          </div>
        </div>
      ))}

      {/* Mark lesson complete */}
      <button
        onClick={handleLessonComplete}
        disabled={lessonComplete}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: 16, borderRadius: 10, fontSize: 15, fontWeight: 600,
          border: 'none', cursor: lessonComplete ? 'default' : 'pointer',
          background: lessonComplete ? '#34c759' : '#6c5ce7', color: '#fff',
          marginTop: 32,
        }}
      >
        {lessonComplete ? '✓ Lesson completed' : '✓ Mark lesson complete'}
      </button>
    </div>
  );
}

function toEmbedUrl(url: string): string {
  // Convert YouTube watch URLs to embed
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Loom share to embed
  const loomMatch = url.match(/loom\.com\/share\/([^?]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;
  return url;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [tab, setTab] = useState<'lessons' | 'learners'>('lessons');
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [learners, setLearners] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(console.error);
    api.listLessons().then((r) => setLessons(r.lessons)).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedLesson) {
      api.getLessonLearners(selectedLesson).then((r) => setLearners(r.learners)).catch(console.error);
    }
  }, [selectedLesson]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    const { lesson } = await api.createLesson({ title: newTitle });
    navigate(`/lessons/${lesson.id}`);
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Lessons</h1>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ New Lesson</button>
      </div>

      {showCreate && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5ea', marginBottom: 24 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Lesson title..."
            style={{ fontSize: 16, padding: '8px 12px', border: '1px solid #e5e5ea', borderRadius: 6, width: 400, marginRight: 12 }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button onClick={handleCreate} style={btnPrimary}>Create</button>
          <button onClick={() => setShowCreate(false)} style={{ ...btnSecondary, marginLeft: 8 }}>Cancel</button>
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          <StatCard value={stats.publishedLessons} label="Published Lessons" />
          <StatCard value={stats.totalLearners} label="Total Learners" />
          <StatCard value={`${stats.avgCompletion}%`} label="Avg Completion" />
          <StatCard value={`${stats.avgQuizScore}%`} label="Avg Quiz Score" />
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        <TabBtn active={tab === 'lessons'} onClick={() => setTab('lessons')}>Lessons</TabBtn>
        <TabBtn active={tab === 'learners'} onClick={() => { setTab('learners'); if (!selectedLesson && lessons.length) setSelectedLesson(lessons[0].id); }}>Learners</TabBtn>
      </div>

      {tab === 'lessons' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => navigate(`/lessons/${lesson.id}`)}
              style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e5ea', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{lesson.title}</h3>
                <span style={{
                  display: 'inline-block', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: lesson.status === 'published' ? '#f0fff4' : '#fff3e0',
                  color: lesson.status === 'published' ? '#1b7a3d' : '#e65100',
                }}>{lesson.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 6 }}>
                {lesson.stats.learnerCount} learners · {lesson.stats.completionPercent}% completion · {lesson.stats.avgQuizScore}% avg score
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'learners' && (
        <div>
          {lessons.length > 1 && (
            <select
              value={selectedLesson ?? ''}
              onChange={(e) => setSelectedLesson(e.target.value)}
              style={{ marginBottom: 16, padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e5ea' }}
            >
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e5ea' }}>
            <thead>
              <tr>
                {['Learner', 'Enrolled', 'Progress', 'Last Active', 'Quiz Avg', 'Status'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {learners.map((l, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    <strong>{l.name}</strong><br />
                    <span style={{ color: '#8e8e93', fontSize: 11 }}>{l.email}</span>
                  </td>
                  <td style={tdStyle}>{new Date(l.enrolledAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <ProgressMini completed={l.progress.completed} total={l.progress.total} />
                    {l.progress.completed}/{l.progress.total}
                  </td>
                  <td style={tdStyle}>{l.lastActiveAt ? timeAgo(l.lastActiveAt) : '--'}</td>
                  <td style={tdStyle}>{l.quizAvgPercent ? `${l.quizAvgPercent}%` : '--'}</td>
                  <td style={tdStyle}>
                    <StatusDot status={l.status} /> {l.status.replace('_', ' ')}
                  </td>
                </tr>
              ))}
              {learners.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#8e8e93' }}>No learners yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, flex: 1, border: '1px solid #e5e5ea' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#6c5ce7' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: '1px solid #e5e5ea',
        background: active ? '#6c5ce7' : '#fff',
        color: active ? '#fff' : '#8e8e93',
        borderRadius: 0,
      }}
    >{children}</button>
  );
}

function ProgressMini({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <span style={{ display: 'inline-block', width: 80, height: 6, background: '#e5e5ea', borderRadius: 3, verticalAlign: 'middle', marginRight: 6 }}>
      <span style={{ display: 'block', height: '100%', borderRadius: 3, background: '#6c5ce7', width: `${pct}%` }} />
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { completed: '#34c759', in_progress: '#34c759', idle: '#ffcc00', not_started: '#e5e5ea' };
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colors[status] ?? '#e5e5ea', marginRight: 6, verticalAlign: 'middle' }} />;
}

function timeAgo(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

const btnPrimary: React.CSSProperties = { background: '#6c5ce7', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#636366', border: '1px solid #e5e5ea', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const thStyle: React.CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#8e8e93', padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e5ea', background: '#fafafa' };
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #f0f0f2' };

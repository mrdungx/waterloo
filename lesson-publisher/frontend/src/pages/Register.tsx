import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { learnerApi } from '../lib/api.js';

export function Register() {
  const { trainerSlug, lessonSlug } = useParams<{ trainerSlug: string; lessonSlug: string }>();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trainerSlug || !lessonSlug) return;
    learnerApi.getLessonMeta(trainerSlug, lessonSlug).then(setMeta).catch(() => setError('Lesson not found'));
  }, [trainerSlug, lessonSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trainerSlug || !lessonSlug || !name.trim() || !email.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await learnerApi.register(trainerSlug, lessonSlug, { name, email });
      localStorage.setItem('learner_token', result.token);
      localStorage.setItem('learner_data', JSON.stringify(result));
      navigate(`/${trainerSlug}/${lessonSlug}/learn`);
    } catch (err: any) {
      setError(err.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (error && !meta) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f7' }}>
        <div style={{ textAlign: 'center', color: '#8e8e93' }}>
          <h2 style={{ fontSize: 22, color: '#1a1a2e', marginBottom: 8 }}>Lesson not found</h2>
          <p>This lesson may have been unpublished or the URL is incorrect.</p>
        </div>
      </div>
    );
  }

  if (!meta) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f5f5f7' }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 420, width: '100%',
        border: '1px solid #e5e5ea', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📚</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{meta.lesson.title}</h2>
        <p style={{ fontSize: 14, color: '#8e8e93', marginBottom: 24 }}>
          By {meta.trainer.displayName} · ~{meta.lesson.estimatedMinutes ?? '?'} min · Self-paced
        </p>

        {meta.lesson.description && (
          <div style={{
            background: '#f5f5f7', borderRadius: 8, padding: 12, marginBottom: 24,
            fontSize: 13, color: '#636366', textAlign: 'left',
          }}>
            <strong>What you'll learn:</strong><br />
            {meta.lesson.description}
          </div>
        )}

        <div style={{ textAlign: 'left', marginBottom: 16 }}>
          <label style={labelStyle}>Full name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marie Dupont" required
            style={inputStyle}
          />
        </div>

        <div style={{ textAlign: 'left', marginBottom: 16 }}>
          <label style={labelStyle}>Email address</label>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. marie@example.com" required
            style={inputStyle}
          />
        </div>

        {error && <p style={{ color: '#c53030', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{
          width: '100%', background: '#6c5ce7', color: '#fff', border: 'none', padding: 14,
          borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8,
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Starting...' : 'Start lesson →'}
        </button>

        <p style={{ fontSize: 11, color: '#aeaeb2', marginTop: 16 }}>
          Your progress will be tracked so your trainer can see your results.
        </p>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#636366', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #e5e5ea', borderRadius: 8, fontSize: 14 };

const API_BASE = '/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('trainer_token') || localStorage.getItem('learner_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error ?? 'Request failed', res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// Trainer API
export const api = {
  // Auth
  getMe: () => request<{ trainer: any }>('/auth/me'),

  // Lessons
  listLessons: () => request<{ lessons: any[] }>('/lessons'),
  createLesson: (data: { title: string; description?: string; estimatedMinutes?: number }) =>
    request<{ lesson: any }>('/lessons', { method: 'POST', body: JSON.stringify(data) }),
  getLesson: (id: string) => request<{ lesson: any; blocks: any[] }>(`/lessons/${id}`),
  updateLesson: (id: string, data: any) =>
    request<{ lesson: any }>(`/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLesson: (id: string) => request(`/lessons/${id}`, { method: 'DELETE' }),
  publishLesson: (id: string) => request<{ lesson: any }>(`/lessons/${id}/publish`, { method: 'POST' }),
  unpublishLesson: (id: string) => request<{ lesson: any }>(`/lessons/${id}/unpublish`, { method: 'POST' }),

  // Blocks
  listBlocks: (lessonId: string) => request<{ blocks: any[] }>(`/lessons/${lessonId}/blocks`),
  createBlock: (lessonId: string, data: any) =>
    request<{ block: any }>(`/lessons/${lessonId}/blocks`, { method: 'POST', body: JSON.stringify(data) }),
  updateBlock: (lessonId: string, blockId: string, data: any) =>
    request<{ block: any }>(`/lessons/${lessonId}/blocks/${blockId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBlock: (lessonId: string, blockId: string) =>
    request(`/lessons/${lessonId}/blocks/${blockId}`, { method: 'DELETE' }),
  reorderBlocks: (lessonId: string, blockIds: string[]) =>
    request(`/lessons/${lessonId}/blocks/reorder`, { method: 'PUT', body: JSON.stringify({ blockIds }) }),

  // Dashboard
  getDashboardStats: () => request<any>('/dashboard/stats'),
  getLessonLearners: (lessonId: string, page = 1) =>
    request<{ learners: any[]; pagination: any }>(`/lessons/${lessonId}/learners?page=${page}`),

  // Import
  listPresentations: () => request<{ presentations: any[] }>('/import/presentations'),
  importPresentation: (presentationId: string, lessonId?: string) =>
    request<{ lessonId: string; imported: number; warnings: string[] }>(
      `/import/presentations/${presentationId}`,
      { method: 'POST', body: JSON.stringify({ lessonId }) },
    ),
};

// Learner API (public)
export const learnerApi = {
  getLessonMeta: (trainerSlug: string, lessonSlug: string) =>
    request<{ lesson: any; trainer: any }>(`/public/${trainerSlug}/${lessonSlug}`),

  register: (trainerSlug: string, lessonSlug: string, data: { name: string; email: string }) =>
    request<{ token: string; enrollment: any; lesson: any; blocks: any[]; progress: any[]; quizResponses: any[] }>(
      `/public/${trainerSlug}/${lessonSlug}/register`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  getProgress: () => request<{ enrollment: any; progress: any[]; quizResponses: any[] }>('/learner/progress'),
  completeBlock: (blockId: string) => request('/learner/blocks/' + blockId + '/complete', { method: 'POST' }),
  submitQuiz: (blockId: string, data: { questionId: string; selectedOptionId: string }) =>
    request<{ isCorrect: boolean; explanation?: string }>(`/learner/blocks/${blockId}/quiz`, { method: 'POST', body: JSON.stringify(data) }),
  completeLesson: () => request('/learner/complete', { method: 'POST' }),
};

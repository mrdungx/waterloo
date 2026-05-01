import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.js';
import { LessonEditor } from './pages/LessonEditor.js';
import { LessonView } from './pages/LessonView.js';
import { Register } from './pages/Register.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Trainer routes */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/lessons/:lessonId" element={<LessonEditor />} />

        {/* Learner routes (public) */}
        <Route path="/:trainerSlug/:lessonSlug" element={<Register />} />
        <Route path="/:trainerSlug/:lessonSlug/learn" element={<LessonView />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);

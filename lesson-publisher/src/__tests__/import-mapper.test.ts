import { describe, it, expect } from 'vitest';
import { mapPresentation, type AhaSlidesSlide } from '../services/import-mapper.js';

describe('mapPresentation', () => {
  it('maps heading slides to text blocks', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'heading', content: { text: 'Welcome to the course' }, position: 0 },
    ];

    const { blocks, warnings } = mapPresentation(slides);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].content).toEqual({ html: '<h2>Welcome to the course</h2>' });
    expect(blocks[0].position).toBe(0);
    expect(warnings).toHaveLength(0);
  });

  it('maps paragraph slides to text blocks', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'paragraph', content: { text: 'Some content', title: 'Intro' }, position: 0 },
    ];

    const { blocks } = mapPresentation(slides);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].title).toBe('Intro');
    expect(blocks[0].content).toEqual({ html: '<p>Some content</p>' });
  });

  it('maps image slides to image blocks', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'image', content: { url: 'https://img.example.com/photo.jpg', alt: 'A photo', caption: 'My photo' }, position: 0 },
    ];

    const { blocks } = mapPresentation(slides);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('image');
    expect(blocks[0].content).toEqual({
      url: 'https://img.example.com/photo.jpg',
      alt: 'A photo',
      caption: 'My photo',
    });
  });

  it('maps video slides and detects provider', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'video', content: { url: 'https://www.youtube.com/watch?v=abc', title: 'Tutorial' }, position: 0 },
      { type: 'video', content: { url: 'https://www.loom.com/share/xyz' }, position: 1 },
      { type: 'video', content: { url: 'https://vimeo.com/123' }, position: 2 },
    ];

    const { blocks } = mapPresentation(slides);

    expect(blocks).toHaveLength(3);
    expect((blocks[0].content as any).provider).toBe('youtube');
    expect((blocks[1].content as any).provider).toBe('loom');
    expect((blocks[2].content as any).provider).toBe('vimeo');
  });

  it('maps multiple_choice slides to quiz blocks', () => {
    const slides: AhaSlidesSlide[] = [
      {
        type: 'multiple_choice',
        content: {
          question: 'What is 2+2?',
          options: [
            { text: '3', is_correct: false },
            { text: '4', is_correct: true },
            { text: '5', is_correct: false },
          ],
          explanation: 'Basic math',
        },
        position: 0,
      },
    ];

    const { blocks } = mapPresentation(slides);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quiz');
    const content = blocks[0].content as any;
    expect(content.questions).toHaveLength(1);
    expect(content.questions[0].text).toBe('What is 2+2?');
    expect(content.questions[0].options).toHaveLength(3);
    expect(content.questions[0].options[1].is_correct).toBe(true);
    expect(content.questions[0].explanation).toBe('Basic math');
  });

  it('converts live-only types to text blocks with warning', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'poll', content: { title: 'How do you feel?', text: 'Rate your mood' }, position: 0 },
      { type: 'word_cloud', content: { title: 'Key words' }, position: 1 },
      { type: 'open_ended', content: { title: 'Your thoughts' }, position: 2 },
    ];

    const { blocks, warnings } = mapPresentation(slides);

    expect(blocks).toHaveLength(3);
    blocks.forEach((b) => {
      expect(b.type).toBe('text');
      expect((b.content as any).html).toContain('live');
    });
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain('poll');
    expect(warnings[1]).toContain('word_cloud');
  });

  it('skips spinner_wheel and leaderboard with warnings', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'spinner_wheel', content: {}, position: 0 },
      { type: 'leaderboard', content: {}, position: 1 },
      { type: 'heading', content: { text: 'After skipped' }, position: 2 },
    ];

    const { blocks, warnings } = mapPresentation(slides);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toEqual({ html: '<h2>After skipped</h2>' });
    expect(blocks[0].position).toBe(0); // re-numbered after skips
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('spinner_wheel');
    expect(warnings[1]).toContain('leaderboard');
  });

  it('handles empty presentation', () => {
    const { blocks, warnings } = mapPresentation([]);

    expect(blocks).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('handles mixed slide types and maintains correct positions', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'heading', content: { text: 'Title' }, position: 0 },
      { type: 'spinner_wheel', content: {}, position: 1 }, // skipped
      { type: 'paragraph', content: { text: 'Body' }, position: 2 },
      { type: 'poll', content: { title: 'Vote' }, position: 3 }, // converted
      { type: 'multiple_choice', content: { question: 'Q?', options: [{ text: 'A', is_correct: true }] }, position: 4 },
    ];

    const { blocks, warnings } = mapPresentation(slides);

    expect(blocks).toHaveLength(4);
    expect(blocks.map((b) => b.position)).toEqual([0, 1, 2, 3]);
    expect(blocks.map((b) => b.type)).toEqual(['text', 'text', 'text', 'quiz']);
    expect(warnings).toHaveLength(2); // 1 skipped + 1 converted
  });

  it('handles unknown slide types gracefully', () => {
    const slides: AhaSlidesSlide[] = [
      { type: 'some_future_type', content: { text: 'Future' }, position: 0 },
    ];

    const { blocks, warnings } = mapPresentation(slides);

    expect(blocks).toHaveLength(0);
    expect(warnings).toHaveLength(0); // unknown types silently skipped
  });
});

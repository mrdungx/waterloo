import { describe, it, expect } from 'vitest';
import sanitizeHtml from 'sanitize-html';

describe('HTML sanitization for text blocks', () => {
  it('allows basic formatting tags', () => {
    const html = '<p>Hello <strong>world</strong> and <em>italic</em></p>';
    const result = sanitizeHtml(html);
    expect(result).toBe('<p>Hello <strong>world</strong> and <em>italic</em></p>');
  });

  it('allows lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<li>Item 1</li>');
  });

  it('allows headings', () => {
    const html = '<h2>Section Title</h2><h3>Subsection</h3>';
    const result = sanitizeHtml(html);
    expect(result).toContain('<h2>');
    expect(result).toContain('<h3>');
  });

  it('allows links with href', () => {
    const html = '<a href="https://example.com">Click here</a>';
    const result = sanitizeHtml(html);
    expect(result).toContain('href="https://example.com"');
  });

  it('strips script tags', () => {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('strips event handlers', () => {
    const html = '<p onmouseover="alert(1)">Hover me</p>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('onmouseover');
  });

  it('strips iframe tags', () => {
    const html = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('<iframe');
  });

  it('strips javascript: URLs in links', () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain('javascript:');
  });

  it('handles empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles plain text without tags', () => {
    const text = 'Just plain text with no HTML';
    expect(sanitizeHtml(text)).toBe(text);
  });
});

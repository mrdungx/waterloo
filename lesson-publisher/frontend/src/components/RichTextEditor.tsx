import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start typing...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync content when switching between blocks
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  if (!editor) return null;

  return (
    <div>
      <div style={toolbarStyle}>
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="B" style={{ fontWeight: 700 }} />
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" style={{ fontStyle: 'italic' }} />
        <span style={dividerStyle} />
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" />
        <ToolBtn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" />
        <span style={dividerStyle} />
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="•" />
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1." />
        <span style={dividerStyle} />
        <ToolBtn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="❝" />
        <ToolBtn active={false} onClick={() => {
          const url = window.prompt('URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} label="🔗" />
      </div>
      <EditorContent editor={editor} style={editorStyle} />
      <style>{tiptapCSS}</style>
    </div>
  );
}

function ToolBtn({ active, onClick, label, style }: { active: boolean; onClick: () => void; label: string; style?: React.CSSProperties }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: '4px 8px', border: 'none', borderRadius: 4, cursor: 'pointer',
        fontSize: 13, fontFamily: 'inherit',
        background: active ? '#6c5ce7' : 'transparent',
        color: active ? '#fff' : '#636366',
        ...style,
      }}
    >{label}</button>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px',
  background: '#fafafa', borderRadius: '8px 8px 0 0', border: '1px solid #e5e5ea', borderBottom: 'none',
};

const dividerStyle: React.CSSProperties = {
  width: 1, height: 20, background: '#e5e5ea', margin: '0 4px',
};

const editorStyle: React.CSSProperties = {
  border: '1px solid #e5e5ea', borderRadius: '0 0 8px 8px', minHeight: 200,
};

const tiptapCSS = `
.tiptap { padding: 16px; outline: none; font-size: 14px; line-height: 1.6; color: #1a1a2e; }
.tiptap p { margin: 0 0 8px; }
.tiptap h2 { font-size: 20px; font-weight: 700; margin: 16px 0 8px; }
.tiptap h3 { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
.tiptap ul, .tiptap ol { padding-left: 24px; margin: 0 0 8px; }
.tiptap li { margin: 2px 0; }
.tiptap blockquote { border-left: 3px solid #6c5ce7; padding-left: 12px; margin: 8px 0; color: #636366; }
.tiptap a { color: #6c5ce7; text-decoration: underline; }
.tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #aeaeb2; pointer-events: none; float: left; height: 0; }
.tiptap:focus-within { border-color: #6c5ce7; box-shadow: 0 0 0 3px rgba(108,92,231,0.1); border-radius: 0 0 8px 8px; }
`;

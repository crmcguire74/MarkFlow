import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useEffect } from 'react';

interface WysiwygEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function WysiwygEditor({ content, onChange, onEditorReady }: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Markdown,
    ],
    content,
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none markdown-body p-8 absolute inset-0 overflow-y-auto w-full h-full text-slate-800',
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && content !== (editor.storage as any).markdown.getMarkdown()) {
      // Avoid circular updates by checking if content differs from current markdown
      // Unfortunately setContent resets cursor, but we only do this when content prop changes from outside (e.g. file open)
      // A better way is to do it delicately, but for now we'll do:
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return <EditorContent editor={editor} className="w-full h-full" />;
}

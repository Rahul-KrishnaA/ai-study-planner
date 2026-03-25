import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import type { Note } from '../types/notes';

interface NoteEditorProps {
  note?: Note | null;
  subjectId: string;
  subjectName: string;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

export function NoteEditor({ note, subjectId, subjectName, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note]);

  function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    const now = new Date().toISOString();
    const saved: Note = {
      id: note?.id ?? crypto.randomUUID(),
      subjectId,
      title: title.trim(),
      content: content.trim(),
      createdAt: note?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-app-dark dark:text-white">
            {note ? 'Edit Note' : 'New Note'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-primary font-semibold mb-3">{subjectName}</p>

        <input
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Note title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(''); }}
        />

        <textarea
          className="w-full flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Write your notes here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} className="flex-grow">{note ? 'Update' : 'Save Note'}</Button>
        </div>
      </div>
    </div>
  );
}

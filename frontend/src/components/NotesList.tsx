import { useState } from 'react';
import { FileText, Plus, Trash2, Edit3 } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { useApp } from '../context/AppContext';
import type { Note } from '../types/notes';

interface NotesListProps {
  subjectId: string;
  subjectName: string;
}

export function NotesList({ subjectId, subjectName }: NotesListProps) {
  const { notes, addNote, updateNote, deleteNote } = useApp();
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const subjectNotes = notes
    .filter((n) => n.subjectId === subjectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  function handleSave(note: Note) {
    if (editingNote) {
      updateNote(note.id, { title: note.title, content: note.content });
    } else {
      addNote(note);
    }
    setEditingNote(null);
    setShowEditor(false);
  }

  function handleEdit(note: Note) {
    setEditingNote(note);
    setShowEditor(true);
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Notes ({subjectNotes.length})
        </p>
        <button
          onClick={() => { setEditingNote(null); setShowEditor(true); }}
          className="text-xs text-primary font-semibold flex items-center gap-1"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {subjectNotes.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No notes yet. Tap &quot;Add&quot; to create one.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {subjectNotes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app-dark dark:text-white truncate">{note.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{note.content}</p>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(note)} className="p-1 text-gray-400 hover:text-primary">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => deleteNote(note.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <NoteEditor
          note={editingNote}
          subjectId={subjectId}
          subjectName={subjectName}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
}

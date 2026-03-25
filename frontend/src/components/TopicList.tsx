import { useState } from 'react';
import { Plus, X, Circle, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Topic } from '../types';

const STATUS_ICONS = {
  not_started: <Circle size={14} className="text-gray-400" />,
  in_progress: <Clock size={14} className="text-yellow-500" />,
  completed: <CheckCircle2 size={14} className="text-green-500" />,
};

const STATUS_CYCLE: Record<Topic['status'], Topic['status']> = {
  not_started: 'in_progress',
  in_progress: 'completed',
  completed: 'not_started',
};

interface TopicListProps {
  subjectId: string;
}

export function TopicList({ subjectId }: TopicListProps) {
  const { profile, addTopic, updateTopic, removeTopic } = useApp();
  const [newTopicName, setNewTopicName] = useState('');
  const [adding, setAdding] = useState(false);

  const detail = profile?.subjectDetails.find((d) => d.id === subjectId);
  const topics = detail?.topics ?? [];

  function handleAdd() {
    const name = newTopicName.trim();
    if (!name) return;
    addTopic(subjectId, { id: crypto.randomUUID(), name, status: 'not_started' });
    setNewTopicName('');
    setAdding(false);
  }

  function cycleStatus(topic: Topic) {
    updateTopic(subjectId, topic.id, { status: STATUS_CYCLE[topic.status] });
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary font-semibold"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-2">
          <input
            autoFocus
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Topic name"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
          />
          <button onClick={handleAdd} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-semibold">
            Add
          </button>
        </div>
      )}

      {topics.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic">No topics yet — add chapters or units.</p>
      )}

      <div className="flex flex-col gap-1">
        {topics.map((topic) => (
          <div key={topic.id} className="flex items-center gap-2 py-1 group">
            <button onClick={() => cycleStatus(topic)} className="flex-shrink-0">
              {STATUS_ICONS[topic.status]}
            </button>
            <span className={`flex-1 text-sm ${topic.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {topic.name}
            </span>
            <button
              onClick={() => removeTopic(subjectId, topic.id)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

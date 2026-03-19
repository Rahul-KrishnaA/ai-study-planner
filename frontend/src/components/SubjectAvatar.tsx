const SUBJECT_COLORS = [
  '#6C47FF', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
];

export function getSubjectColor(subject: string, allSubjects: string[]): string {
  const idx = allSubjects.indexOf(subject);
  if (idx >= 0) return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  // hash fallback
  let hash = 0;
  for (const c of subject) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

interface SubjectAvatarProps {
  subject: string;
  allSubjects?: string[];
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function SubjectAvatar({ subject, allSubjects = [], size = 'md', color }: SubjectAvatarProps) {
  const bgColor = color ?? getSubjectColor(subject, allSubjects);
  const sizes = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-base', lg: 'w-12 h-12 text-lg' };
  return (
    <div
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ backgroundColor: bgColor }}
    >
      {subject.charAt(0).toUpperCase()}
    </div>
  );
}

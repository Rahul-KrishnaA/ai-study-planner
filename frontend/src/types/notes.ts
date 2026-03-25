export interface Note {
  id: string;
  subjectId: string;
  title: string;
  content: string; // markdown
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

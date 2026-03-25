import { useState } from 'react';
import { Download, FileText, Image, Database } from 'lucide-react';
import type { StudyPlan, UserProfile } from '../types';

interface ExportMenuProps {
  timetableRef: React.RefObject<HTMLDivElement>;
  plan: StudyPlan;
  profile: UserProfile;
}

export function ExportMenu({ timetableRef, plan, profile }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportPDF() {
    if (!timetableRef.current) return;
    setExporting('pdf');
    setOpen(false);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(timetableRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`study-plan-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('PDF export failed. Please try again.');
    }
    setExporting(null);
  }

  async function exportImage() {
    if (!timetableRef.current) return;
    setExporting('image');
    setOpen(false);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(timetableRef.current, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `study-plan-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Image export failed', err);
      alert('Image export failed. Please try again.');
    }
    setExporting(null);
  }

  function exportJSON() {
    setOpen(false);
    const data = { profile, plan, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `study-plan-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!exporting}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
      >
        <Download size={16} />
        {exporting ? 'Exporting...' : 'Export'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
            <button
              onClick={exportPDF}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <FileText size={14} className="text-primary" /> Export PDF
            </button>
            <button
              onClick={exportImage}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Image size={14} className="text-primary" /> Export Image
            </button>
            <button
              onClick={exportJSON}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Database size={14} className="text-primary" /> JSON Backup
            </button>
          </div>
        </>
      )}
    </div>
  );
}

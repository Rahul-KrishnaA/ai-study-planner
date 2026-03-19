import { useState } from 'react';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

interface UserInfoPageProps {
  initialField: string;
  initialInstitution: string;
  initialSemester: string;
  onNext: (field: string, institution: string, semester: string) => void;
  onBack: () => void;
  step: number;
  totalSteps: number;
}

export function UserInfoPage({ initialField, initialInstitution, initialSemester, onNext, onBack, step, totalSteps }: UserInfoPageProps) {
  const [field, setField] = useState(initialField);
  const [institution, setInstitution] = useState(initialInstitution);
  const [semester, setSemester] = useState(initialSemester);
  const [errors, setErrors] = useState<{ field?: string }>({});

  function handleNext() {
    if (!field.trim()) { setErrors({ field: 'Please enter what you are studying' }); return; }
    onNext(field.trim(), institution.trim(), semester.trim());
  }

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8 bg-app-bg dark:bg-gray-950">
      <div className="flex gap-2 mb-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1 rounded-full flex-1 transition-all ${i < step ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`} />
        ))}
      </div>

      <h2 className="text-2xl font-bold text-app-dark dark:text-white mb-2">Academic Info</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">Tell us about your studies for a better schedule.</p>

      <div className="flex flex-col gap-5 flex-1">
        <Input
          label="What are you studying?"
          placeholder="e.g. Computer Science, Medicine, Law"
          value={field}
          onChange={(e) => { setField(e.target.value); setErrors({}); }}
          error={errors.field}
          autoFocus
        />
        <Input
          label="Institution (optional)"
          placeholder="e.g. MIT, Harvard, City College"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        />
        <Input
          label="Semester / Year (optional)"
          placeholder="e.g. Semester 3, Year 2"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        />
      </div>

      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={handleNext} className="flex-grow">Next</Button>
      </div>
    </div>
  );
}

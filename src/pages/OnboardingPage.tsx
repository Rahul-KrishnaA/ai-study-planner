import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WelcomePage } from './onboarding/WelcomePage';
import { UserInfoPage } from './onboarding/UserInfoPage';
import { SubjectsPage } from './onboarding/SubjectsPage';
import { PreferencesPage } from './onboarding/PreferencesPage';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { generateStudyPlan } from '../services/lmstudio';
import type { UserProfile, SubjectDetail } from '../types';

const TOTAL_STEPS = 4;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setProfile, setPlan } = useApp();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [studyField, setStudyField] = useState('');
  const [institution, setInstitution] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectDetails, setSubjectDetails] = useState<SubjectDetail[]>([]);
  const [preferredTime, setPreferredTime] = useState<UserProfile['preferredTime']>('morning');
  const [dailyGoal, setDailyGoal] = useState(3);

  async function handleFinish(time: UserProfile['preferredTime'], goal: number) {
    if (!user) return;
    setPreferredTime(time);
    setDailyGoal(goal);
    setLoading(true);

    const profile: UserProfile = {
      name: user.name,
      email: user.email,
      studyField,
      institution: institution || undefined,
      semester: semester || undefined,
      subjects: subjectDetails.map((s) => s.name),
      subjectDetails,
      preferredTime: time,
      dailyGoalHours: goal,
    };

    setProfile(profile);

    try {
      const plan = await generateStudyPlan(profile, user.id);
      setPlan(plan);
    } catch {
      // generateStudyPlan already falls back to local plan
    }

    setLoading(false);
    navigate('/home');
  }

  return (
    <>
      {step === 0 && <WelcomePage onNext={() => setStep(1)} />}
      {step === 1 && (
        <UserInfoPage
          initialField={studyField}
          initialInstitution={institution}
          initialSemester={semester}
          onNext={(f, inst, sem) => { setStudyField(f); setInstitution(inst); setSemester(sem); setStep(2); }}
          onBack={() => setStep(0)}
          step={2}
          totalSteps={TOTAL_STEPS}
        />
      )}
      {step === 2 && (
        <SubjectsPage
          initialSubjects={subjectDetails}
          onNext={(s) => { setSubjectDetails(s); setStep(3); }}
          onBack={() => setStep(1)}
          step={3}
          totalSteps={TOTAL_STEPS}
        />
      )}
      {step === 3 && (
        <PreferencesPage
          initialTime={preferredTime}
          initialGoal={dailyGoal}
          onFinish={handleFinish}
          onBack={() => setStep(2)}
          loading={loading}
          step={4}
          totalSteps={TOTAL_STEPS}
        />
      )}
    </>
  );
}

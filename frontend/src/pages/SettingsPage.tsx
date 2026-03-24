import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Moon, Sun, Trash2, Save, Bell, BellOff, Eye, EyeOff, LogOut, Lock } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, getNotificationPermission } from '../services/notifications';
import { generateStudyPlan } from '../services/lmstudio';
import type { AuthError } from '../context/AuthContext';

export function SettingsPage() {
  const navigate = useNavigate();
  const { profile, settings, setProfile, updateSettings, resetAll, setPlan } = useApp();
  const { user, logout, updateName, changeUserPassword } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [institution, setInstitution] = useState(profile?.institution ?? '');
  const [semester, setSemester] = useState(profile?.semester ?? '');
  const [nameSaved, setNameSaved] = useState(false);

  // Password change
  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const notifPermission = getNotificationPermission();

  async function handleSaveProfile() {
    if (!profile || !user) return;
    await updateName(name.trim() || user.name);
    setProfile({ ...profile, name: name.trim() || user.name, institution: institution.trim() || undefined, semester: semester.trim() || undefined });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function handleChangePassword() {
    setPwError('');
    if (!newPw || newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    try {
      await changeUserPassword(currentPw, newPw);
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => { setPwSuccess(false); setShowPwSection(false); }, 2000);
    } catch (err) {
      const ae = err as AuthError;
      setPwError(ae.message);
    }
  }

  async function handleToggleReminders() {
    if (!settings.remindersEnabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('Please allow notifications in your browser settings.');
        return;
      }
    }
    updateSettings({ remindersEnabled: !settings.remindersEnabled });
  }

  async function handleRegenerate() {
    if (!profile || !user) return;
    setRegenerating(true);
    setRegenStatus('idle');
    try {
      const newPlan = await generateStudyPlan(profile);
      setPlan(newPlan);
      setRegenStatus('success');
    } catch {
      setRegenStatus('error');
    } finally {
      setRegenerating(false);
      setTimeout(() => setRegenStatus('idle'), 3000);
    }
  }

  function handleReset() {
    resetAll();
    logout();
    navigate('/login');
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-app-dark dark:text-white">Settings</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors">
            <LogOut size={16} /> Sign out
          </button>
        </div>

        {/* Account / Profile */}
        <Card className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Profile</p>
          {user && <p className="text-xs text-gray-400 mb-3">{user.email}</p>}
          <div className="flex flex-col gap-3">
            <Input label="Display Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Input label="Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. MIT" />
            <Input label="Semester / Year" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. Semester 3" />
          </div>
          <Button onClick={handleSaveProfile} size="sm" className="mt-3 flex items-center gap-1.5" variant={nameSaved ? 'secondary' : 'primary'}>
            <Save size={14} /> {nameSaved ? 'Saved!' : 'Save Changes'}
          </Button>
        </Card>

        {/* Password change */}
        <Card className="mb-4">
          <button
            className="flex items-center justify-between w-full"
            onClick={() => setShowPwSection((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-primary" />
              <span className="text-sm font-medium text-app-dark dark:text-white">Change Password</span>
            </div>
            <span className="text-xs text-primary">{showPwSection ? 'Cancel' : 'Edit'}</span>
          </button>
          {showPwSection && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="relative">
                <Input
                  label="Current Password"
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Current password"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-9 text-gray-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Input
                label="New Password"
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min 8 characters"
              />
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
              {pwSuccess && <p className="text-xs text-green-500">Password changed successfully!</p>}
              <Button onClick={handleChangePassword} size="sm">Update Password</Button>
            </div>
          )}
        </Card>

        {/* AI Engine */}
        <Card className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">AI Engine</p>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-app-dark dark:text-white">Gemini 2.5 Flash</span>
          </div>
          <p className="text-xs text-gray-400">Powered by Google Gemini AI. Plan generation uses AI when available, with local fallback.</p>
          {profile && (
            <Button onClick={handleRegenerate} size="sm" className="mt-3" loading={regenerating} variant={regenStatus === 'success' ? 'secondary' : 'primary'}>
              {regenStatus === 'success' ? 'Plan Updated!' : regenStatus === 'error' ? 'Failed — Retry' : 'Regenerate Plan'}
            </Button>
          )}
        </Card>

        {/* App Preferences */}
        <Card className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Preferences</p>

          {/* Dark mode */}
          <button onClick={() => updateSettings({ darkMode: !settings.darkMode })} className="flex items-center justify-between w-full mb-4">
            <div className="flex items-center gap-3">
              {settings.darkMode ? <Moon size={18} className="text-primary" /> : <Sun size={18} className="text-primary" />}
              <span className="text-sm font-medium text-app-dark dark:text-white">Dark Mode</span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${settings.darkMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>

          {/* Reminders */}
          <button onClick={handleToggleReminders} className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {settings.remindersEnabled ? <Bell size={18} className="text-primary" /> : <BellOff size={18} className="text-primary" />}
              <div className="text-left">
                <span className="text-sm font-medium text-app-dark dark:text-white block">Session Reminders</span>
                {notifPermission === 'denied' && (
                  <span className="text-xs text-red-400">Blocked in browser settings</span>
                )}
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${settings.remindersEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.remindersEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>

          {settings.remindersEnabled && (
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500">Remind me before session</span>
                <span className="text-xs font-semibold text-primary">{settings.reminderMinutesBefore} min</span>
              </div>
              <input
                type="range" min={5} max={60} step={5}
                value={settings.reminderMinutesBefore}
                onChange={(e) => updateSettings({ reminderMinutesBefore: Number(e.target.value) })}
                className="w-full cursor-pointer"
                style={{ accentColor: '#6C47FF' }}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5 min</span><span>60 min</span>
              </div>
            </div>
          )}
        </Card>

        {/* Danger Zone */}
        <Card className="mb-6">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3">Danger Zone</p>
          {!showResetConfirm ? (
            <Button variant="danger" size="sm" onClick={() => setShowResetConfirm(true)} className="flex items-center gap-1.5">
              <Trash2 size={14} /> Reset All Data
            </Button>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                This deletes all your study data and signs you out. Your account remains — just your plan and sessions are cleared.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(false)} className="flex-1">Cancel</Button>
                <Button variant="danger" size="sm" onClick={handleReset} className="flex-1">Yes, Reset</Button>
              </div>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400">AI Study Planner v1.0.0</p>
      </div>
      <BottomNav />
    </div>
  );
}

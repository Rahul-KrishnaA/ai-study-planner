import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Check, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import type { AuthError } from '../../context/AuthContext';

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Contains uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Contains number', test: (pw) => /\d/.test(pw) },
];

export function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const pwValid = PASSWORD_RULES.every((r) => r.test(password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    if (!pwValid) errs.password = 'Password does not meet requirements';
    if (password !== confirmPw) errs.confirmPw = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      const ae = err as AuthError;
      if (ae.field) setErrors({ [ae.field]: ae.message });
      else setErrors({ general: ae.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <BookOpen size={30} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-app-dark dark:text-white">Create account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start your personalized study journey</p>
        </div>

        {errors.general && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Full Name"
            placeholder="Alex Johnson"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
            error={errors.name}
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
            error={errors.email}
            autoComplete="email"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
              error={errors.password}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Password rules */}
          {password.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 flex flex-col gap-1.5">
              {PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password);
                return (
                  <div key={rule.label} className="flex items-center gap-2">
                    {ok ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-gray-400" />}
                    <span className={`text-xs ${ok ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {rule.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <Input
            label="Confirm Password"
            type={showPw ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirmPw}
            onChange={(e) => { setConfirmPw(e.target.value); setErrors((p) => ({ ...p, confirmPw: '' })); }}
            error={errors.confirmPw}
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

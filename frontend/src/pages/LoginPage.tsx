import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

type TabType = 'login' | 'register';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(loginEmail, loginPassword);
      // If there's a gameId, redirect to game instead of lobby
      if (gameId) {
        navigate(`/game/${gameId}`);
      } else {
        navigate('/lobby');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Trim inputs to match backend validation
    const trimmedUsername = regUsername.trim();
    const trimmedEmail = regEmail.trim();
    const trimmedDisplayName = regDisplayName.trim();
    const trimmedPassword = regPassword.trim();
    const trimmedConfirmPassword = regConfirmPassword.trim();

    // Validation
    if (trimmedPassword !== trimmedConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (trimmedDisplayName.length < 2) {
      setError('Display name must be at least 2 characters');
      return;
    }

    // Warn about accidental whitespace in passwords
    if (regPassword !== trimmedPassword || regConfirmPassword !== trimmedConfirmPassword) {
      setError('Password contains leading or trailing spaces. Please remove them.');
      return;
    }

    setLoading(true);

    try {
      await register({
        username: trimmedUsername,
        email: trimmedEmail || undefined,
        password: trimmedPassword,
        displayName: trimmedDisplayName,
      });
      // If there's a gameId, redirect to game instead of lobby
      if (gameId) {
        navigate(`/game/${gameId}`);
      } else {
        navigate('/lobby');
      }
    } catch (err) {
      // Extract error message from the error object
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      console.error('Registration error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]" />
        <div className="absolute -left-1/4 top-1/3 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div
        className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8"
        style={{
          paddingTop: `calc(3rem + env(safe-area-inset-top, 0px))`,
          paddingBottom: `calc(3rem + env(safe-area-inset-bottom, 0px))`
        }}
      >
        <div className="w-full max-w-md">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 sm:text-5xl">Buck Euchre</h1>
          </div>

          <div className="rounded-[32px] border border-white/15 bg-white/10 p-6 shadow-[0_30px_80px_-45px_rgba(16,185,129,0.85)] backdrop-blur">
          {/* Tabs */}
          <div className="flex mb-6 bg-white/5 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'login'
                  ? 'bg-white/10 text-emerald-300 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setError('');
              }}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'register'
                  ? 'bg-white/10 text-emerald-300 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/50 rounded-md">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-200 mb-1">
                  Email or Username
                </label>
                <input
                  id="login-email"
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Enter your email or username"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-200 mb-1">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-username" className="block text-sm font-medium text-slate-200 mb-1">
                  Username *
                </label>
                <input
                  id="reg-username"
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  onBlur={(e) => setRegUsername(e.target.value.trim())}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Choose a username"
                  required
                  disabled={loading}
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  title="Username can only contain letters, numbers, and underscores"
                />
                <p className="text-xs text-slate-400 mt-1">3-20 characters, letters, numbers, and underscores only</p>
              </div>

              <div>
                <label htmlFor="reg-display-name" className="block text-sm font-medium text-slate-200 mb-1">
                  Display Name *
                </label>
                <input
                  id="reg-display-name"
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  onBlur={(e) => setRegDisplayName(e.target.value.trim())}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Your display name"
                  required
                  disabled={loading}
                  minLength={2}
                  maxLength={30}
                />
                <p className="text-xs text-slate-400 mt-1">2-30 characters, how other players will see you</p>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-slate-200 mb-1">
                  Email (optional)
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  onBlur={(e) => setRegEmail(e.target.value.trim())}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="your@email.com"
                  disabled={loading}
                />
                <p className="text-xs text-slate-400 mt-1">For account recovery (future feature)</p>
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-slate-200 mb-1">
                  Password *
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  onBlur={(e) => setRegPassword(e.target.value.trim())}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Create a password"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-slate-400 mt-1">At least 6 characters</p>
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-slate-200 mb-1">
                  Confirm Password *
                </label>
                <input
                  id="reg-confirm-password"
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  onBlur={(e) => setRegConfirmPassword(e.target.value.trim())}
                  className="w-full px-3 py-2 border border-white/15 bg-white/5 rounded-md text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                  placeholder="Confirm your password"
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          )}

        </div>
        </div>
      </div>
    </div>
  );
}




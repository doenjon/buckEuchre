import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Label } from '@/components/ui/label';

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  isGuest: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetting, setResetting] = useState(false);
  const { checkAuth } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, token } = useAuthStore();

  useEffect(() => {
    if (!checkAuth()) {
      navigate('/login');
      return;
    }

    if (!isAdmin) {
      navigate('/');
      return;
    }

    fetchUsers();
  }, [isAdmin, navigate, checkAuth]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setResetting(true);
      setError('');
      setSuccess('');

      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await fetch(
        `${API_URL}/api/admin/users/${selectedUser.id}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newPassword }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      const data = await response.json();
      setSuccess(`Password reset successfully for ${data.user.username}`);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      console.error('Error resetting password:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-white text-xl">Loading admin panel...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-4xl font-bold text-white mb-8">Admin Panel</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User List */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Users</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => !user.isGuest && setSelectedUser(user)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedUser?.id === user.id
                      ? 'bg-blue-100 border-blue-500'
                      : user.isGuest
                      ? 'bg-gray-50 border-gray-300 opacity-50 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{user.username}</div>
                      <div className="text-sm text-gray-600">{user.displayName}</div>
                      {user.email && <div className="text-xs text-gray-500">{user.email}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {user.isAdmin && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                          Admin
                        </span>
                      )}
                      {user.isGuest && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          Guest
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Password Reset Form */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Reset Password</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
                {success}
              </div>
            )}

            {selectedUser ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label>Selected User</Label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="font-semibold">{selectedUser.username}</div>
                    <div className="text-sm text-gray-600">{selectedUser.displayName}</div>
                    {selectedUser.email && (
                      <div className="text-xs text-gray-500">{selectedUser.email}</div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={resetting} className="flex-1">
                    {resetting ? 'Resetting...' : 'Reset Password'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedUser(null);
                      setNewPassword('');
                      setError('');
                      setSuccess('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                <p className="text-sm text-gray-600 mt-4">
                  Note: This will immediately update the user's password. They will be able to
                  log in with the new password.
                </p>
              </form>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-2">Select a user from the list to reset their password</p>
                <p className="text-sm">(Guest users cannot have passwords)</p>
              </div>
            )}
          </Card>
        </div>

        {/* Future expansion area - designed to be compatible with user-initiated resets */}
        <Card className="mt-6 p-6 border-2 border-dashed border-gray-300 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Future Enhancements</h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• User-initiated password reset via email</li>
            <li>• Password reset tokens and expiration</li>
            <li>• Email verification for new users</li>
            <li>• Audit log of password changes</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

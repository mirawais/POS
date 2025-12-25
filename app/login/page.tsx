"use client";
import { signIn, getSession } from 'next-auth/react';
import { useState } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@amanat.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const { showError } = useToast();

  // Helper function to get role and redirect
  const redirectBasedOnRole = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const session = await getSession();
        if (session && (session as any)?.user?.role) {
          const userRole = (session as any).user.role;

          // Check for callbackUrl from URL params
          const urlParams = new URLSearchParams(window.location.search);
          const callbackUrl = urlParams.get('callbackUrl');
          if (callbackUrl && callbackUrl !== '/login') {
            window.location.href = callbackUrl;
            return;
          }

          // Redirect based on role
          if (userRole === 'SUPER_ADMIN') {
            window.location.href = '/super-admin';
          } else if (userRole === 'ADMIN') {
            window.location.href = '/admin/dashboard';
          } else if (userRole === 'CASHIER') {
            window.location.href = '/cashier/billing';
          } else {
            // Fallback
            window.location.href = '/admin/dashboard';
          }
          return;
        }
      } catch (sessionError) {
        console.error('Session fetch error:', sessionError);
      }

      // Wait before retry
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
      }
    }

    // If all retries fail, redirect to admin (middleware will handle if needed)
    window.location.href = '/admin/dashboard';
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password
      });

      if ((res as any)?.error) {
        showError('Invalid email or password. Please try again.');
      } else if (res?.ok) {
        // Wait a moment for session to be ready, then redirect based on role
        setTimeout(() => {
          redirectBasedOnRole();
        }, 150);
      }
    } catch (err: any) {
      showError(err.message || 'An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-md shadow p-6">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="text-xs mt-3 text-gray-500">Try cashier: cashier@amanat.local / cashier123</p>
    </div>
  );
}


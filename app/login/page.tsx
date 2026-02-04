'use client';
import { signIn, getSession } from 'next-auth/react';
import { useState } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';
import { ShoppingCart, Sparkles } from 'lucide-react';

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
          const userRole = String((session as any).user.role);
          const urlParams = new URLSearchParams(window.location.search);
          const callbackUrl = urlParams.get('callbackUrl');

          if (callbackUrl && callbackUrl !== '/login') {
            if (userRole === 'SUPER_ADMIN') {
              window.location.href = '/super-admin';
              return;
            }
            window.location.href = callbackUrl;
            return;
          }

          if (userRole === 'SUPER_ADMIN') {
            window.location.href = '/super-admin';
          } else if (userRole === 'ADMIN') {
            window.location.href = '/admin/dashboard';
          } else if (userRole === 'MANAGER') {
            window.location.href = '/admin/dashboard';
          } else if (userRole === 'CASHIER') {
            window.location.href = '/cashier/billing';
          } else {
            window.location.href = '/login';
          }
          return;
        }
      } catch (sessionError) {
        console.error('Session fetch error:', sessionError);
      }

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
      }
    }
    window.location.href = '/login';
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
        // NextAuth sometimes wraps errors or returns specific codes
        const errorMsg = (res as any).error;
        console.error("Login Result Error:", errorMsg);

        if (errorMsg.includes('deactivated') || errorMsg.includes('expired') || errorMsg.includes('not yet active')) {
          showError(errorMsg);
        } else if (errorMsg === 'Configuration') {
          // Often happens if check failed with Error object
          showError('Account validation failed. Please check your status.');
        } else {
          // Fallback for generic credential error
          showError('Invalid email or password. Please try again.');
        }
      } else if (res?.ok) {
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
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: 'url("/images/login-background.jpg")',
      }}
    >
      {/* Overlay to darken background slightly for better contrast */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>

      <div className="relative w-full max-w-md p-8 m-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingCart className="w-8 h-8 text-teal-400" />
            <span className="text-2xl font-bold text-white tracking-wide">Amanat POS</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <input
              className="w-full px-4 py-3 bg-white/90 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-teal-400 focus:outline-none transition-all duration-200"
              placeholder="Username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
            <input
              type="password"
              className="w-full px-4 py-3 bg-white/90 border-0 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-teal-400 focus:outline-none transition-all duration-200"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-semibold rounded-lg shadow-lg transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            disabled={loading}
          >
            {loading ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

        {/* Decorative sparkles */}
        <Sparkles className="absolute -bottom-4 -right-4 w-12 h-12 text-teal-400/50 rotate-12" />
      </div>
    </div>
  );
}

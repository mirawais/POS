import NextAuth, { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authConfig: NextAuthOptions = {
  // Use environment variable for base URL, but don't hardcode localhost
  ...(process.env.NEXTAUTH_URL && { baseUrl: process.env.NEXTAUTH_URL }),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) return null;

        // Check Client Status for non-Super Admins
        if (user.role !== 'SUPER_ADMIN' && user.clientId) {
          const client = await prisma.client.findUnique({
            where: { id: user.clientId },
            select: { isActive: true, activeDate: true, inactiveDate: true }
          });

          if (client) {
            const now = new Date();
            const activeDate = client.activeDate ? new Date(client.activeDate) : new Date(0);
            const inactiveDate = client.inactiveDate ? new Date(client.inactiveDate) : null;

            if (!client.isActive) {
              throw new Error("Your organization's account has been deactivated. Please contact support.");
            }

            if (activeDate > now) {
              throw new Error("Your organization's account is not yet active.");
            }

            if (inactiveDate && inactiveDate < now) {
              throw new Error("Your organization's account has expired. Please renew your subscription.");
            }
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          clientId: user.clientId,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        // Ensure role is stored as a string for consistent comparison
        token.role = String((user as any).role);
        token.clientId = (user as any).clientId;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).user.id = token.id;
      // Ensure role is a string for consistent comparison
      (session as any).user.role = String(token.role);
      (session as any).user.clientId = token.clientId;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};

// Helper for server components/middleware to get the session.
export const auth = () => getServerSession(authConfig);

// Route handlers for /api/auth/[...nextauth]
const authHandler = NextAuth(authConfig);
export const GET = authHandler;
export const POST = authHandler;


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
          permissions: user.permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Initial sign in
        token.id = user.id;
        token.role = String(user.role);
        token.clientId = user.clientId;
        token.permissions = user.permissions;
      } else if (token.id) {
        // Subsequent calls - refresh permissions from DB
        // This ensures Manager permissions are updated without re-login
        try {
          const freshUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              permissions: true,
              role: true,
              clientId: true,
              name: true
            }
          });

          if (freshUser) {
            token.permissions = freshUser.permissions;
            token.role = String(freshUser.role);
            token.clientId = freshUser.clientId;
            if (freshUser.name) token.name = freshUser.name;
          }
        } catch (error) {
          console.error("Error refreshing user permissions:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = String(token.role);
        session.user.clientId = token.clientId;
        session.user.permissions = token.permissions;
      }
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


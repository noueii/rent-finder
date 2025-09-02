import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "~/lib/db";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      name: string | null;
    };
  }
  
  interface User {
    id: string;
    email: string;
    username: string;
    name: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    username: string;
    name: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 0, // Always update session
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Disable all caching
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        usernameOrEmail: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.usernameOrEmail || !credentials?.password) {
          return null;
        }

        // Find user by email or username
        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: credentials.usernameOrEmail },
              { username: credentials.usernameOrEmail },
            ],
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Always refresh user data from database
      if (trigger === "update" || trigger === "signIn" || user) {
        if (user) {
          token.id = user.id;
          token.email = user.email;
          token.username = user.username;
          token.name = user.name;
        } else if (token.id) {
          // Refresh from database
          const dbUser = await db.user.findUnique({
            where: { id: token.id },
          });
          if (dbUser) {
            token.email = dbUser.email;
            token.username = dbUser.username;
            token.name = dbUser.name;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.username = token.username;
        session.user.name = token.name;
      }
      return session;
    },
  },
};
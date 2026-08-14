import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const clientId = (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
const clientSecret = (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId,
      clientSecret,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
      checks: ["state"],
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch(`${apiUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            return null;
          }

          const data = await res.json();
          if (!data?.user || !data?.token) {
            return null;
          }

          return {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            token: data.token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "local-dev-secret-key-12345678901234567890",
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
        token.idTokenExpires = (account.expires_at ?? 0) * 1000;
      }
      if (user && (user as any).token) {
        token.idToken = (user as any).token;
      }
      return token;
    },
    async session({ session, token }) {
      session.idToken = token.idToken as string | undefined;
      return session;
    },
  },
  pages: { signIn: "/login" },
});

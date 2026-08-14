import "next-auth";
import "next-auth/jwt";

/**
 * Global augmentation lives in a .d.ts so it applies everywhere without an
 * explicit import -- auth.ts writes session.idToken, api.ts reads it.
 */
declare module "next-auth" {
  interface Session {
    idToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    idToken?: string;
    idTokenExpires?: number;
  }
}

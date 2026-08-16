import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      discordUserId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordUserId?: string;
  }
}

export {};

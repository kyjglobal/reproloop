import type { Account, NextAuthOptions, Session } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";

const AuthEnvironmentSchema = z.strictObject({
  appUrl: z.url(),
  secret: z.string().min(32),
  discordClientId: z.string().regex(/^\d+$/),
  discordClientSecret: z.string().trim().min(1),
});

export type AuthEnvironment = z.infer<typeof AuthEnvironmentSchema>;

const ENVIRONMENT_FIELD_NAMES: Record<keyof AuthEnvironment, string> = {
  appUrl: "APP_URL",
  secret: "AUTH_SECRET",
  discordClientId: "AUTH_DISCORD_ID",
  discordClientSecret: "AUTH_DISCORD_SECRET",
};

export class AuthConfigurationError extends Error {
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`Missing or invalid Auth.js environment variables: ${fields.join(", ")}`);
    this.name = "AuthConfigurationError";
    this.fields = fields;
  }
}

export function readAuthEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthEnvironment {
  const result = AuthEnvironmentSchema.safeParse({
    appUrl: environment.NEXTAUTH_URL || environment.APP_URL,
    secret: environment.AUTH_SECRET,
    discordClientId: environment.AUTH_DISCORD_ID,
    discordClientSecret: environment.AUTH_DISCORD_SECRET,
  });

  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) => {
          const field = issue.path[0] as keyof AuthEnvironment | undefined;
          return field ? ENVIRONMENT_FIELD_NAMES[field] : "Auth.js configuration";
        }),
      ),
    ];

    throw new AuthConfigurationError(fields);
  }

  return result.data;
}

export function persistDiscordUserId(token: JWT, account: Account | null): JWT {
  if (account?.provider !== "discord" || !account.providerAccountId.trim()) {
    return token;
  }

  return {
    ...token,
    discordUserId: account.providerAccountId,
  };
}

export function exposeDiscordUserId(session: Session, token: JWT): Session {
  if (!session.user || typeof token.discordUserId !== "string" || !token.discordUserId.trim()) {
    return session;
  }

  return {
    ...session,
    user: {
      ...session.user,
      discordUserId: token.discordUserId,
    },
  };
}

export function createAuthOptions(environment: AuthEnvironment): NextAuthOptions {
  return {
    secret: environment.secret,
    session: {
      strategy: "jwt",
    },
    providers: [
      DiscordProvider({
        clientId: environment.discordClientId,
        clientSecret: environment.discordClientSecret,
      }),
    ],
    callbacks: {
      jwt({ token, account }) {
        return persistDiscordUserId(token, account);
      },
      session({ session, token }) {
        return exposeDiscordUserId(session, token);
      },
    },
  };
}

export function getAuthOptions(): NextAuthOptions {
  const environment = readAuthEnvironment();

  // NextAuth.js v4 uses NEXTAUTH_URL internally. Reuse the repository's APP_URL contract.
  process.env.NEXTAUTH_URL ||= environment.appUrl;

  return createAuthOptions(environment);
}

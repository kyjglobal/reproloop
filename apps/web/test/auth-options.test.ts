import type { Account, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

import {
  AuthConfigurationError,
  createAuthOptions,
  exposeDiscordUserId,
  persistDiscordUserId,
  readAuthEnvironment,
} from "../src/server/auth/auth-options";

const validEnvironment = {
  appUrl: "http://localhost:3000",
  secret: "a".repeat(32),
  discordClientId: "123456789012345678",
  discordClientSecret: "discord-client-secret",
};

describe("Auth.js options", () => {
  it("configures Discord with JWT sessions", () => {
    const options = createAuthOptions(validEnvironment);

    expect(options.session?.strategy).toBe("jwt");
    expect(options.providers).toHaveLength(1);
    expect(options.providers[0]?.id).toBe("discord");
  });

  it("reports invalid environment variable names without exposing values", () => {
    const secretValue = "short-secret-value";

    expect(() =>
      readAuthEnvironment({
        APP_URL: "not-a-url",
        AUTH_SECRET: secretValue,
        AUTH_DISCORD_ID: "not-a-discord-id",
      }),
    ).toThrowError(AuthConfigurationError);

    try {
      readAuthEnvironment({
        APP_URL: "not-a-url",
        AUTH_SECRET: secretValue,
        AUTH_DISCORD_ID: "not-a-discord-id",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AuthConfigurationError);
      expect(String(error)).toContain("APP_URL");
      expect(String(error)).toContain("AUTH_SECRET");
      expect(String(error)).not.toContain(secretValue);
    }
  });

  it("persists the Discord account ID and exposes it on the session", () => {
    const account = {
      provider: "discord",
      providerAccountId: "123456789012345678",
      type: "oauth",
    } as Account;
    const token = persistDiscordUserId({} as JWT, account);
    const session = exposeDiscordUserId(
      {
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: { name: "Developer", email: null, image: null },
      } as Session,
      token,
    );

    expect(token.discordUserId).toBe(account.providerAccountId);
    expect(session.user.discordUserId).toBe(account.providerAccountId);
  });
});

import { generateKeyPairSync, sign } from "node:crypto";

import { InteractionResponseType } from "discord-interactions";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  DISCORD_BUG_COMMAND_NAME,
  DISCORD_BUG_MODAL_FIELD_IDS,
  DISCORD_BUG_OPTION_IDS,
} from "../src/server/discord/constants";
import { createBugModalCustomId } from "../src/server/discord/interaction-parser";
import { handleDiscordInteractionRequest } from "../src/server/discord/request-handler";
import type { DiscordBugRepository } from "../src/server/discord/types";

const now = new Date("2026-08-17T03:00:00.000Z");
const timestamp = String(Math.floor(now.getTime() / 1000));

let privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];
let publicKeyHex: string;

beforeAll(() => {
  const pair = generateKeyPairSync("ed25519");
  privateKey = pair.privateKey;
  const der = pair.publicKey.export({ type: "spki", format: "der" });
  publicKeyHex = der.subarray(-32).toString("hex");
});

function mockRepository(): DiscordBugRepository {
  return {
    listProjectChoices: vi.fn().mockResolvedValue([]),
    listBuildChoices: vi.fn().mockResolvedValue([]),
    selectionExists: vi.fn().mockResolvedValue(true),
    createReport: vi.fn().mockResolvedValue({ id: crypto.randomUUID(), reportNumber: 17, created: true }),
  };
}

function signedRequest(
  payload: unknown,
  options: { body?: string; signedBody?: string; requestTimestamp?: string; includeHeaders?: boolean } = {},
) {
  const body = options.body ?? JSON.stringify(payload);
  const signedBody = options.signedBody ?? body;
  const requestTimestamp = options.requestTimestamp ?? timestamp;
  const signature = sign(
    null,
    Buffer.from(requestTimestamp + signedBody),
    privateKey,
  ).toString("hex");

  return new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers:
      options.includeHeaders === false
        ? undefined
        : {
            "content-type": "application/json",
            "x-signature-ed25519": signature,
            "x-signature-timestamp": requestTimestamp,
          },
    body,
  });
}

function guildMember() {
  return {
    nick: "테스터",
    user: { id: "discord-user-1", username: "tester", global_name: "글로벌 테스터" },
  };
}

function commandPayload(projectId: string, buildId: string) {
  return {
    id: "command-interaction-1",
    type: 2,
    guild_id: "guild-1",
    channel_id: "channel-1",
    member: guildMember(),
    data: {
      name: DISCORD_BUG_COMMAND_NAME,
      options: [
        { name: DISCORD_BUG_OPTION_IDS.project, type: 3, value: projectId },
        { name: DISCORD_BUG_OPTION_IDS.build, type: 3, value: buildId },
      ],
    },
  };
}

function modalPayload(projectId: string, buildId: string, overrides: Record<string, string> = {}) {
  const values = {
    [DISCORD_BUG_MODAL_FIELD_IDS.actualResult]: "컷신 뒤에 게임이 멈춥니다.",
    [DISCORD_BUG_MODAL_FIELD_IDS.expectedResult]: "전투가 시작되어야 합니다.",
    [DISCORD_BUG_MODAL_FIELD_IDS.reproductionSteps]: "컷신 끝에 인벤토리를 엽니다.",
    [DISCORD_BUG_MODAL_FIELD_IDS.platform]: "Windows 11",
    [DISCORD_BUG_MODAL_FIELD_IDS.frequency]: "5회 중 3회",
    ...overrides,
  };

  return {
    id: "modal-interaction-1",
    type: 5,
    guild_id: "guild-1",
    channel_id: "channel-1",
    member: guildMember(),
    data: {
      custom_id: createBugModalCustomId({ projectId, buildId }),
      components: Object.entries(values).map(([customId, value]) => ({
        type: 1,
        components: [{ type: 4, custom_id: customId, value }],
      })),
    },
  };
}

async function handle(request: Request, repository = mockRepository()) {
  return handleDiscordInteractionRequest(request, {
    publicKey: publicKeyHex,
    repository,
    now,
    logger: { error: vi.fn() },
  });
}

describe("Discord interaction request boundary", () => {
  it("returns PONG for a correctly signed PING", async () => {
    const response = await handle(signedRequest({ type: 1 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ type: InteractionResponseType.PONG });
  });

  it("rejects missing signature headers", async () => {
    const response = await handle(signedRequest({ type: 1 }, { includeHeaders: false }));
    expect(response.status).toBe(401);
  });

  it("rejects a body changed after signing", async () => {
    const response = await handle(
      signedRequest({ type: 1 }, { signedBody: JSON.stringify({ type: 2 }) }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a valid signature with an old timestamp", async () => {
    const oldTimestamp = String(Math.floor((now.getTime() - 6 * 60 * 1000) / 1000));
    const response = await handle(
      signedRequest({ type: 1 }, { requestTimestamp: oldTimestamp }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects an unknown signed interaction type", async () => {
    const response = await handle(signedRequest({ type: 999 }));
    expect(response.status).toBe(400);
  });
});

describe("Discord /bug flow", () => {
  it("returns guild project autocomplete choices", async () => {
    const repository = mockRepository();
    vi.mocked(repository.listProjectChoices).mockResolvedValue([
      { name: "Moon Game", value: crypto.randomUUID() },
    ]);
    const payload = {
      id: "autocomplete-1",
      type: 4,
      guild_id: "guild-1",
      channel_id: "channel-1",
      member: guildMember(),
      data: {
        name: DISCORD_BUG_COMMAND_NAME,
        options: [
          { name: DISCORD_BUG_OPTION_IDS.project, type: 3, value: "moon", focused: true },
        ],
      },
    };

    const response = await handle(signedRequest(payload), repository);
    const body = await response.json();

    expect(body).toMatchObject({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [{ name: "Moon Game" }] },
    });
    expect(repository.listProjectChoices).toHaveBeenCalledWith({
      discordGuildId: "guild-1",
      query: "moon",
    });
  });

  it("uses the selected project when autocompleting active builds", async () => {
    const repository = mockRepository();
    const projectId = crypto.randomUUID();
    vi.mocked(repository.listBuildChoices).mockResolvedValue([
      { name: "1.2.3", value: crypto.randomUUID() },
    ]);
    const payload = {
      id: "autocomplete-2",
      type: 4,
      guild_id: "guild-1",
      channel_id: "channel-1",
      member: guildMember(),
      data: {
        name: DISCORD_BUG_COMMAND_NAME,
        options: [
          { name: DISCORD_BUG_OPTION_IDS.project, type: 3, value: projectId },
          { name: DISCORD_BUG_OPTION_IDS.build, type: 3, value: "1.2", focused: true },
        ],
      },
    };

    await handle(signedRequest(payload), repository);

    expect(repository.listBuildChoices).toHaveBeenCalledWith({
      discordGuildId: "guild-1",
      projectId,
      query: "1.2",
    });
  });

  it("does not query PostgreSQL when build autocomplete has a non-UUID project", async () => {
    const repository = mockRepository();
    const payload = {
      id: "autocomplete-invalid-project",
      type: 4,
      guild_id: "guild-1",
      channel_id: "channel-1",
      member: guildMember(),
      data: {
        name: DISCORD_BUG_COMMAND_NAME,
        options: [
          { name: DISCORD_BUG_OPTION_IDS.project, type: 3, value: "not-a-uuid" },
          { name: DISCORD_BUG_OPTION_IDS.build, type: 3, value: "1.2", focused: true },
        ],
      },
    };

    const response = await handle(signedRequest(payload), repository);

    expect(repository.listBuildChoices).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
      data: { choices: [] },
    });
  });

  it("returns a five-field modal for a valid project and build", async () => {
    const projectId = crypto.randomUUID();
    const buildId = crypto.randomUUID();
    const response = await handle(signedRequest(commandPayload(projectId, buildId)));
    const body = await response.json();

    expect(body.type).toBe(InteractionResponseType.MODAL);
    expect(body.data.custom_id).toBe(createBugModalCustomId({ projectId, buildId }));
    expect(body.data.components).toHaveLength(5);
  });

  it("does not open a modal for a project/build outside the guild", async () => {
    const repository = mockRepository();
    vi.mocked(repository.selectionExists).mockResolvedValue(false);
    const response = await handle(
      signedRequest(commandPayload(crypto.randomUUID(), crypto.randomUUID())),
      repository,
    );
    const body = await response.json();

    expect(body.data.flags).toBe(64);
    expect(body.data.content).toContain("사용할 수 없습니다");
  });

  it("turns a valid modal into a create command and returns BUG number", async () => {
    const repository = mockRepository();
    const projectId = crypto.randomUUID();
    const buildId = crypto.randomUUID();
    const response = await handle(
      signedRequest(modalPayload(projectId, buildId)),
      repository,
    );
    const body = await response.json();

    expect(repository.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        buildId,
        title: "컷신 뒤에 게임이 멈춥니다.",
        severity: "medium",
        reporterDiscordUserId: "discord-user-1",
        reporterDisplayName: "테스터",
        discordInteractionId: "modal-interaction-1",
      }),
    );
    expect(body).toEqual({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: "BUG-17이 접수되었습니다.", flags: 64 },
    });
  });

  it("rejects a mismatched modal custom ID", async () => {
    const payload = modalPayload(crypto.randomUUID(), crypto.randomUUID());
    payload.data.custom_id = "another-feature:v1";
    const response = await handle(signedRequest(payload));
    const body = await response.json();

    expect(body.data.content).toContain("입력을 확인");
  });

  it("rejects missing or overlong modal fields before persistence", async () => {
    const repository = mockRepository();
    const payload = modalPayload(crypto.randomUUID(), crypto.randomUUID(), {
      [DISCORD_BUG_MODAL_FIELD_IDS.platform]: "x".repeat(201),
    });
    payload.data.components.pop();
    const response = await handle(signedRequest(payload), repository);

    expect(repository.createReport).not.toHaveBeenCalled();
    expect((await response.json()).data.content).toContain("입력을 확인");
  });

  it("returns a generic error with request ID when persistence fails", async () => {
    const repository = mockRepository();
    const logger = { error: vi.fn() };
    vi.mocked(repository.createReport).mockRejectedValue(new Error("sensitive database detail"));
    const request = signedRequest(modalPayload(crypto.randomUUID(), crypto.randomUUID()));
    request.headers.set("x-request-id", "req-safe-1");

    const response = await handleDiscordInteractionRequest(request, {
      publicKey: publicKeyHex,
      repository,
      now,
      logger,
    });
    const body = await response.json();

    expect(body.data.content).toBe("제보 처리에 실패했습니다. 문의 코드: req-safe-1");
    expect(body.data.content).not.toContain("database");
    expect(logger.error).toHaveBeenCalledWith(
      "Discord interaction failed",
      expect.objectContaining({ requestId: "req-safe-1" }),
    );
  });
});

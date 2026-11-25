import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiscordBroker } from "../src/server/discord/broker";
import { handleBrokerCommand, sendBrokerNotification } from "../src/server/discord/broker-discord";

const tempFiles: { directory: string; file: string }[] = [];
const key = "reproloop-test-broker-signing-key";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "reproloop-broker-"));
  const file = join(directory, "installations.json");
  tempFiles.push({ directory, file });
  return { file, broker: new DiscordBroker(file, key) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const { directory, file } of tempFiles.splice(0)) {
    if (existsSync(file)) unlinkSync(file);
    rmdirSync(directory);
  }
});

function link(broker: DiscordBroker, guildId: string) {
  const code = broker.issueCode(guildId, "Test guild");
  const connection = broker.pair(code);
  return { code, connection, installation: broker.authenticate(`Bearer ${connection.token}`) };
}

describe("self-hosted Discord broker", () => {
  it("requires server management, consumes codes once and persists revocation", async () => {
    const { broker, file } = fixture();
    const interaction = {
      type: 2, guild_id: "101", guild: { name: "Test guild" },
      member: { permissions: "0" }, data: { name: "reproloop", options: [{ type: 1, name: "connect" }] },
    };
    const denied = await handleBrokerCommand(broker, interaction);
    expect(denied?.data.content).toContain("서버 관리 권한");
    const linked = link(broker, "101");
    expect(() => broker.pair(linked.code)).toThrow();
    const code = broker.issueCode("101", "Test guild");
    expect(() => broker.pair(code, "202")).toThrow();
    const renewed = broker.pair(code, "101");
    expect(renewed.id).toBe(linked.connection.id);
    expect(() => broker.authenticate(`Bearer ${linked.connection.token}`)).toThrow();
    const restarted = new DiscordBroker(file, key);
    restarted.revoke(restarted.authenticate(`Bearer ${renewed.token}`));
    expect(() => new DiscordBroker(file, key).authenticate(`Bearer ${renewed.token}`)).toThrow();
  });

  it("routes requests and replies to the linked installation only", async () => {
    const { broker } = fixture();
    const first = link(broker, "101").installation;
    const other = link(broker, "202").installation;
    const pending = broker.repository().listProjectChoices({ discordGuildId: "101", query: "" });
    const task = await broker.poll(first, AbortSignal.abort());
    expect(task?.operation.type).toBe("projects");
    expect(await broker.poll(other, AbortSignal.abort())).toBeUndefined();
    const project = { name: "Test project", value: randomUUID() };
    broker.reply(other, task!.id, []);
    broker.reply(first, task!.id, [project]);
    await expect(pending).resolves.toEqual([project]);
  });

  it("binds receipts to guild and recipient and uses the same Discord nonce on a retry", async () => {
    const { broker } = fixture();
    const first = link(broker, "101").installation;
    const other = link(broker, "202").installation;
    const creation = broker.repository().createReport({
      discordGuildId: "101", sourceChannelId: "300", discordInteractionId: "400",
      reporterDiscordUserId: "500", reporterDisplayName: "Tester",
      projectId: randomUUID(), buildId: randomUUID(), title: "Freeze", severity: "medium",
      actualResult: "Freeze", expectedResult: "Loads", reproductionSteps: "Enter", platform: "PC", frequency: "Always",
    });
    const task = await broker.poll(first, AbortSignal.abort());
    if (task?.operation.type !== "create") throw new Error("Expected report task");
    const { receipt } = task.operation;
    broker.reply(first, task.id, { id: randomUUID(), reportNumber: 1, created: true });
    await creation;
    expect(broker.verifiesReceipt(other, "500", receipt)).toBe(false);
    expect(broker.verifiesReceipt(first, "501", receipt)).toBe(false);

    vi.stubEnv("DISCORD_BOT_TOKEN", "test-token");
    const request = vi.fn(async (url: URL) => Response.json({
      id: url.pathname.endsWith("/messages") ? "601" : "600",
    }));
    vi.stubGlobal("fetch", request);
    const notification = { recipient: "500", receipt, notificationId: randomUUID(), reportNumber: 1, build: "0.9.0" };
    await expect(sendBrokerNotification(broker, first, notification)).resolves.toEqual({ messageId: "601" });
    await expect(sendBrokerNotification(broker, first, notification)).resolves.toEqual({ messageId: "601" });
    const messages = (request.mock.calls as unknown as [URL, RequestInit][])
      .filter(([url]) => url.pathname.endsWith("/messages"))
      .map(([, init]) => JSON.parse(String(init.body)));
    expect(messages[0].enforce_nonce).toBe(true);
    expect(messages[0].nonce).toBe(messages[1].nonce);
    await expect(sendBrokerNotification(broker, other, notification)).rejects.toMatchObject({ status: 422 });
  });
});

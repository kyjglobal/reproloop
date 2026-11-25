import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { accessSync, constants, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { type BridgeOperation, type BridgeTaskSchema } from "@reproloop/shared";
import { z } from "zod";

import type { DiscordBugRepository } from "./types";

const InstallationSchema = z.object({
  id: z.uuid(),
  guildId: z.string().regex(/^\d{1,20}$/),
  guildName: z.string().max(100),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  revoked: z.boolean(),
});

export type Installation = z.infer<typeof InstallationSchema>;
type Task = z.infer<typeof BridgeTaskSchema>;
type PendingTask = {
  owner: string;
  task: Task;
  delivered: boolean;
  finish: (result?: unknown, failed?: boolean) => void;
};
type Poll = (task?: Task) => void;

export class BridgeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export class DiscordBroker {
  private installations: Installation[];
  private codes = new Map<string, { guildId: string; guildName: string; expiresAt: number }>();
  private tasks = new Map<string, PendingTask>();
  private polls = new Map<string, Poll>();

  constructor(private readonly stateFile: string, private readonly signingKey: string) {
    const directory = dirname(stateFile);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    accessSync(directory, constants.W_OK);
    try {
      this.installations = z.array(InstallationSchema).parse(
        JSON.parse(readFileSync(stateFile, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.installations = [];
    }
  }

  private persist(installations: Installation[]) {
    const temporary = `${this.stateFile}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(installations), { mode: 0o600 });
    renameSync(temporary, this.stateFile);
    this.installations = installations;
  }

  issueCode(guildId: string, guildName: string) {
    const now = Date.now();
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt <= now || entry.guildId === guildId) this.codes.delete(code);
    }
    if (this.codes.size >= 1024) throw new BridgeError(429, "잠시 후 다시 시도해 주세요.");

    const code = randomBytes(12).toString("base64url");
    this.codes.set(code, { guildId, guildName, expiresAt: now + 5 * 60_000 });
    return code;
  }

  pair(code: string, expectedGuildId?: string) {
    const entry = this.codes.get(code);
    if (!entry || entry.expiresAt <= Date.now()) {
      throw new BridgeError(400, "연결 코드가 만료되었거나 올바르지 않습니다.");
    }
    if (expectedGuildId && expectedGuildId !== entry.guildId) {
      throw new BridgeError(409, "기존 설치본과 같은 Discord 서버의 코드가 필요합니다.");
    }
    const current = this.installations.find((item) => item.guildId === entry.guildId);
    const token = randomBytes(32).toString("base64url");
    const installation: Installation = {
      id: current?.id ?? randomUUID(),
      guildId: entry.guildId,
      guildName: entry.guildName,
      tokenHash: hash(token),
      revoked: false,
    };
    this.persist([...this.installations.filter((item) => item.id !== installation.id), installation]);
    this.codes.delete(code);
    if (current) this.clearConnection(current.id);
    return { id: installation.id, guildId: entry.guildId, guildName: entry.guildName, token };
  }

  authenticate(header: string | null) {
    if (!header || !/^Bearer [\w-]{43}$/.test(header)) {
      throw new BridgeError(401, "설치 인증이 필요합니다.");
    }
    const tokenHash = hash(header.slice(7));
    const installation = this.installations.find((item) => !item.revoked && item.tokenHash === tokenHash);
    if (!installation) throw new BridgeError(401, "Discord 서버를 다시 연결해 주세요.");
    return installation;
  }

  revoke(installation: Installation) {
    this.persist(this.installations.map((item) =>
      item.id === installation.id ? { ...item, revoked: true } : item,
    ));
    this.clearConnection(installation.id);
  }

  private clearConnection(id: string) {
    this.polls.get(id)?.();
    for (const task of this.tasks.values()) {
      if (task.owner === id) task.finish(undefined, true);
    }
  }

  private queue(installation: Installation, operation: BridgeOperation, milliseconds: number) {
    if ([...this.tasks.values()].filter((task) => task.owner === installation.id).length >= 20) {
      throw new BridgeError(429, "로컬 설치본이 요청을 처리 중입니다.");
    }
    return new Promise<unknown>((resolve, reject) => {
      const task = { id: randomUUID(), operation };
      const timeout = setTimeout(() => {
        this.tasks.delete(task.id);
        reject(new BridgeError(504, "로컬 설치본에서 처리 결과를 확인하지 못했습니다."));
      }, milliseconds);
      const pending: PendingTask = {
        owner: installation.id,
        task,
        delivered: false,
        finish: (result, failed) => {
          clearTimeout(timeout);
          this.tasks.delete(task.id);
          if (failed) reject(new BridgeError(503, "로컬 설치본에서 요청을 처리하지 못했습니다."));
          else resolve(result);
        },
      };
      this.tasks.set(task.id, pending);
      const poll = this.polls.get(installation.id);
      if (poll) {
        pending.delivered = true;
        poll(task);
      }
    });
  }

  poll(installation: Installation, signal: AbortSignal): Promise<Task | undefined> {
    const pending = [...this.tasks.values()].find((item) =>
      item.owner === installation.id && !item.delivered,
    );
    if (pending) {
      pending.delivered = true;
      return Promise.resolve(pending.task);
    }
    if (signal.aborted) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      this.polls.get(installation.id)?.();
      const cancel = () => finish();
      const timeout = setTimeout(cancel, 20_000);
      const finish: Poll = (task) => {
        clearTimeout(timeout);
        this.polls.delete(installation.id);
        signal.removeEventListener("abort", cancel);
        resolve(task);
      };
      this.polls.set(installation.id, finish);
      signal.addEventListener("abort", cancel, { once: true });
    });
  }

  reply(installation: Installation, id: string, result: unknown, failed?: boolean) {
    const pending = this.tasks.get(id);
    if (pending?.owner === installation.id && pending.delivered) pending.finish(result, failed);
  }

  private receiptSignature(installation: Installation, receiver: string, interactionId: string) {
    return createHmac("sha256", this.signingKey)
      .update(JSON.stringify([installation.id, installation.guildId, receiver, interactionId]))
      .digest("base64url");
  }

  verifiesReceipt(installation: Installation, receiver: string, receipt: string) {
    const parts = /^(\d{1,20})\.([\w-]{43})$/.exec(receipt);
    if (!parts) return false;
    const signature = this.receiptSignature(installation, receiver, parts[1]);
    return timingSafeEqual(Buffer.from(parts[2]), Buffer.from(signature));
  }

  repository(): DiscordBugRepository {
    const choices = z.array(z.object({ name: z.string().max(100), value: z.uuid() })).max(25);
    const createResult = z.object({ id: z.uuid(), reportNumber: z.number().int().positive(), created: z.boolean() });
    const installationFor = (guildId: string) => {
      const installation = this.installations.find((item) => item.guildId === guildId && !item.revoked);
      if (!installation) throw new BridgeError(503, "이 서버의 ReproLoop 로컬 설치본을 연결해 주세요.");
      return installation;
    };
    return {
      listProjectChoices: async (input) => choices.parse(
        await this.queue(installationFor(input.discordGuildId), { type: "projects", input }, 1600),
      ),
      listBuildChoices: async (input) => choices.parse(
        await this.queue(installationFor(input.discordGuildId), { type: "builds", input }, 1600),
      ),
      selectionExists: async (input) => z.boolean().parse(
        await this.queue(installationFor(input.discordGuildId), { type: "selection", input }, 1600),
      ),
      createReport: async (input) => {
        const installation = installationFor(input.discordGuildId);
        const signature = this.receiptSignature(installation, input.reporterDiscordUserId, input.discordInteractionId);
        return createResult.parse(await this.queue(installation, {
          type: "create",
          input,
          receipt: `${input.discordInteractionId}.${signature}`,
        }, 12_000));
      },
    };
  }
}

const runtime = globalThis as typeof globalThis & { reproloopBroker?: DiscordBroker };

export function getDiscordBroker() {
  if (runtime.reproloopBroker) return runtime.reproloopBroker;
  const file = process.env.REPROLOOP_BROKER_STATE;
  const key = process.env.REPROLOOP_BROKER_SECRET;
  if (!file || !key || key.length < 32) {
    throw new Error("Configure REPROLOOP_BROKER_STATE and REPROLOOP_BROKER_SECRET.");
  }
  return (runtime.reproloopBroker = new DiscordBroker(file, key));
}

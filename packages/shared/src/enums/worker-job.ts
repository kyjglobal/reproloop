import { z } from "zod";

export const WORKER_JOB_NAMES = ["notification.send.v1", "attachment.delete.v1"] as const;

export const WorkerJobNameSchema = z.enum(WORKER_JOB_NAMES);

export type WorkerJobName = z.infer<typeof WorkerJobNameSchema>;

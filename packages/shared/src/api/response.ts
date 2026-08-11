import { z } from "zod";

export const ApiPaginationMetaSchema = z.strictObject({
  nextCursor: z.string().min(1).nullable(),
});

export type ApiPaginationMeta = z.infer<typeof ApiPaginationMetaSchema>;

export type ApiDataResponse<T> = { data: T };
export type ApiListResponse<T> = { data: T[]; meta: ApiPaginationMeta };

export function createApiDataResponseSchema<TSchema extends z.ZodType>(dataSchema: TSchema) {
  return z.strictObject({ data: dataSchema });
}

export function createApiListResponseSchema<TSchema extends z.ZodType>(itemSchema: TSchema) {
  return z.strictObject({
    data: z.array(itemSchema),
    meta: ApiPaginationMetaSchema,
  });
}

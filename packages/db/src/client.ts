type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns?: string) => unknown;
    insert?: (values: unknown) => unknown;
    update?: (values: unknown) => unknown;
    upsert?: (values: unknown, options?: unknown) => unknown;
    delete?: () => unknown;
  };
};

export async function unwrapSupabaseResult<T>(
  query: PromiseLike<QueryResult<T>> | QueryResult<T>,
): Promise<T> {
  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data as T;
}

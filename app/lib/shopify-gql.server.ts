// Small wrapper around the Admin GraphQL client: returns data, throws readable errors.

export interface AdminClient {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

export class ShopifyGqlError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function gql<T = any>(
  admin: AdminClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await admin.graphql(query, variables ? { variables } : undefined);
  } catch (err: any) {
    // The client throws a GraphqlQueryError with .body for GraphQL-level errors.
    const errors = err?.body?.errors ?? err?.errors;
    throw new ShopifyGqlError(errors ? JSON.stringify(errors).slice(0, 500) : String(err?.message ?? err), errors);
  }
  const json: any = await res.json();
  if (json.errors?.length) {
    throw new ShopifyGqlError(JSON.stringify(json.errors).slice(0, 500), json.errors);
  }
  return json.data as T;
}

/** Throw if a mutation returned userErrors. */
export function assertNoUserErrors(result: { userErrors?: { field?: string[] | null; message: string }[] }) {
  const errs = result?.userErrors ?? [];
  if (errs.length) throw new ShopifyGqlError(errs.map((e) => e.message).join("; "), errs);
}

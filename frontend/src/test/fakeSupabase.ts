/**
 * Doble mínimo del cliente de Supabase para tests de handlers: cada `from(tabla)` consume el
 * próximo resultado configurado para esa tabla (el último se repite) y devuelve un builder
 * encadenable que registra cada llamada y se resuelve con ese resultado al hacerle `await`.
 */

export type FakeResult = { data: unknown; error: { code?: string; message: string } | null };

export type RecordedCall = { method: string; args: unknown[] };

type RecordedQuery = { table: string; calls: RecordedCall[] };

type FakeSupabaseConfig = {
  tables?: Record<string, FakeResult | FakeResult[]>;
  rpc?: FakeResult;
};

function createBuilder(result: FakeResult, calls: RecordedCall[]): unknown {
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve: (value: FakeResult) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    }
  );
  return builder;
}

export function createFakeSupabase(config: FakeSupabaseConfig) {
  const queries: RecordedQuery[] = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const consumed: Record<string, number> = {};

  const client = {
    from(table: string) {
      const configured = config.tables?.[table] ?? { data: null, error: null };
      const results = Array.isArray(configured) ? configured : [configured];
      const index = Math.min(consumed[table] ?? 0, results.length - 1);
      consumed[table] = (consumed[table] ?? 0) + 1;

      const calls: RecordedCall[] = [];
      queries.push({ table, calls });
      return createBuilder(results[index], calls);
    },
    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      return createBuilder(config.rpc ?? { data: null, error: null }, []);
    },
  };

  return {
    client,
    rpcCalls,
    /** Llamadas encadenadas de cada `from(tabla)`, en orden. */
    queriesFor: (table: string) => queries.filter((query) => query.table === table).map((query) => query.calls),
  };
}

export function hasCall(calls: RecordedCall[], method: string): boolean {
  return calls.some((call) => call.method === method);
}

export function findCall(calls: RecordedCall[], method: string): RecordedCall | undefined {
  return calls.find((call) => call.method === method);
}

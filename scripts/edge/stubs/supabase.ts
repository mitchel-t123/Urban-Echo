// Tiny in-memory stand-in for supabase-js, covering only what the functions use.
// Tests read and set `globalThis.__db` ({ tables, ops, fail }).
type Row = Record<string, unknown>
// deno-lint-ignore no-explicit-any
const g = globalThis as any

export function createClient(_url: string, _key: string, _options?: unknown) {
  return {
    from(table: string) {
      const q: { op: string; filters: [string, unknown][]; payload?: Row; cols?: string } = {
        op: 'select',
        filters: [],
      }
      const run = (): { data: Row[] | null; error: { message: string } | null } => {
        const db = g.__db
        db.ops.push({ table, op: q.op, filters: q.filters.slice(), payload: q.payload })
        const rows: Row[] = db.tables[table] ?? (db.tables[table] = [])
        const match = (r: Row) => q.filters.every(([k, v]) => r[k] === v)
        if (q.op === 'select') {
          if (db.fail === 'lookup') return { data: null, error: { message: 'lookup failed' } }
          return { data: rows.filter(match), error: null }
        }
        if (q.op === 'insert') {
          if (db.fail === 'insert') return { data: null, error: { message: 'insert failed' } }
          rows.push({ ...q.payload })
          return { data: null, error: null }
        }
        if (q.op === 'update') {
          if (db.fail === 'update') return { data: null, error: { message: 'update failed' } }
          rows.filter(match).forEach((r) => Object.assign(r, q.payload))
          return { data: null, error: null }
        }
        return { data: null, error: { message: 'unsupported' } }
      }
      // deno-lint-ignore no-explicit-any
      const b: any = {
        select(cols?: string) { q.cols = cols; return b },
        insert(p: Row) { q.op = 'insert'; q.payload = p; return b },
        update(p: Row) { q.op = 'update'; q.payload = p; return b },
        eq(k: string, v: unknown) { q.filters.push([k, v]); return b },
        maybeSingle() {
          const r = run()
          if (r.error) return Promise.resolve(r)
          return Promise.resolve({ data: (r.data as Row[])[0] ?? null, error: null })
        },
        // deno-lint-ignore no-explicit-any
        then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej) },
      }
      return b
    },
  }
}

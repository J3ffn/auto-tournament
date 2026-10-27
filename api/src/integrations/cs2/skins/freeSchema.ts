/**
 * Fork (free skin mode): the two additions it stores.
 *
 *   cs2_player_skins.nametag    a skin's name tag (free mode lets players set one)
 *   cs2_player_agents           the agent (player model) each player picked per side
 *   cs2_player_saved_loadouts   loadouts a player keeps and switches between (./loadouts.ts)
 *   cs2_player_skin_prefs       the weapons each side's loadout shows, notices closed,
 *                               whether the profile shows the loadout
 *
 * Created here, at first use, with IF NOT EXISTS, and not as a CS2 module
 * migration on purpose: migrations are append only and recorded in a ledger,
 * and an official build refuses to load the CS2 module on a database whose
 * ledger names a migration it does not know. Kept out of the ledger, a
 * database this fork used still boots on an official image (the extra column
 * and table are simply unused there).
 */

import { db } from '../../../config/database';
import { log } from '../../../utils/logger';

let ready: Promise<boolean> | null = null;

/** Make sure the column and table exist. False when they could not be made (logged). */
export function ensureFreeSkinsSchema(): Promise<boolean> {
  ready ??= (async () => {
    try {
      await db.runAsync('ALTER TABLE cs2_player_skins ADD COLUMN IF NOT EXISTS nametag TEXT');
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS cs2_player_agents (
           player_uid UUID NOT NULL,
           team SMALLINT NOT NULL CHECK (team IN (2, 3)),
           model TEXT NOT NULL,
           PRIMARY KEY (player_uid, team)
         )`
      );
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS cs2_player_saved_loadouts (
           id SERIAL PRIMARY KEY,
           player_uid UUID NOT NULL,
           name TEXT NOT NULL DEFAULT '',
           color TEXT NOT NULL,
           items TEXT NOT NULL DEFAULT '[]',
           agents TEXT NOT NULL DEFAULT '[]',
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`
      );
      await db.runAsync(
        `CREATE INDEX IF NOT EXISTS cs2_player_saved_loadouts_player_idx
           ON cs2_player_saved_loadouts (player_uid)`
      );
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS cs2_player_skin_prefs (
           player_uid UUID PRIMARY KEY,
           active_loadout INTEGER,
           layout TEXT,
           tips TEXT NOT NULL DEFAULT '[]',
           show_loadout BOOLEAN NOT NULL DEFAULT TRUE
         )`
      );
      return true;
    } catch (error) {
      log.warn('[Skins] free mode: could not add its columns and tables', {
        error: (error as Error).message,
      });
      ready = null;
      return false;
    }
  })();
  return ready;
}

/** A query failed on a missing column or table (a reset database): check again next time. */
function schemaGone(error: unknown): boolean {
  return (
    error instanceof Error &&
    /nametag|cs2_player_agents|cs2_player_saved_loadouts|cs2_player_skin_prefs/.test(error.message)
  );
}

/** Run `fn` with the schema in place; after a missing-schema error, make it again and retry once. */
export async function withFreeSchema<T>(fn: () => Promise<T>): Promise<T> {
  await ensureFreeSkinsSchema();
  try {
    return await fn();
  } catch (error) {
    if (!schemaGone(error)) throw error;
    ready = null;
    await ensureFreeSkinsSchema();
    return fn();
  }
}

/** The agents a player picked: one model per side they set. */
export async function agentsOf(playerUid: string): Promise<Array<{ team: 2 | 3; model: string }>> {
  if (!(await ensureFreeSkinsSchema())) return [];
  try {
    const rows = await db.queryAsync<{ team: number; model: string }>(
      'SELECT team, model FROM cs2_player_agents WHERE player_uid = ? ORDER BY team',
      [playerUid]
    );
    return rows
      .filter((r) => (r.team === 2 || r.team === 3) && typeof r.model === 'string')
      .map((r) => ({ team: r.team as 2 | 3, model: r.model }));
  } catch (error) {
    if (schemaGone(error)) ready = null;
    log.warn('[Skins] free mode: could not read agents', { error: (error as Error).message });
    return [];
  }
}

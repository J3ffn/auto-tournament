/**
 * Fork: free skin mode (`skins_config.freeMode`). While it is on, a player is
 * not limited to the skins they won: they pick any finish from the catalogue,
 * set its float, pattern, StatTrak and name tag, and equip it for CT, T or
 * both; and they pick an agent per side. Drops, rewards and trade-ups keep
 * working next to it.
 *
 * A picked finish is an ordinary inventory row with source `free`, one per
 * finish per player: picking the same finish again changes that row instead
 * of adding another, so the inventory holds what the player actually chose,
 * not the whole catalogue. Everything else (the loadout, the push to the game
 * servers, StatTrak counting) is the regular skins code.
 */

import { db } from '../../../config/database';
import agentsJson from './agents.json';
import { agentsOf, ensureFreeSkinsSchema, withFreeSchema } from './freeSchema';
import { WEAPON_DEFINDEX } from './skinDefindex';
import {
  SKIN_IMAGES_BASE,
  SkinError,
  type LoadoutTeam,
  type Rarity,
  rollFloat,
  rollPattern,
  sideOf,
  skinService,
  slotOf,
  statTrakCapable,
  variantOf,
} from './skinService';

/** CS2 caps a name tag at 20 characters. */
export const NAMETAG_MAX = 20;

export interface AgentEntry {
  /** 2 T, 3 CT. */
  team: 2 | 3;
  name: string;
  /** The model path Ready Up sets (`agents/models/…/….vmdl`). */
  model: string;
  image: string;
  /** The grade colour (Distinguished … Master). */
  color: string;
}

export const AGENTS: readonly AgentEntry[] = (agentsJson as AgentEntry[]).filter(
  (a) => (a.team === 2 || a.team === 3) && a.model.startsWith('agents/models/')
);

/** A finish players can pick: the catalogue's, once per weapon and paint kit. */
export interface FreeCatalogSkin {
  weapon: string;
  weaponName: string;
  paintKit: number;
  name: string;
  variant: string | null;
  rarity: Rarity;
  slot: string;
  side: 2 | 3 | null;
  image: string;
  statTrak: boolean;
}

/** What a player may set on a free skin. Each field is optional: left out, it stays (or is rolled). */
export interface FreeCustom {
  float?: number;
  pattern?: number;
  stattrak?: boolean;
  nametag?: string | null;
}

/** The site's settings, or a 404 while skins or free mode are off. */
export async function requireFreeMode(): Promise<void> {
  const config = await skinService.config();
  if (!config.enabled || !config.freeMode) throw new SkinError(404, 'Free skin mode is off.');
}

/** A name tag as the game takes it: one line, no control characters, at most 20 characters. */
export function cleanNametag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex -- strip control characters from a name tag
  const text = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text ? [...text].slice(0, NAMETAG_MAX).join('') : null;
}

/** The fields of a request body a player may set, checked; bad values are refused, not guessed. */
export function parseCustom(body: unknown): FreeCustom {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: FreeCustom = {};
  if (input.float !== undefined && input.float !== null) {
    const f = Number(input.float);
    if (!Number.isFinite(f) || f < 0 || f > 1)
      throw new SkinError(400, 'The float is a number from 0 to 1.');
    out.float = Math.round(f * 1_000_000) / 1_000_000;
  }
  if (input.pattern !== undefined && input.pattern !== null) {
    const p = Number(input.pattern);
    if (!Number.isInteger(p) || p < 0 || p > 1000)
      throw new SkinError(400, 'The pattern is a whole number from 0 to 1000.');
    out.pattern = p;
  }
  if (input.stattrak !== undefined) out.stattrak = input.stattrak === true;
  if (input.nametag !== undefined) out.nametag = cleanNametag(input.nametag);
  return out;
}

/** The new StatTrak value: on keeps a count it has (or starts at 0), off clears it. */
function statTrakValue(weapon: string, wanted: boolean | undefined, current: number | null) {
  if (wanted === undefined) return current;
  return wanted && statTrakCapable(weapon) ? (current ?? 0) : null;
}

export const freeMode = {
  /** Every finish a player can pick, weapons first by name, then knives and gloves. */
  async catalog(): Promise<FreeCatalogSkin[]> {
    const seen = new Set<string>();
    const out: FreeCatalogSkin[] = [];
    for (const s of await skinService.catalog()) {
      const key = `${s.weapon}|${s.paintKit}`;
      if (seen.has(key) || !WEAPON_DEFINDEX[s.weapon]) continue;
      seen.add(key);
      out.push({
        weapon: s.weapon,
        weaponName: s.weaponName,
        paintKit: s.paintKit,
        name: s.name,
        variant: variantOf(s.paintKitName),
        rarity: s.rarity,
        slot: slotOf(s.weapon),
        side: sideOf(s.weapon),
        image: `${SKIN_IMAGES_BASE}/${s.image}`,
        statTrak: statTrakCapable(s.weapon),
      });
    }
    return out;
  },

  /**
   * Pick a finish: the player's free copy of it is made (or changed) with the
   * values given, then equipped for `team` (0 both, 2 T, 3 CT) unless `equip`
   * is false. Returns the skin's id.
   */
  async pick(
    playerUid: string,
    input: { weapon: unknown; paintKit: unknown; team?: unknown; equip?: unknown },
    custom: FreeCustom
  ): Promise<number> {
    const paintKit = Number(input.paintKit);
    const skin = (await skinService.catalog()).find(
      (s) => s.weapon === input.weapon && s.paintKit === paintKit
    );
    if (!skin || !WEAPON_DEFINDEX[skin.weapon])
      throw new SkinError(400, 'That skin is not in the catalogue.');
    const id = await withFreeSchema(async () => {
      const existing = await db.queryOneAsync<{ id: number; stattrak: number | null }>(
        `SELECT id, stattrak FROM cs2_player_skins
          WHERE player_uid = ? AND source = 'free' AND weapon = ? AND paint_kit = ?
          ORDER BY id LIMIT 1`,
        [playerUid, skin.weapon, skin.paintKit]
      );
      if (existing) {
        await this.apply(existing.id, skin.weapon, custom, existing.stattrak);
        return existing.id;
      }
      const row = await db.queryOneAsync<{ id: number }>(
        `INSERT INTO cs2_player_skins
           (player_uid, weapon, weapon_name, paint_kit, name, rarity, image, float_value, pattern,
            source, variant, stattrak, nametag, seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'free', ?, ?, ?, TRUE) RETURNING id`,
        [
          playerUid,
          skin.weapon,
          skin.weaponName,
          skin.paintKit,
          skin.name,
          skin.rarity,
          skin.image,
          custom.float ?? rollFloat(0, 0.07),
          custom.pattern ?? rollPattern(),
          variantOf(skin.paintKitName),
          statTrakValue(skin.weapon, custom.stattrak, null),
          custom.nametag ?? null,
        ]
      );
      if (!row?.id) throw new SkinError(500, 'The skin could not be saved.');
      return row.id;
    });
    if (input.equip !== false) await skinService.equip(playerUid, id, input.team ?? 0);
    return id;
  },

  /** Change one of the player's own skins (any source, while free mode is on). */
  async edit(playerUid: string, skinId: number, custom: FreeCustom): Promise<void> {
    await withFreeSchema(async () => {
      const row = await db.queryOneAsync<{ id: number; weapon: string; stattrak: number | null }>(
        'SELECT id, weapon, stattrak FROM cs2_player_skins WHERE id = ? AND player_uid = ?',
        [skinId, playerUid]
      );
      if (!row) throw new SkinError(404, 'That skin is not in your inventory.');
      await this.apply(row.id, row.weapon, custom, row.stattrak);
    });
  },

  /** Write the given fields of a skin row; the rest stay as they are. */
  async apply(
    skinId: number,
    weapon: string,
    custom: FreeCustom,
    stattrak: number | null
  ): Promise<void> {
    const sets: string[] = [];
    const params: Array<number | string | null> = [];
    if (custom.float !== undefined) {
      sets.push('float_value = ?');
      params.push(custom.float);
    }
    if (custom.pattern !== undefined) {
      sets.push('pattern = ?');
      params.push(custom.pattern);
    }
    if (custom.stattrak !== undefined) {
      sets.push('stattrak = ?');
      params.push(statTrakValue(weapon, custom.stattrak, stattrak));
    }
    if (custom.nametag !== undefined) {
      sets.push('nametag = ?');
      params.push(custom.nametag);
    }
    if (!sets.length) return;
    await db.runAsync(`UPDATE cs2_player_skins SET ${sets.join(', ')} WHERE id = ?`, [
      ...params,
      skinId,
    ]);
  },

  /** Throw away one of the player's free skins (it leaves the loadout with it). */
  async remove(playerUid: string, skinId: number): Promise<void> {
    const row = await db.queryOneAsync<{ id: number }>(
      "SELECT id FROM cs2_player_skins WHERE id = ? AND player_uid = ? AND source = 'free'",
      [skinId, playerUid]
    );
    if (!row) throw new SkinError(404, 'That is not one of your picked skins.');
    await db.runAsync('DELETE FROM cs2_player_skins WHERE id = ?', [skinId]);
  },

  /** The agent each side has: the model path, or null for the game's default. */
  async myAgents(playerUid: string): Promise<{ ct: string | null; t: string | null }> {
    const rows = await agentsOf(playerUid);
    return {
      ct: rows.find((r) => r.team === 3)?.model ?? null,
      t: rows.find((r) => r.team === 2)?.model ?? null,
    };
  },

  /** Set a side's agent (one from the list, for that side), or clear it with null. */
  async setAgent(playerUid: string, teamRaw: unknown, modelRaw: unknown): Promise<void> {
    const team = Number(teamRaw) as LoadoutTeam;
    if (team !== 2 && team !== 3) throw new SkinError(400, 'The side is 2 (T) or 3 (CT).');
    if (!(await ensureFreeSkinsSchema())) throw new SkinError(500, 'Agents are not available.');
    if (modelRaw === null || modelRaw === undefined || modelRaw === '') {
      await withFreeSchema(() =>
        db.runAsync('DELETE FROM cs2_player_agents WHERE player_uid = ? AND team = ?', [
          playerUid,
          team,
        ])
      );
      return;
    }
    const agent = AGENTS.find((a) => a.model === modelRaw);
    if (!agent) throw new SkinError(400, 'No such agent.');
    if (agent.team !== team) throw new SkinError(400, 'That agent plays for the other side.');
    await withFreeSchema(() =>
      db.runAsync(
        `INSERT INTO cs2_player_agents (player_uid, team, model) VALUES (?, ?, ?)
         ON CONFLICT (player_uid, team) DO UPDATE SET model = EXCLUDED.model`,
        [playerUid, team, agent.model]
      )
    );
  },
};

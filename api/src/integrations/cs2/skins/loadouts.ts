/**
 * Fork (free skin mode): saved loadouts and the loadout page's preferences.
 *
 * The loadout the game uses is still `cs2_player_loadout` (+ `cs2_player_agents`):
 * the push to the servers, StatTrak counting and the rest of the skins code are
 * unchanged. A saved loadout is a named copy of it ("Blue", "Red"). One is
 * active: its copy is the live tables, written back to its row before another
 * is switched in. Switching writes the other's rows into the live tables
 * (skins the player no longer has are left out).
 *
 * The preferences: which weapons each side's loadout shows in its three
 * columns (the game's buy menu is set in CS2 itself, so this only mirrors it),
 * the notices the player closed, and whether their profile shows the loadout.
 */

import { db } from '../../../config/database';
import type { Untrusted } from '../../../utils/untrusted';
import { agentsOf, withFreeSchema } from './freeSchema';
import { SkinError, type LoadoutTeam } from './skinService';

/** At most this many saved loadouts per player. */
export const MAX_LOADOUTS = 12;
/** A loadout's name: at most 24 characters. */
export const LOADOUT_NAME_MAX = 24;

/** The colours a loadout can take (its dot in the menu). */
export const LOADOUT_COLORS = [
  '#5d79ae',
  '#de5a3a',
  '#3fc168',
  '#e4ae39',
  '#c792ea',
  '#4fd1c5',
  '#f29a9a',
  '#c4bcb9',
] as const;

export interface LoadoutItem {
  slot: string;
  skinId: number;
  team: LoadoutTeam;
}

export interface SavedLoadout {
  id: number;
  /** '' for the first one, which the page names itself. */
  name: string;
  color: string;
  active: boolean;
  items: LoadoutItem[];
  agents: Array<{ team: 2 | 3; model: string }>;
}

export type Column = 'pistol' | 'mid' | 'rifle';
export type SideLayout = Record<Column, string[]>;
/** Per side (2 T, 3 CT): the weapons each column shows, in order. */
export type Layout = Record<'2' | '3', SideLayout>;

/** The weapons each side can put in each column. */
export const POOLS: Record<'2' | '3', SideLayout> = {
  '2': {
    pistol: [
      'weapon_glock',
      'weapon_p250',
      'weapon_tec9',
      'weapon_cz75a',
      'weapon_elite',
      'weapon_deagle',
      'weapon_revolver',
    ],
    mid: [
      'weapon_mac10',
      'weapon_mp7',
      'weapon_mp5sd',
      'weapon_ump45',
      'weapon_p90',
      'weapon_bizon',
      'weapon_nova',
      'weapon_xm1014',
      'weapon_sawedoff',
      'weapon_m249',
      'weapon_negev',
    ],
    rifle: [
      'weapon_galilar',
      'weapon_ak47',
      'weapon_sg556',
      'weapon_ssg08',
      'weapon_awp',
      'weapon_g3sg1',
    ],
  },
  '3': {
    pistol: [
      'weapon_usp_silencer',
      'weapon_hkp2000',
      'weapon_p250',
      'weapon_fiveseven',
      'weapon_cz75a',
      'weapon_elite',
      'weapon_deagle',
      'weapon_revolver',
    ],
    mid: [
      'weapon_mp9',
      'weapon_mp7',
      'weapon_mp5sd',
      'weapon_ump45',
      'weapon_p90',
      'weapon_bizon',
      'weapon_nova',
      'weapon_xm1014',
      'weapon_mag7',
      'weapon_m249',
      'weapon_negev',
    ],
    rifle: [
      'weapon_famas',
      'weapon_m4a1',
      'weapon_m4a1_silencer',
      'weapon_aug',
      'weapon_ssg08',
      'weapon_awp',
      'weapon_scar20',
    ],
  },
};

/** The pistols a round starts with: only these go in the first pistol slot. */
export const STARTING_PISTOLS = ['weapon_glock', 'weapon_usp_silencer', 'weapon_hkp2000'];

/** CS2's default loadout per side. */
export const DEFAULT_LAYOUT: Layout = {
  '2': {
    pistol: ['weapon_glock', 'weapon_p250', 'weapon_tec9', 'weapon_elite', 'weapon_deagle'],
    mid: ['weapon_mac10', 'weapon_mp7', 'weapon_ump45', 'weapon_nova', 'weapon_xm1014'],
    rifle: ['weapon_galilar', 'weapon_ak47', 'weapon_sg556', 'weapon_ssg08', 'weapon_awp'],
  },
  '3': {
    pistol: [
      'weapon_usp_silencer',
      'weapon_p250',
      'weapon_fiveseven',
      'weapon_elite',
      'weapon_deagle',
    ],
    mid: ['weapon_mp9', 'weapon_mp7', 'weapon_ump45', 'weapon_nova', 'weapon_mag7'],
    rifle: ['weapon_famas', 'weapon_m4a1', 'weapon_aug', 'weapon_ssg08', 'weapon_awp'],
  },
};

/** Notices a player can close for good. */
const TIPS = ['loadout-same-as-game', 'inventory-intro'] as const;

/**
 * A layout as sent, checked: five different weapons per column, each from that
 * side's column, a starting pistol first and only there. Anything else is refused.
 */
export function parseLayout(raw: Untrusted): Layout {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Untrusted>;
  const side = (key: '2' | '3'): SideLayout => {
    const value = input[key];
    const sideIn = (value && typeof value === 'object' ? value : {}) as Record<string, Untrusted>;
    return {
      pistol: parseColumn(sideIn.pistol, POOLS[key].pistol, true),
      mid: parseColumn(sideIn.mid, POOLS[key].mid, false),
      rifle: parseColumn(sideIn.rifle, POOLS[key].rifle, false),
    };
  };
  return { '2': side('2'), '3': side('3') };
}

/** One column: five different weapons from its pool; the pistols start with a starting pistol. */
function parseColumn(list: Untrusted, pool: string[], pistols: boolean): string[] {
  if (!Array.isArray(list) || list.length !== 5)
    throw new SkinError(400, 'Each column has five weapons.');
  const weapons = list.map(String);
  if (new Set(weapons).size !== 5) throw new SkinError(400, 'A weapon shows only once.');
  if (weapons.some((w) => !pool.includes(w)))
    throw new SkinError(400, "A weapon is not in that side's column.");
  if (pistols) {
    if (!STARTING_PISTOLS.includes(weapons[0]))
      throw new SkinError(400, 'The first pistol is the one a round starts with.');
    if (weapons.slice(1).some((w) => STARTING_PISTOLS.includes(w)))
      throw new SkinError(400, 'A starting pistol goes only in the first slot.');
  }
  return weapons;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cleanItems(raw: string): LoadoutItem[] {
  const list = parseJson<Untrusted[]>(raw, []);
  return (Array.isArray(list) ? list : [])
    .map((i) => i as Record<string, Untrusted>)
    .filter(
      (i) =>
        typeof i.slot === 'string' &&
        Number.isInteger(i.skinId) &&
        [0, 2, 3].includes(Number(i.team))
    )
    .map((i) => ({
      slot: String(i.slot),
      skinId: Number(i.skinId),
      team: Number(i.team) as LoadoutTeam,
    }));
}

function cleanAgents(raw: string): Array<{ team: 2 | 3; model: string }> {
  const list = parseJson<Untrusted[]>(raw, []);
  return (Array.isArray(list) ? list : [])
    .map((a) => a as Record<string, Untrusted>)
    .filter((a) => (a.team === 2 || a.team === 3) && typeof a.model === 'string')
    .map((a) => ({ team: a.team as 2 | 3, model: String(a.model) }));
}

/** A loadout name as stored: one line, no control characters, at most 24 characters. */
export function cleanName(raw: Untrusted): string {
  if (typeof raw !== 'string') return '';
  // eslint-disable-next-line no-control-regex -- strip control characters from a name
  const oneLine = raw.replace(/[\u0000-\u001f\u007f]/g, ' ');
  const text = oneLine.replace(/\s+/g, ' ').trim();
  return [...text].slice(0, LOADOUT_NAME_MAX).join('');
}

function cleanColor(raw: Untrusted, fallback: string): string {
  return typeof raw === 'string' && (LOADOUT_COLORS as readonly string[]).includes(raw)
    ? raw
    : fallback;
}

interface Row {
  id: number;
  name: string;
  color: string;
  items: string;
  agents: string;
}

interface Prefs {
  active: number | null;
  layout: Layout;
  tips: string[];
  showLoadout: boolean;
}

async function liveItems(uid: string): Promise<LoadoutItem[]> {
  const rows = await db.queryAsync<{ slot: string; skin_id: number; team: number }>(
    'SELECT slot, skin_id, team FROM cs2_player_loadout WHERE player_uid = ? ORDER BY slot, team',
    [uid]
  );
  return rows.map((r) => ({
    slot: r.slot,
    skinId: Number(r.skin_id),
    team: Number(r.team) as LoadoutTeam,
  }));
}

export const loadouts = {
  /** The player's preferences (defaults for a player who never set any). */
  async prefs(uid: string): Promise<Prefs> {
    return withFreeSchema(async () => {
      const row = await db.queryOneAsync<{
        active_loadout: number | null;
        layout: string | null;
        tips: string;
        show_loadout: boolean;
      }>('SELECT * FROM cs2_player_skin_prefs WHERE player_uid = ?', [uid]);
      let layout = DEFAULT_LAYOUT;
      if (row?.layout) {
        try {
          layout = parseLayout(JSON.parse(row.layout));
        } catch {
          layout = DEFAULT_LAYOUT;
        }
      }
      const tips = parseJson<Untrusted[]>(row?.tips, []);
      return {
        active: row?.active_loadout ?? null,
        layout,
        tips: (Array.isArray(tips) ? tips : []).filter((x): x is string => typeof x === 'string'),
        showLoadout: row ? row.show_loadout !== false : true,
      };
    });
  },

  async savePrefs(
    uid: string,
    change: { active?: number | null; layout?: Layout; tips?: string[]; showLoadout?: boolean }
  ): Promise<void> {
    const now = await this.prefs(uid);
    const next = { ...now, ...change };
    await withFreeSchema(() =>
      db.runAsync(
        `INSERT INTO cs2_player_skin_prefs (player_uid, active_loadout, layout, tips, show_loadout)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (player_uid) DO UPDATE SET active_loadout = EXCLUDED.active_loadout,
           layout = EXCLUDED.layout, tips = EXCLUDED.tips, show_loadout = EXCLUDED.show_loadout`,
        [uid, next.active, JSON.stringify(next.layout), JSON.stringify(next.tips), next.showLoadout]
      )
    );
  },

  /** Close a notice for good (`loadout-same-as-game`, `inventory-intro`). */
  async closeTip(uid: string, tipRaw: Untrusted): Promise<string[]> {
    const tip = String(tipRaw);
    if (!(TIPS as readonly string[]).includes(tip)) throw new SkinError(400, 'No such notice.');
    const { tips } = await this.prefs(uid);
    const next = tips.includes(tip) ? tips : [...tips, tip];
    await this.savePrefs(uid, { tips: next });
    return next;
  },

  /** Every saved loadout, the active one's items read live. A player with none gets their first. */
  async list(uid: string): Promise<SavedLoadout[]> {
    return withFreeSchema(async () => {
      let rows = await db.queryAsync<Row>(
        'SELECT id, name, color, items, agents FROM cs2_player_saved_loadouts WHERE player_uid = ? ORDER BY id',
        [uid]
      );
      const prefs = await this.prefs(uid);
      if (!rows.length) {
        const made = await db.queryOneAsync<{ id: number }>(
          `INSERT INTO cs2_player_saved_loadouts (player_uid, name, color) VALUES (?, '', ?) RETURNING id`,
          [uid, LOADOUT_COLORS[0]]
        );
        if (!made) throw new SkinError(500, 'The loadout could not be made.');
        await this.savePrefs(uid, { active: made.id });
        rows = [{ id: made.id, name: '', color: LOADOUT_COLORS[0], items: '[]', agents: '[]' }];
        prefs.active = made.id;
      }
      let active = rows.find((r) => r.id === prefs.active)?.id;
      if (active === undefined) {
        active = rows[0].id;
        await this.savePrefs(uid, { active });
      }
      const live = await liveItems(uid);
      const agents = await agentsOf(uid);
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        active: r.id === active,
        items: r.id === active ? live : cleanItems(r.items),
        agents: r.id === active ? agents : cleanAgents(r.agents),
      }));
    });
  },

  /** Write the live loadout into the active saved one. */
  async snapshot(uid: string): Promise<void> {
    const all = await this.list(uid);
    const active = all.find((l) => l.active);
    if (!active) return;
    await db.runAsync(
      'UPDATE cs2_player_saved_loadouts SET items = ?, agents = ? WHERE id = ? AND player_uid = ?',
      [JSON.stringify(active.items), JSON.stringify(active.agents), active.id, uid]
    );
  },

  /** Switch to another saved loadout: the current one is saved, the other one goes live. */
  async activate(uid: string, idRaw: Untrusted): Promise<void> {
    const id = Number(idRaw);
    const all = await this.list(uid);
    const target = all.find((l) => l.id === id);
    if (!target) throw new SkinError(404, 'No such loadout.');
    if (target.active) return;
    await this.snapshot(uid);
    const owned = new Set(
      (
        await db.queryAsync<{ id: number }>(
          'SELECT id FROM cs2_player_skins WHERE player_uid = ?',
          [uid]
        )
      ).map((r) => Number(r.id))
    );
    await db.withClient(async (client) => {
      await client.query('BEGIN');
      try {
        await client.query('DELETE FROM cs2_player_loadout WHERE player_uid = $1', [uid]);
        for (const item of target.items.filter((i) => owned.has(i.skinId))) {
          await client.query(
            `INSERT INTO cs2_player_loadout (player_uid, slot, skin_id, team) VALUES ($1, $2, $3, $4)
             ON CONFLICT (player_uid, slot, team) DO UPDATE SET skin_id = EXCLUDED.skin_id`,
            [uid, item.slot, item.skinId, item.team]
          );
        }
        await client.query('DELETE FROM cs2_player_agents WHERE player_uid = $1', [uid]);
        for (const agent of target.agents) {
          await client.query(
            'INSERT INTO cs2_player_agents (player_uid, team, model) VALUES ($1, $2, $3)',
            [uid, agent.team, agent.model]
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
    await this.savePrefs(uid, { active: target.id });
  },

  /** A new loadout, a copy of the active one or empty, switched to at once. */
  async create(
    uid: string,
    input: { name: Untrusted; color: Untrusted; copy: Untrusted }
  ): Promise<number> {
    const all = await this.list(uid);
    if (all.length >= MAX_LOADOUTS)
      throw new SkinError(400, `At most ${MAX_LOADOUTS} saved loadouts.`);
    const name = cleanName(input.name);
    if (!name) throw new SkinError(400, 'Give the loadout a name.');
    const unused = LOADOUT_COLORS.find((c) => !all.some((l) => l.color === c)) ?? LOADOUT_COLORS[0];
    const active = all.find((l) => l.active);
    const copy = input.copy !== false && !!active;
    const row = await db.queryOneAsync<{ id: number }>(
      `INSERT INTO cs2_player_saved_loadouts (player_uid, name, color, items, agents)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [
        uid,
        name,
        cleanColor(input.color, unused),
        JSON.stringify(copy ? active.items : []),
        JSON.stringify(copy ? active.agents : []),
      ]
    );
    if (!row) throw new SkinError(500, 'The loadout could not be made.');
    await this.activate(uid, row.id);
    return row.id;
  },

  async update(uid: string, idRaw: Untrusted, input: { name?: Untrusted; color?: Untrusted }) {
    const id = Number(idRaw);
    const all = await this.list(uid);
    const target = all.find((l) => l.id === id);
    if (!target) throw new SkinError(404, 'No such loadout.');
    const name = input.name === undefined ? target.name : cleanName(input.name);
    if (input.name !== undefined && !name) throw new SkinError(400, 'Give the loadout a name.');
    await db.runAsync(
      'UPDATE cs2_player_saved_loadouts SET name = ?, color = ? WHERE id = ? AND player_uid = ?',
      [name, cleanColor(input.color, target.color), id, uid]
    );
  },

  /** Throw a loadout away (never the last one); the active one hands over to another first. */
  async remove(uid: string, idRaw: Untrusted): Promise<void> {
    const id = Number(idRaw);
    const all = await this.list(uid);
    const target = all.find((l) => l.id === id);
    if (!target) throw new SkinError(404, 'No such loadout.');
    if (all.length === 1) throw new SkinError(400, 'Keep at least one loadout.');
    if (target.active) {
      const next = all.find((l) => l.id !== id);
      if (next) await this.activate(uid, next.id);
    }
    await db.runAsync('DELETE FROM cs2_player_saved_loadouts WHERE id = ? AND player_uid = ?', [
      id,
      uid,
    ]);
  },
};

/**
 * Fork (free mode): the loadout pages' shared data. The saved loadouts, the
 * weapons each side's loadout shows, the notices a player closed, and the
 * rules for moving weapons between slots (the same ones the API checks:
 * api skins/loadouts.ts). No React here: tests can load it directly.
 */

export type Side = 2 | 3;
export type Column = 'pistol' | 'mid' | 'rifle';
export type SideLayout = Record<Column, string[]>;
/** Per side ('2' T, '3' CT): the weapons each column shows, in order. */
export type Layout = Record<'2' | '3', SideLayout>;

export const COLUMNS: Column[] = ['pistol', 'mid', 'rifle'];

/** The side colours CS2 itself uses (the scoreboard, the team select). */
export const SIDE_COLOR: Record<Side, string> = { 3: '#5d79ae', 2: '#de9b35' };
/** The side's colour as text on the page's dark paper (a little lighter). */
export const SIDE_TEXT: Record<Side, string> = { 3: '#8ea6d6', 2: '#e9b25e' };

export interface LoadoutItem {
  slot: string;
  skinId: number;
  team: 0 | 2 | 3;
}

export interface SavedLoadout {
  id: number;
  /** '' for the first one: the page names it ("Main"). */
  name: string;
  color: string;
  active: boolean;
  items: LoadoutItem[];
  agents: Array<{ team: Side; model: string }>;
}

export interface LoadoutState {
  loadouts: SavedLoadout[];
  layout: Layout;
  tips: string[];
  showLoadout: boolean;
  /** The player is on one of the site's servers right now. */
  onServer: boolean;
  colors: string[];
  max: number;
  pools: Layout;
  startingPistols: string[];
  defaultLayout: Layout;
}

/** Notices a player can close for good. */
export const TIP_SAME_AS_GAME = 'loadout-same-as-game';
export const TIP_INVENTORY = 'inventory-intro';

/** Whether a weapon may sit in this slot of this side's column. */
export function fitsSlot(
  state: Pick<LoadoutState, 'pools' | 'startingPistols'>,
  side: Side,
  column: Column,
  index: number,
  weapon: string
): boolean {
  if (!state.pools[side][column].includes(weapon)) return false;
  if (column !== 'pistol') return true;
  return (index === 0) === state.startingPistols.includes(weapon);
}

/** The column a weapon belongs to on a side, or null when that side cannot buy it. */
export function columnOf(
  state: Pick<LoadoutState, 'pools'>,
  side: Side,
  weapon: string
): Column | null {
  return COLUMNS.find((c) => state.pools[side][c].includes(weapon)) ?? null;
}

export type Move =
  /** Two slots of one column trade places. */
  | { kind: 'swap'; column: Column; from: number; to: number }
  /** A weapon from outside the loadout takes a slot; the one there leaves. */
  | { kind: 'place'; column: Column; to: number; weapon: string };

/** The layout after a move, or null when the move is not allowed. */
export function applyMove(
  state: Pick<LoadoutState, 'layout' | 'pools' | 'startingPistols'>,
  side: Side,
  move: Move
): Layout | null {
  const list = [...state.layout[side][move.column]];
  if (move.kind === 'swap') {
    if (move.from === move.to) return null;
    const a = list[move.from];
    const b = list[move.to];
    if (!a || !b) return null;
    if (!fitsSlot(state, side, move.column, move.to, a)) return null;
    if (!fitsSlot(state, side, move.column, move.from, b)) return null;
    list[move.from] = b;
    list[move.to] = a;
  } else {
    if (list.includes(move.weapon)) return null;
    if (!fitsSlot(state, side, move.column, move.to, move.weapon)) return null;
    list[move.to] = move.weapon;
  }
  return { ...state.layout, [side]: { ...state.layout[side], [move.column]: list } };
}

/** The weapons a side can buy that its loadout does not show, per column. */
export function outside(
  state: Pick<LoadoutState, 'layout' | 'pools'>,
  side: Side
): Record<Column, string[]> {
  const left = (c: Column) =>
    state.pools[side][c].filter((w) => !state.layout[side][c].includes(w));
  return { pistol: left('pistol'), mid: left('mid'), rifle: left('rifle') };
}

/** Where a skin is equipped in a saved loadout (sides 2 and 3; "both" counts as both). */
export function sidesIn(loadout: SavedLoadout, skinId: number): Side[] {
  const teams = loadout.items.filter((i) => i.skinId === skinId).map((i) => i.team);
  const out: Side[] = [];
  if (teams.includes(3) || teams.includes(0)) out.push(3);
  if (teams.includes(2) || teams.includes(0)) out.push(2);
  return out;
}

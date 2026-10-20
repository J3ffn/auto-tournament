/**
 * Fork: free skin mode on the client (api: skins/freeRoutes.ts). While the
 * site has it on, a player picks any finish, sets its float, pattern,
 * StatTrak and name tag, and picks an agent per side.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../module-sdk';
import { announceChange, type OwnedSkin, type Rarity } from './useSkins';
import type { LoadoutTeam } from './loadoutSides';

/** CS2 caps a name tag at 20 characters (the API trims to it too). */
export const NAMETAG_MAX = 20;

/** A float in the middle of each wear range, for the quick buttons. */
export const WEAR_PRESETS: Array<{ key: 'fn' | 'mw' | 'ft' | 'ww' | 'bs'; float: number }> = [
  { key: 'fn', float: 0.01 },
  { key: 'mw', float: 0.1 },
  { key: 'ft', float: 0.25 },
  { key: 'ww', float: 0.41 },
  { key: 'bs', float: 0.6 },
];

export interface FreeCatalogSkin {
  weapon: string;
  weaponName: string;
  paintKit: number;
  name: string;
  variant: string | null;
  rarity: Rarity;
  slot: string;
  side: 2 | 3 | null;
  /** The full-size picture (skinCardUrl() gives the card size). */
  image: string;
  statTrak: boolean;
  /** A knife model with no finish: its default look (paint kit 0). */
  vanilla?: boolean;
}

/** Each slot's default look: `<weapon>`, and `knife:2` / `knife:3` / `gloves:2` / `gloves:3` per side. */
export type DefaultLooks = Record<string, string>;

export interface FreeAgent {
  team: 2 | 3;
  name: string;
  model: string;
  image: string;
  color: string;
}

export interface FreeCustom {
  float: number;
  pattern: number;
  stattrak: boolean;
  nametag: string;
}

/** "Fade (Phase 2)": the name an owned copy of this finish shows. */
export function freeSkinName(skin: Pick<FreeCatalogSkin, 'name' | 'variant'>): string {
  return skin.variant ? `${skin.name} (${skin.variant})` : skin.name;
}

/** The player's own picked copy of a catalogue finish, if they made one. */
export function ownedCopy(
  inventory: OwnedSkin[],
  skin: Pick<FreeCatalogSkin, 'weapon' | 'name' | 'variant'>
): OwnedSkin | undefined {
  const name = freeSkinName(skin);
  return inventory.find((s) => s.source === 'free' && s.weapon === skin.weapon && s.name === name);
}

/** What an owned skin is set to now, for the editor. */
export function customOf(skin: OwnedSkin): FreeCustom {
  return {
    float: skin.float,
    pattern: skin.pattern,
    stattrak: skin.stattrak !== null && skin.stattrak !== undefined,
    nametag: skin.nametag ?? '',
  };
}

/** A fresh finish: Factory New, a random pattern, no StatTrak, no name tag. */
export function freshCustom(): FreeCustom {
  return { float: 0.01, pattern: Math.floor(Math.random() * 1001), stattrak: false, nametag: '' };
}

function body(custom: FreeCustom) {
  return {
    float: custom.float,
    pattern: custom.pattern,
    stattrak: custom.stattrak,
    nametag: custom.nametag.trim() || null,
  };
}

/** Pick a catalogue finish with these settings, and equip it for a side (0 both, 2 T, 3 CT). */
export async function pickFree(
  skin: FreeCatalogSkin,
  custom: FreeCustom,
  team: LoadoutTeam
): Promise<number> {
  const r = await api.post<{ skinId: number }>('/api/skins/me/free', {
    weapon: skin.weapon,
    paintKit: skin.paintKit,
    team,
    ...body(custom),
  });
  announceChange();
  return r.skinId;
}

/** Change one of the player's own skins. */
export async function editSkin(skinId: number, custom: FreeCustom): Promise<void> {
  await api.patch(`/api/skins/me/skins/${skinId}`, body(custom));
  announceChange();
}

/** Throw away one of the player's picked skins. */
export async function removeFreeSkin(skinId: number): Promise<void> {
  await api.delete(`/api/skins/me/skins/${skinId}`);
  announceChange();
}

/** Every finish there is, and each slot's default look, loaded the first time `active` is true. */
export function useFreeCatalog(active: boolean) {
  const [skins, setSkins] = useState<FreeCatalogSkin[] | null>(null);
  const [defaults, setDefaults] = useState<DefaultLooks>({});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!active || skins) return;
    let cancelled = false;
    api
      .get<{ skins: FreeCatalogSkin[]; defaults?: DefaultLooks }>('/api/skins/free/catalog')
      .then((r) => {
        if (cancelled) return;
        setSkins(r.skins ?? []);
        setDefaults(r.defaults ?? {});
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [active, skins]);
  return { skins, defaults, failed };
}

/** The agents per side, the player's picks, and setting one (null: the game's default). */
export function useFreeAgents(active: boolean) {
  const [agents, setAgents] = useState<FreeAgent[]>([]);
  const [mine, setMine] = useState<{ ct: string | null; t: string | null }>({ ct: null, t: null });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    api
      .get<{ agents: FreeAgent[]; mine: { ct: string | null; t: string | null } | null }>(
        '/api/skins/free/agents'
      )
      .then((r) => {
        if (cancelled) return;
        setAgents(r.agents ?? []);
        setMine(r.mine ?? { ct: null, t: null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [active]);

  const setAgent = useCallback(async (team: 2 | 3, model: string | null) => {
    const r = await api.put<{ mine: { ct: string | null; t: string | null } }>(
      '/api/skins/me/agents',
      { team, model }
    );
    setMine(r.mine);
  }, []);

  return { agents, mine, setAgent };
}

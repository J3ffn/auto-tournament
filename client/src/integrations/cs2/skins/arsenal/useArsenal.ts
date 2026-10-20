import { useCallback, useMemo, useState } from 'react';
import { useModuleTranslation } from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { useMySkins, type OwnedSkin, type Rarity } from '../useSkins';
import { useFreeAgents, useFreeCatalog, type FreeAgent, type FreeCatalogSkin } from '../freeSkins';
import { bothSides, firstSlot, sideHas, slotsFor, type Side } from './slots';

/** One loadout row: the slot's name, its picture, and what is on it. */
export interface SlotView {
  id: string;
  label: string;
  /** The equipped skin's picture, else the game's default look (null: nothing to show). */
  image: string | null;
  /** The equipped skin's name, or null for the game's default. */
  equipped: string | null;
  rarity: Rarity | null;
  skin: OwnedSkin | null;
  agent: FreeAgent | null;
}

/** Whether an owned skin is on this side (equipped for it, or for both). */
function onSide(skin: OwnedSkin, side: Side): boolean {
  return skin.equippedSides.includes(side) || skin.equippedSides.includes(0);
}

/** The slot a catalogue finish or owned skin goes in (knife, gloves, or its weapon). */
export function slotOfWeapon(weapon: string): string {
  if (weapon.startsWith('weapon_knife') || weapon === 'weapon_bayonet') return 'knife';
  if (weapon.includes('gloves') || weapon.includes('handwraps')) return 'gloves';
  return weapon;
}

/**
 * Fork (free mode): what the Arsenal page works from. The player's skins and
 * their actions, the catalogue and each slot's default look, the agents, and
 * the side and slot being looked at.
 */
export function useArsenal() {
  const { t } = useModuleTranslation('cs2');
  const mine = useMySkins();
  const { skins, defaults, failed } = useFreeCatalog(true);
  const agents = useFreeAgents(true);
  const [side, setSideState] = useState<Side>(2);
  const [slot, setSlot] = useState<string>(firstSlot(2));

  const names = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of skins ?? []) out[s.weapon] ??= s.weaponName;
    return out;
  }, [skins]);

  const equippedIn = useCallback(
    (slotId: string, onThis: Side): OwnedSkin | null =>
      mine.inventory.find((s) => s.slot === slotId && onSide(s, onThis)) ?? null,
    [mine.inventory]
  );

  const view = useCallback(
    (slotId: string): SlotView => {
      if (slotId === 'agent') {
        const model = side === 3 ? agents.mine.ct : agents.mine.t;
        const agent = agents.agents.find((a) => a.model === model) ?? null;
        return {
          id: slotId,
          label: t('skins.arsenal.slot.agent'),
          image: agent?.image ?? null,
          equipped: agent?.name ?? null,
          rarity: null,
          skin: null,
          agent,
        };
      }
      const skin = equippedIn(slotId, side);
      const label =
        slotId === 'knife' || slotId === 'gloves'
          ? t(`skins.arsenal.slot.${slotId}`)
          : (names[slotId] ?? slotId.replace('weapon_', '').toUpperCase());
      const fallback =
        slotId === 'knife' || slotId === 'gloves'
          ? defaults[`${slotId}:${side}`]
          : defaults[slotId];
      return {
        id: slotId,
        label,
        image: skin ? skinCardUrl(skin.imageUrl) : (fallback ?? null),
        equipped: skin ? skinName(skin, t) : null,
        rarity: skin?.rarity ?? null,
        skin,
        agent: null,
      };
    },
    [agents.agents, agents.mine, defaults, equippedIn, names, side, t]
  );

  const setSide = useCallback(
    (next: Side) => {
      setSideState(next);
      if (!sideHas(next, slot)) setSlot(firstSlot(next));
    },
    [slot]
  );

  /**
   * The other side gets this side's picks for every slot both sides use (a
   * pick there goes on for both). Slots this side left at the default, and the
   * agent (each side has its own), are left alone.
   */
  const copyToOther = useCallback(async () => {
    const ids = slotsFor(side)
      .flatMap((g) => g.slots)
      .map((s) => s.id)
      .filter((id) => id !== 'agent' && bothSides(id));
    for (const id of ids) {
      const skin = equippedIn(id, side);
      if (skin && !skin.equippedSides.includes(0)) await mine.equipOn(skin, 0);
    }
  }, [equippedIn, mine, side]);

  return {
    mine,
    catalog: skins,
    catalogFailed: failed,
    defaults,
    agents,
    side,
    setSide,
    slot,
    setSlot,
    view,
    copyToOther,
  };
}

/** A skin's name as the loadout shows it: a knife model's plain look reads "Default". */
export function skinName(
  skin: Pick<OwnedSkin, 'name' | 'weaponName' | 'slot'>,
  t: (key: string) => string
): string {
  const finish = skin.name === 'Vanilla' ? t('skins.arsenal.default') : skin.name;
  return skin.slot === 'knife' || skin.slot === 'gloves'
    ? `${skin.weaponName} | ${finish}`
    : finish;
}

/** A catalogue finish's display name ("Doppler (Sapphire)", "Default"). */
export function finishName(skin: FreeCatalogSkin, t: (key: string) => string): string {
  if (skin.vanilla) return t('skins.arsenal.default');
  return skin.variant ? `${skin.name} (${skin.variant})` : skin.name;
}

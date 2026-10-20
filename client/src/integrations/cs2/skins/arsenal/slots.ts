/**
 * Fork (free mode): every loadout slot of CS2, grouped as the game's buy menu
 * groups them, with the sides that use each. A slot id is the weapon's class
 * (`weapon_ak47`), or `knife`, `gloves` or `agent`.
 */

export type Side = 2 | 3;
export type GroupId = 'char' | 'pistol' | 'smg' | 'rifle' | 'heavy' | 'gear';

export interface SlotDef {
  id: string;
  sides: Side[];
}

const BOTH: Side[] = [2, 3];
const T: Side[] = [2];
const CT: Side[] = [3];

export const SLOT_GROUPS: Array<{ id: GroupId; slots: SlotDef[] }> = [
  {
    id: 'char',
    slots: [
      { id: 'knife', sides: BOTH },
      { id: 'gloves', sides: BOTH },
      { id: 'agent', sides: BOTH },
    ],
  },
  {
    id: 'pistol',
    slots: [
      { id: 'weapon_glock', sides: T },
      { id: 'weapon_usp_silencer', sides: CT },
      { id: 'weapon_hkp2000', sides: CT },
      { id: 'weapon_p250', sides: BOTH },
      { id: 'weapon_tec9', sides: T },
      { id: 'weapon_fiveseven', sides: CT },
      { id: 'weapon_cz75a', sides: BOTH },
      { id: 'weapon_elite', sides: BOTH },
      { id: 'weapon_deagle', sides: BOTH },
      { id: 'weapon_revolver', sides: BOTH },
    ],
  },
  {
    id: 'smg',
    slots: [
      { id: 'weapon_mac10', sides: T },
      { id: 'weapon_mp9', sides: CT },
      { id: 'weapon_mp7', sides: BOTH },
      { id: 'weapon_mp5sd', sides: BOTH },
      { id: 'weapon_ump45', sides: BOTH },
      { id: 'weapon_p90', sides: BOTH },
      { id: 'weapon_bizon', sides: BOTH },
    ],
  },
  {
    id: 'rifle',
    slots: [
      { id: 'weapon_galilar', sides: T },
      { id: 'weapon_famas', sides: CT },
      { id: 'weapon_ak47', sides: T },
      { id: 'weapon_m4a1', sides: CT },
      { id: 'weapon_m4a1_silencer', sides: CT },
      { id: 'weapon_sg556', sides: T },
      { id: 'weapon_aug', sides: CT },
      { id: 'weapon_ssg08', sides: BOTH },
      { id: 'weapon_awp', sides: BOTH },
      { id: 'weapon_g3sg1', sides: T },
      { id: 'weapon_scar20', sides: CT },
    ],
  },
  {
    id: 'heavy',
    slots: [
      { id: 'weapon_nova', sides: BOTH },
      { id: 'weapon_xm1014', sides: BOTH },
      { id: 'weapon_sawedoff', sides: T },
      { id: 'weapon_mag7', sides: CT },
      { id: 'weapon_m249', sides: BOTH },
      { id: 'weapon_negev', sides: BOTH },
    ],
  },
  { id: 'gear', slots: [{ id: 'weapon_taser', sides: BOTH }] },
];

/** The slots one side has, by group. */
export function slotsFor(side: Side): Array<{ id: GroupId; slots: SlotDef[] }> {
  return SLOT_GROUPS.map((g) => ({
    id: g.id,
    slots: g.slots.filter((s) => s.sides.includes(side)),
  }));
}

/** Whether a slot is one of this side's. */
export function sideHas(side: Side, slotId: string): boolean {
  return SLOT_GROUPS.some((g) => g.slots.some((s) => s.id === slotId && s.sides.includes(side)));
}

/** Whether both sides use a slot (then a skin can go on both at once). */
export function bothSides(slotId: string): boolean {
  return SLOT_GROUPS.some((g) => g.slots.some((s) => s.id === slotId && s.sides.length === 2));
}

/** The slot a side opens on: its main rifle. */
export function firstSlot(side: Side): string {
  return side === 3 ? 'weapon_m4a1_silencer' : 'weapon_ak47';
}

/** A slot that holds several models (each knife, each glove), picked before the finish. */
export function hasModels(slotId: string): boolean {
  return slotId === 'knife' || slotId === 'gloves';
}

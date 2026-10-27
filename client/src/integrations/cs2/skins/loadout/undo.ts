import { api } from '../../../../module-sdk';
import { announceChange, type OwnedSkin } from '../useSkins';

/** A slot's equipped rows (skin and side), to put back with "Undo". */
export function slotRows(
  inventory: OwnedSkin[],
  slot: string
): Array<{ skinId: number; team: number }> {
  return inventory
    .filter((s) => s.slot === slot)
    .flatMap((s) => s.equippedSides.map((team) => ({ skinId: s.id, team })));
}

/** Put a slot back as it was: emptied, then its rows equipped again. */
export async function restoreSlot(
  slot: string,
  rows: Array<{ skinId: number; team: number }>
): Promise<void> {
  try {
    await api.delete(`/api/skins/me/equip/${encodeURIComponent(slot)}`);
    for (const r of rows) await api.post('/api/skins/me/equip', r);
  } finally {
    announceChange();
  }
}

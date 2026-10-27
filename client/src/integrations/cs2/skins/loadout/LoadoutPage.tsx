import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Container, IconButton, Typography } from '@mui/material';
import { InfoIcon, XIcon } from '@phosphor-icons/react';
import {
  apiErrorMessage,
  pageTitle,
  tokens,
  useModuleTranslation,
  useSnackbar,
  withAlpha,
} from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { rarityColor } from '../rarity';
import { useFreeAgents, useFreeCatalog } from '../freeSkins';
import { equippedFor } from '../loadoutSides';
import { useMySkins } from '../useSkins';
import { InventoryHeader } from './InventoryHeader';
import { LoadoutBoard, type Moving } from './LoadoutBoard';
import { loadoutName } from './LoadoutMenu';
import {
  COLUMNS,
  TIP_SAME_AS_GAME,
  applyMove,
  fitsSlot,
  outside,
  type Column,
  type Layout,
  type Move,
  type Side,
} from './model';
import { OrganizePanel } from './OrganizePanel';
import { UndoToast, finishOf, type UndoNotice } from './parts';
import { SlotPicker } from './SlotPicker';
import { useLoadouts } from './useLoadouts';
import type { SlotLook } from './WeaponSlot';

const { color } = tokens;

/**
 * Fork (free mode): the Loadout tab. The loadout as in the game (CT on the
 * left, TR on the right, the side being edited lit up), its weapons movable
 * by dragging (or a click on one, then a slot), and under it either the
 * weapons outside the loadout or, with a slot open, that slot's skins.
 */
export function LoadoutPage() {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const loadouts = useLoadouts();
  const mine = useMySkins();
  const { skins: catalog, defaults } = useFreeCatalog(true);
  const agents = useFreeAgents(true);
  const [side, setSide] = useState<Side>(3);
  const [slot, setSlot] = useState<string | null>(null);
  const [moving, setMoving] = useState<Moving | null>(null);
  const [notice, setNotice] = useState<UndoNotice | null>(null);
  const state = loadouts.state;

  useEffect(() => {
    document.title = pageTitle(t('skins.v2.loadout.title'));
  }, [t]);

  const names = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of catalog ?? []) out[s.weapon] ??= s.weaponName;
    return out;
  }, [catalog]);
  const bySide = useMemo(
    () => ({ 3: equippedFor(mine.inventory, 3), 2: equippedFor(mine.inventory, 2) }),
    [mine.inventory]
  );

  const look = useCallback(
    (slotId: string, s: Side): SlotLook => {
      const skin = bySide[s].get(slotId) ?? null;
      const char = slotId === 'knife' || slotId === 'gloves';
      const fallback = char ? defaults[`${slotId}:${s}`] : defaults[slotId];
      const name = char
        ? t(`skins.v2.slot.${slotId}`)
        : (names[slotId] ?? slotId.replace('weapon_', '').toUpperCase());
      if (!skin)
        return { name, finish: t('skins.v2.default'), image: fallback ?? null, rarity: null };
      const finish = finishOf(skin, t);
      return {
        name,
        finish: char ? `${skin.weaponName} | ${finish}` : finish,
        image: skinCardUrl(skin.imageUrl),
        rarity: skin.name === 'Vanilla' ? null : rarityColor[skin.rarity],
      };
    },
    [bySide, defaults, names, t]
  );
  const agentOf = useCallback(
    (s: Side) => {
      const model = s === 3 ? agents.mine.ct : agents.mine.t;
      return agents.agents.find((a) => a.model === model) ?? null;
    },
    [agents.agents, agents.mine]
  );

  const notify = useCallback((n: UndoNotice) => setNotice(n), []);
  const clearNotice = useCallback(() => setNotice(null), []);

  if (!state || mine.loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        {loadouts.failed ? (
          <Typography sx={{ color: color.ink2 }}>{t('skins.free.failed')}</Typography>
        ) : (
          <CircularProgress aria-label={t('skins.v2.loadout.title')} />
        )}
      </Box>
    );
  }

  const layout = state.layout;
  const commit = (move: Move) => {
    setMoving(null);
    const next = applyMove(state, side, move);
    if (!next) return;
    const prev: Layout = layout;
    const list = layout[side][move.column];
    const a = move.kind === 'swap' ? list[move.from] : move.weapon;
    const b = list[move.to];
    void loadouts
      .saveLayout(next)
      .then(() =>
        notify({
          text:
            move.kind === 'swap'
              ? t('skins.v2.loadout.swapped', { a: look(a, side).name, b: look(b, side).name })
              : t('skins.v2.loadout.placed', { a: look(a, side).name, b: look(b, side).name }),
          undo: () => void loadouts.saveLayout(prev).catch(() => undefined),
        })
      )
      .catch((error: unknown) => showError(apiErrorMessage(error, t('skins.free.failed'))));
  };
  const drop = (column: Column, index: number) => {
    if (!moving || moving.column !== column) return;
    if (moving.from === null) commit({ kind: 'place', column, to: index, weapon: moving.weapon });
    else commit({ kind: 'swap', column, from: moving.from, to: index });
  };
  const canTake = (column: Column, index: number) => {
    if (!moving || moving.column !== column) return false;
    if (moving.from === null) return fitsSlot(state, side, column, index, moving.weapon);
    const other = layout[side][column][index];
    return (
      fitsSlot(state, side, column, index, moving.weapon) &&
      fitsSlot(state, side, column, moving.from, other)
    );
  };
  const resetLayout = () => {
    const prev = layout;
    const next: Layout = { ...layout, [side]: state.defaultLayout[side] };
    void loadouts
      .saveLayout(next)
      .then(() =>
        notify({
          text: t('skins.v2.loadout.layoutReset', {
            side: side === 3 ? t('skins.side.ct') : t('skins.side.t'),
          }),
          undo: () => void loadouts.saveLayout(prev).catch(() => undefined),
        })
      )
      .catch((error: unknown) => showError(apiErrorMessage(error, t('skins.free.failed'))));
  };
  const isDefault = COLUMNS.every(
    (c) => layout[side][c].join() === state.defaultLayout[side][c].join()
  );

  const select = (slotId: string, s: Side) => {
    setMoving(null);
    if (s !== side) setSide(s);
    setSlot(slotId === slot && s === side ? null : slotId);
  };
  const resetSide = async (s: Side) => {
    const on = bySide[s].get(slot ?? '');
    if (on) await mine.equip(on, s);
  };
  const shared = (() => {
    if (!slot || slot === 'agent') return false;
    if (slot === 'knife' || slot === 'gloves') return true;
    return COLUMNS.some(
      (c) => state.pools[3][c].includes(slot) && state.pools[2][c].includes(slot)
    );
  })();
  const defaultLook = (slotId: string) =>
    (slotId === 'knife' || slotId === 'gloves'
      ? defaults[`${slotId}:${side}`]
      : defaults[slotId]) ?? null;
  const showTip = !state.tips.includes(TIP_SAME_AS_GAME);
  const active = loadouts.active;
  const equippedCount = new Set([...bySide[3].values(), ...bySide[2].values()].map((s) => s.id))
    .size;

  return (
    <Box data-testid="loadout-page">
      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 3, md: 5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2.25,
          '@media (max-height: 820px)': { py: 2, gap: 1.5 },
        }}
      >
        <InventoryHeader
          tab="loadout"
          loadouts={loadouts}
          subtitle={t('skins.v2.loadout.subtitle', { count: equippedCount })}
        />

        {showTip && (
          <Box
            role="note"
            aria-labelledby="loadout-tip-title"
            data-testid="loadout-tip"
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.75,
              p: '14px 12px 14px 16px',
              borderRadius: '10px',
              bgcolor: color.paper2,
              border: `1px solid ${withAlpha(color.info, 0.45)}`,
            }}
          >
            <InfoIcon
              size={20}
              color={color.info}
              aria-hidden
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography id="loadout-tip-title" sx={{ fontWeight: 700 }}>
                {t('skins.v2.loadout.tipTitle')}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: color.ink2 }}>
                {t('skins.v2.loadout.tipBody')}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void loadouts.closeTip(TIP_SAME_AS_GAME)}
                  data-testid="loadout-tip-ok"
                  sx={{
                    borderRadius: '6px',
                    bgcolor: color.ink,
                    color: color.paper,
                    '&:hover': { bgcolor: color.ink2 },
                  }}
                >
                  {t('skins.v2.gotIt')}
                </Button>
              </Box>
            </Box>
            <IconButton
              onClick={() => void loadouts.closeTip(TIP_SAME_AS_GAME)}
              aria-label={t('skins.v2.closeNotice')}
              sx={{ borderRadius: '6px' }}
            >
              <XIcon size={16} />
            </IconButton>
          </Box>
        )}

        {state.onServer && (
          <Box
            role="status"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              fontSize: '0.8125rem',
              color: color.ink2,
            }}
          >
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: color.live,
                boxShadow: `0 0 0 4px ${withAlpha(color.live, 0.18)}`,
              }}
            />
            <span>
              <Box component="b" sx={{ color: color.ink, fontWeight: 600 }}>
                {t('skins.v2.loadout.onServer')}
              </Box>{' '}
              {t('skins.v2.loadout.onServerHint')}
            </span>
          </Box>
        )}

        <LoadoutBoard
          side={side}
          onSide={(s) => {
            setSide(s);
            setMoving(null);
            if (slot && slot !== 'knife' && slot !== 'gloves' && slot !== 'agent') setSlot(null);
          }}
          columns={layout[side]}
          poolSize={{
            pistol: state.pools[side].pistol.length,
            mid: state.pools[side].mid.length,
            rifle: state.pools[side].rifle.length,
          }}
          look={look}
          agentOf={agentOf}
          selected={slot}
          onSelect={select}
          moving={moving}
          canTake={canTake}
          onDragStart={(m) => {
            setSlot(null);
            setMoving(m);
          }}
          onDragEnd={() => setMoving((m) => (m && m.from !== null ? null : m))}
          onDrop={drop}
          startingPistols={state.startingPistols}
        />

        {slot ? (
          <SlotPicker
            key={`${slot}:${side}`}
            slotId={slot}
            side={side}
            label={look(slot, side).name}
            shared={shared}
            inventory={mine.inventory}
            equipOn={mine.equipOn}
            resetSide={resetSide}
            catalog={catalog}
            defaultImage={defaultLook(slot)}
            agents={agents}
            loadoutName={active ? loadoutName(active, t) : ''}
            onServer={state.onServer}
            onClose={() => setSlot(null)}
            notify={notify}
          />
        ) : (
          <OrganizePanel
            side={side}
            outside={outside(state, side)}
            look={look}
            moving={moving}
            onPick={setMoving}
            onDragStart={setMoving}
            onDragEnd={() => setMoving(null)}
            onReset={resetLayout}
            isDefault={isDefault}
          />
        )}
      </Container>
      <UndoToast notice={notice} onDone={clearNotice} />
    </Box>
  );
}

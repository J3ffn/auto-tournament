import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  Container,
  Drawer,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  useModuleTranslation,
  useSnackbar,
  tokens,
  fontDisplay,
  radii,
} from '../../../../module-sdk';
import { VirtualNotice } from '../SkinParts';
import {
  editSkin,
  freeSkinName,
  pickFree,
  type FreeCatalogSkin,
  type FreeCustom,
} from '../freeSkins';
import type { OwnedSkin } from '../useSkins';
import { LoadoutColumn } from './LoadoutColumn';
import { MobileLoadout } from './MobileLoadout';
import { SkinInspector, type InspectMode, type InspectTarget } from './SkinInspector';
import { SlotCatalog, finishKey } from './SlotCatalog';
import { bothSides, hasModels, type Side } from './slots';
import { slotOfWeapon, useArsenal } from './useArsenal';
import { SHORT_SCREEN, STICKY_MAX_HEIGHT, STICKY_TOP, WIDE, thinScroll } from './layout';

const { color } = tokens;

/** The player's copy of a catalogue finish (a picked one first), if they have one. */
function copyOf(inventory: OwnedSkin[], skin: FreeCatalogSkin): OwnedSkin | null {
  const name = skin.vanilla ? 'Vanilla' : freeSkinName(skin);
  const mine = inventory.filter((o) => o.weapon === skin.weapon && o.name === name);
  return mine.find((o) => o.source === 'free') ?? mine[0] ?? null;
}

/** A column that stays under the top bar and scrolls on its own when the window is short. */
const stickyColumn = {
  position: 'sticky',
  top: STICKY_TOP,
  maxHeight: STICKY_MAX_HEIGHT,
  minWidth: 0,
} as const;

/**
 * Fork (free mode): the Arsenal. A side (CT or T), its whole loadout on the
 * left, the finishes of the slot picked in the middle, and the panel that sets
 * one up and equips it on the right.
 *
 * Wide screens get the three columns; the loadout and the panel stay under the
 * top bar and never grow past the window, so the panel's buttons are always in
 * reach. Medium screens keep the loadout and the list, and the panel opens from
 * the side. On a phone the loadout is a row of groups and slots, and the panel
 * is a sheet from the bottom.
 */
export function ArsenalPage() {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const phone = useMediaQuery(useTheme().breakpoints.down('md'));
  const wide = useMediaQuery(WIDE);
  let drawer: InspectMode | null = null;
  if (phone) drawer = 'bottom';
  else if (!wide) drawer = 'side';
  const catalogTop = useRef<HTMLDivElement>(null);
  const panelBox = useRef<HTMLDivElement>(null);
  const a = useArsenal();
  const { mine, catalog, side, slot } = a;
  const [picked, setPicked] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copying, setCopying] = useState(false);
  const [agentPick, setAgentPick] = useState<string | null | undefined>(undefined);
  const [sheet, setSheet] = useState(false);

  const current = a.view(slot);
  const byKey = useMemo(() => new Map((catalog ?? []).map((s) => [finishKey(s), s])), [catalog]);

  // A new slot (or side) opens on what is on it: its finish, and for knives and gloves its model.
  const equippedKey = useMemo(() => {
    const on = current.skin;
    if (!on || !catalog) return null;
    const match = catalog.find(
      (s) => s.weapon === on.weapon && (s.vanilla ? 'Vanilla' : freeSkinName(s)) === on.name
    );
    return match ? finishKey(match) : null;
  }, [current.skin, catalog]);
  useEffect(() => {
    setPicked(equippedKey);
    setAgentPick(undefined);
    if (hasModels(slot)) {
      const first = (catalog ?? [])
        .filter((s) => slotOfWeapon(s.weapon) === slot)
        .map((s) => s.weapon)
        .sort()[0];
      setModel(current.skin?.weapon ?? first ?? null);
    }
    // Only when the slot, side or catalogue changes: picks within a slot stay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot, side, catalog]);

  // A slot picked far down the loadout: bring its list's top back into view.
  useEffect(() => {
    const box = catalogTop.current;
    if (box && !phone && box.getBoundingClientRect().top < 0)
      box.scrollIntoView({ block: 'start' });
    // Only when the slot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  /**
   * A finish picked (wide screens): scroll just enough for the whole panel to
   * show, buttons included. Once the column reaches the top bar it sticks
   * there and fits the window, so this is at most the gap above it.
   */
  const revealPanel = () => {
    if (drawer) return;
    // After the panel has drawn the new finish.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const box = panelBox.current;
        if (!box) return;
        const rect = box.getBoundingClientRect();
        const below = rect.bottom - window.innerHeight + 12;
        if (below <= 0) return;
        const stickyTop = parseFloat(window.getComputedStyle(box).top) || 0;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({
          top: Math.min(below, rect.top - stickyTop),
          behavior: reduce ? 'auto' : 'smooth',
        });
      })
    );
  };

  const fail = (error: unknown) =>
    showError(error instanceof Error ? error.message : t('skins.free.failed'));
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      await mine.reload();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const finish = picked ? (byKey.get(picked) ?? null) : null;
  const agentModel = side === 3 ? a.agents.mine.ct : a.agents.mine.t;
  let target: InspectTarget;
  if (slot === 'agent') {
    const chosen = agentPick === undefined ? agentModel : agentPick;
    const agent = a.agents.agents.find((x) => x.model === chosen) ?? null;
    target = { kind: 'agent', agent, current: (agent?.model ?? null) === agentModel };
  } else if (finish) {
    const copy = copyOf(mine.inventory, finish);
    const equipped =
      !!copy && (copy.equippedSides.includes(side) || copy.equippedSides.includes(0));
    target = { kind: 'finish', skin: finish, copy, equipped };
  } else {
    target = {
      kind: 'default',
      label: current.label,
      image: defaultLook(),
      equipped: current.skin,
    };
  }
  function defaultLook(): string | null {
    if (slot === 'knife' || slot === 'gloves') return a.defaults[`${slot}:${side}`] ?? null;
    return a.defaults[slot] ?? null;
  }

  const equip = (custom: FreeCustom, team: 0 | Side) =>
    run(async () => {
      if (target.kind !== 'finish') return;
      const copy = target.copy;
      if (copy) {
        if (!target.skin.vanilla) await editSkin(copy.id, custom);
        await mine.equipOn(copy, team);
      } else {
        await pickFree(target.skin, custom, team);
      }
      if (drawer) setSheet(false);
    });
  const toDefault = () =>
    run(async () => {
      const on = current.skin;
      if (on) await mine.equip(on, side);
      setPicked(null);
      if (drawer) setSheet(false);
    });
  const setAgent = (model: string | null) =>
    run(async () => {
      await a.agents.setAgent(side, model);
      setAgentPick(undefined);
      if (drawer) setSheet(false);
    });
  const copyToOther = async () => {
    setCopying(true);
    try {
      await a.copyToOther();
      await mine.reload();
    } catch (error) {
      fail(error);
    } finally {
      setCopying(false);
    }
  };

  const catalogView = (
    <SlotCatalog
      key={`${slot}:${side}`}
      slotId={slot}
      label={current.label}
      side={side}
      catalog={catalog}
      inventory={mine.inventory}
      model={model}
      onModel={(m) => {
        setModel(m);
        setPicked(null);
      }}
      selected={picked}
      onPick={(s) => {
        setPicked(finishKey(s));
        if (drawer) setSheet(true);
        revealPanel();
      }}
      agents={a.agents.agents}
      agentSelected={agentPick === undefined ? agentModel : agentPick}
      onPickAgent={(m) => {
        setAgentPick(m);
        if (drawer) setSheet(true);
        revealPanel();
      }}
    />
  );
  const inspector = (
    <SkinInspector
      target={target}
      side={side}
      canBoth={bothSides(slot) && slot !== 'agent'}
      busy={busy}
      onEquip={(custom, team) => void equip(custom, team)}
      onDefault={() => void toDefault()}
      onAgent={(m) => void setAgent(m)}
      mode={drawer ?? 'column'}
      onClose={drawer ? () => setSheet(false) : undefined}
    />
  );
  const loadout = (
    <LoadoutColumn
      side={side}
      selected={slot}
      view={a.view}
      onSelect={a.setSlot}
      onCopy={() => void copyToOther()}
      copying={copying}
    />
  );

  return (
    <Box data-testid="arsenal-page">
      <Container
        maxWidth={false}
        sx={{
          maxWidth: 1440,
          py: { xs: 3, md: 5 },
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          [SHORT_SCREEN]: { py: 2, gap: 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{
                fontFamily: fontDisplay,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                [SHORT_SCREEN]: { fontSize: '1.75rem' },
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {t('skins.arsenal.title')}
            </Typography>
            <Typography sx={{ color: color.ink2 }}>{t('skins.arsenal.subtitle')}</Typography>
          </Box>
          <SideToggle side={side} onChange={a.setSide} />
        </Box>
        <VirtualNotice />

        {phone && (
          <MobileLoadout
            side={side}
            selected={slot}
            view={a.view}
            onSelect={a.setSlot}
            onCopy={() => void copyToOther()}
            copying={copying}
          />
        )}
        <Box sx={{ display: 'flex', gap: { md: 2, lg: 2.5 }, alignItems: 'flex-start' }}>
          {!phone && (
            <Box
              sx={{ ...stickyColumn, ...thinScroll, flex: `0 0 ${wide ? 300 : 260}px`, pr: 0.5 }}
            >
              {loadout}
            </Box>
          )}
          <Box ref={catalogTop} sx={{ flex: '1 1 auto', minWidth: 0, scrollMarginTop: STICKY_TOP }}>
            {catalogView}
          </Box>
          {wide && (
            <Box
              ref={panelBox}
              sx={{ ...stickyColumn, flex: '0 0 340px', display: 'flex', flexDirection: 'column' }}
            >
              {inspector}
            </Box>
          )}
        </Box>
        {drawer && (
          <Drawer
            anchor={drawer === 'bottom' ? 'bottom' : 'right'}
            open={sheet}
            onClose={() => setSheet(false)}
            PaperProps={{
              sx:
                drawer === 'bottom'
                  ? {
                      bgcolor: 'transparent',
                      boxShadow: 'none',
                      maxHeight: '92%',
                      display: 'flex',
                      flexDirection: 'column',
                    }
                  : {
                      width: 'min(400px, 100vw)',
                      bgcolor: color.paper2,
                      borderLeft: `1px solid ${color.rule}`,
                      display: 'flex',
                      flexDirection: 'column',
                    },
            }}
          >
            {inspector}
          </Drawer>
        )}
      </Container>
    </Box>
  );
}

function SideToggle({ side, onChange }: { side: Side; onChange: (side: Side) => void }) {
  const { t } = useModuleTranslation('cs2');
  return (
    <Box
      role="group"
      aria-label={t('skins.arsenal.side')}
      sx={{
        display: 'flex',
        p: '4px',
        gap: '4px',
        borderRadius: radii.pill,
        bgcolor: color.paper2,
        border: `1px solid ${color.rule}`,
      }}
    >
      {([3, 2] as const).map((s) => {
        const on = side === s;
        return (
          <ButtonBase
            key={s}
            onClick={() => onChange(s)}
            aria-pressed={on}
            data-testid={`arsenal-side-${s === 3 ? 'ct' : 't'}`}
            sx={{
              gap: 1,
              height: 40,
              px: 2.5,
              borderRadius: radii.pill,
              fontSize: '0.875rem',
              fontWeight: 600,
              bgcolor: on ? color.ink : 'transparent',
              color: on ? color.accentInk : color.ink2,
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                bgcolor: s === 3 ? color.sideCt : color.sideT,
              }}
            />
            {s === 3 ? t('skins.side.ct') : t('skins.side.t')}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

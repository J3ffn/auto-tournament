import { useEffect, useMemo, useState } from 'react';
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
import { SkinInspector, type InspectTarget } from './SkinInspector';
import { SlotCatalog, finishKey } from './SlotCatalog';
import { bothSides, hasModels, type Side } from './slots';
import { slotOfWeapon, useArsenal } from './useArsenal';

const { color } = tokens;

/** The player's copy of a catalogue finish (a picked one first), if they have one. */
function copyOf(inventory: OwnedSkin[], skin: FreeCatalogSkin): OwnedSkin | null {
  const name = skin.vanilla ? 'Vanilla' : freeSkinName(skin);
  const mine = inventory.filter((o) => o.weapon === skin.weapon && o.name === name);
  return mine.find((o) => o.source === 'free') ?? mine[0] ?? null;
}

/**
 * Fork (free mode): the Arsenal. A side (CT or T), its whole loadout on the
 * left, the finishes of the slot picked in the middle, and the panel that sets
 * one up and equips it on the right. On a phone the loadout is a row of
 * groups and slots, and the panel opens from the bottom.
 */
export function ArsenalPage() {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const phone = useMediaQuery(useTheme().breakpoints.down('md'));
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

  const fail = (error: unknown) =>
    showError(error instanceof Error ? error.message : t('skins.free.failed'));
  const run = async (work: () => Promise<unknown>) => {
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
      if (phone) setSheet(false);
    });
  const toDefault = () =>
    run(async () => {
      const on = current.skin;
      if (on) await mine.equip(on, side);
      setPicked(null);
      if (phone) setSheet(false);
    });
  const setAgent = (model: string | null) =>
    run(async () => {
      await a.agents.setAgent(side, model);
      setAgentPick(undefined);
      if (phone) setSheet(false);
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
        if (phone) setSheet(true);
      }}
      agents={a.agents.agents}
      agentSelected={agentPick === undefined ? agentModel : agentPick}
      onPickAgent={(m) => {
        setAgentPick(m);
        if (phone) setSheet(true);
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

        {phone ? (
          <>
            <MobileLoadout
              side={side}
              selected={slot}
              view={a.view}
              onSelect={a.setSlot}
              onCopy={() => void copyToOther()}
              copying={copying}
            />
            {catalogView}
            <Drawer
              anchor="bottom"
              open={sheet}
              onClose={() => setSheet(false)}
              PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', maxHeight: '92vh' } }}
            >
              {inspector}
            </Drawer>
          </>
        ) : (
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
            <Box sx={{ flex: '0 0 300px', minWidth: 0 }}>
              <LoadoutColumn
                side={side}
                selected={slot}
                view={a.view}
                onSelect={a.setSlot}
                onCopy={() => void copyToOther()}
                copying={copying}
              />
            </Box>
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>{catalogView}</Box>
            <Box sx={{ flex: '0 0 340px', minWidth: 0, position: 'sticky', top: 24 }}>
              {inspector}
            </Box>
          </Box>
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

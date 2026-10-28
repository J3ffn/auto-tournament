import { useMemo, useState } from 'react';
import { Box, Button, ButtonBase, InputAdornment, TextField, Typography } from '@mui/material';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import {
  api,
  apiErrorMessage,
  radii,
  tokens,
  useModuleTranslation,
  useSnackbar,
  withAlpha,
} from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { rarityColor, RARITY_ORDER } from '../rarity';
import { freshCustom, pickFree, type FreeCatalogSkin } from '../freeSkins';
import { announceChange, type OwnedSkin } from '../useSkins';
import { SIDE_COLOR, type Side } from './model';
import { catalogName, copyOf, finishOf, panel, sidesOf, slotOfWeapon } from './parts';
import { Header, PickCard, Segments, type PickerProps } from './PickParts';
import { CARD_SIZES, CardSizeToggle, useCardSize } from './cardSize';
import { AgentPicker } from './AgentPicker';
import { restoreSlot, slotRows } from './undo';

const { color } = tokens;
const PAGE = 48;
type Target = 'ct' | 't' | 'both';
const TEAM: Record<Target, 0 | 2 | 3> = { ct: 3, t: 2, both: 0 };

/**
 * Fork (free mode): the skins for the slot picked on the loadout, under it.
 * "In your inventory" equips one at a click; "Catalogue" adds one you do not
 * have (Factory New) and equips it in the same click. Shared slots choose CT,
 * TR or both (the side being edited by default).
 */
export function SlotPicker(p: PickerProps) {
  if (p.slotId === 'agent') return <AgentPicker {...p} />;
  return <SkinPicker {...p} />;
}

function SkinPicker(p: PickerProps) {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const [tab, setTab] = useState<'mine' | 'cat'>('mine');
  const [target, setTarget] = useState<Target>(p.side === 3 ? 'ct' : 't');
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const hasModels = p.slotId === 'knife' || p.slotId === 'gloves';
  let where: Target = target;
  if (!p.shared) where = p.side === 3 ? 'ct' : 't';
  const whereText = t(`skins.v2.where.${where}`);
  const team = p.shared ? TEAM[target] : 0;

  const [cardSize, setCardSize] = useCardSize();
  const owned = useMemo(
    () => p.inventory.filter((s) => s.slot === p.slotId),
    [p.inventory, p.slotId]
  );
  const inSlot = useMemo(
    () => (p.catalog ?? []).filter((s) => slotOfWeapon(s.weapon) === p.slotId),
    [p.catalog, p.slotId]
  );
  const models = useMemo(() => {
    if (!hasModels) return [];
    const byWeapon = new Map<string, string>();
    for (const s of inSlot) byWeapon.set(s.weapon, s.weaponName);
    return [...byWeapon.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [hasModels, inSlot]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const catalogList = useMemo(
    () =>
      inSlot
        .filter((s) => !model || s.weapon === model)
        .filter((s) => matches(`${s.weaponName} ${s.name} ${s.variant ?? ''}`))
        .sort(
          (a, b) =>
            RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
            a.name.localeCompare(b.name)
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matches` reads `query`
    [inSlot, model, query]
  );

  const isOn = (s: OwnedSkin) => {
    const sides = sidesOf(s);
    if (!p.shared) return sides.length > 0;
    if (target === 'both') return sides.includes(2) && sides.includes(3);
    return sides.includes(TEAM[target] as Side);
  };
  // What is equipped when the panel opens goes first (and stays there while you try others).
  const [firstId] = useState<number | null>(
    () => owned.find((s) => sidesOf(s).includes(p.side))?.id ?? null
  );
  const first = <T,>(list: T[], idOf: (x: T) => number | null | undefined) => [
    ...list.filter((x) => idOf(x) === firstId),
    ...list.filter((x) => idOf(x) !== firstId),
  ];
  const sub = p.onServer ? t('skins.v2.loadout.appliesNext') : undefined;
  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    const rows = slotRows(p.inventory, p.slotId);
    setBusy(true);
    try {
      const text = await work();
      p.notify({ text, sub, undo: () => void restoreSlot(p.slotId, rows) });
    } catch (error) {
      showError(apiErrorMessage(error, t('skins.free.failed')));
    } finally {
      setBusy(false);
    }
  };
  const equipOwned = (s: OwnedSkin) =>
    void run(async () => {
      await p.equipOn(s, team);
      return t('skins.v2.loadout.equippedToast', {
        name: `${s.weaponName} | ${finishOf(s, t)}`,
        where: whereText,
      });
    });
  const addAndEquip = (s: FreeCatalogSkin) =>
    void run(async () => {
      const copy = copyOf(p.inventory, s);
      if (copy) await p.equipOn(copy, team);
      else await pickFree(s, freshCustom(), team);
      const name = `${s.weaponName} | ${catalogName(s, t)}`;
      return copy
        ? t('skins.v2.loadout.equippedToast', { name, where: whereText })
        : t('skins.v2.loadout.addedToast', { name, where: whereText });
    });
  const toDefault = () =>
    void run(async () => {
      if (!p.shared) await p.resetSide(p.side);
      else if (target === 'both') {
        await api.delete(`/api/skins/me/equip/${encodeURIComponent(p.slotId)}`);
        announceChange();
      } else await p.resetSide(TEAM[target] as Side);
      return t('skins.v2.loadout.defaultToast', { name: p.label, where: whereText });
    });

  const defaultOn = !owned.some((s) => isOn(s));
  const tabs = [
    { key: 'mine' as const, label: t('skins.v2.loadout.tabMine', { count: owned.length }) },
    { key: 'cat' as const, label: t('skins.v2.loadout.tabCatalog', { count: inSlot.length }) },
  ];

  return (
    <Box
      component="section"
      aria-labelledby="picker-title"
      data-testid="loadout-picker"
      sx={{
        ...panel,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        p: { xs: 2, md: '18px 20px 20px' },
      }}
    >
      <Header p={p}>
        <Segments
          label={t('skins.v2.loadout.source')}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setShown(PAGE);
          }}
          options={tabs.map((x) => ({ value: x.key, label: x.label }))}
          testId="picker-tab"
        />
        <Box sx={{ flex: 1 }} />
        <CardSizeToggle size={cardSize} onChange={setCardSize} />
        {p.shared && (
          <Segments
            label={t('skins.v2.loadout.equipOn')}
            prefix={t('skins.v2.loadout.equipOn')}
            value={target}
            onChange={setTarget}
            testId="picker-target"
            options={[
              { value: 'ct', label: t('skins.side.ct'), tone: SIDE_COLOR[3] },
              { value: 't', label: t('skins.side.t'), tone: SIDE_COLOR[2] },
              { value: 'both', label: t('skins.v2.loadout.bothShort'), tone: color.ink },
            ]}
          />
        )}
      </Header>

      {tab === 'cat' && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder={t('skins.v2.searchSkins')}
            inputProps={{ 'aria-label': t('skins.v2.searchSkins'), 'data-testid': 'picker-search' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MagnifyingGlassIcon size={16} />
                </InputAdornment>
              ),
              sx: { borderRadius: radii.sm },
            }}
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
          {models.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', flex: '1 1 300px', pb: 0.5 }}>
              {[[null, t('skins.v2.allModels')] as const, ...models].map(([w, name]) => (
                <ButtonBase
                  key={w ?? 'all'}
                  onClick={() => {
                    setModel(w);
                    setShown(PAGE);
                  }}
                  aria-pressed={model === w}
                  sx={{
                    flexShrink: 0,
                    height: 30,
                    px: 1.25,
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    border: `1px solid ${model === w ? withAlpha(color.accent, 0.7) : withAlpha(color.ink, 0.1)}`,
                    bgcolor: model === w ? withAlpha(color.accent, 0.12) : 'transparent',
                    color: model === w ? color.accent2 : color.ink2,
                  }}
                >
                  {name}
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZES[cardSize].min}px, 1fr))`,
          gap: CARD_SIZES[cardSize].gap,
        }}
      >
        {tab === 'mine' && (
          <PickCard
            image={p.defaultImage}
            plain
            name={t('skins.v2.gameDefault')}
            sub={t('skins.v2.noSkin')}
            on={defaultOn}
            action="equip"
            size={cardSize}
            onClick={() => !defaultOn && toDefault()}
            label={t('skins.v2.loadout.useDefault', { where: whereText })}
          />
        )}
        {tab === 'mine' &&
          first(owned, (s) => s.id).map((s) => (
            <PickCard
              key={s.id}
              image={skinCardUrl(s.imageUrl)}
              tone={rarityColor[s.rarity]}
              name={
                s.slot === 'knife' || s.slot === 'gloves'
                  ? `${s.weaponName} | ${finishOf(s, t)}`
                  : finishOf(s, t)
              }
              sub={t(`skins.rarity.${s.rarity}`)}
              sides={sidesOf(s)}
              on={isOn(s)}
              action="equip"
              size={cardSize}
              onClick={() => !isOn(s) && equipOwned(s)}
              label={t('skins.v2.loadout.equipLabel', { name: s.name, where: whereText })}
            />
          ))}
        {tab === 'cat' &&
          first(catalogList, (c) => copyOf(p.inventory, c)?.id)
            .slice(0, shown)
            .map((s) => {
              const copy = copyOf(p.inventory, s);
              return (
                <PickCard
                  key={`${s.weapon}|${s.paintKit}`}
                  image={s.vanilla ? s.image : skinCardUrl(s.image)}
                  tone={s.vanilla ? null : rarityColor[s.rarity]}
                  name={hasModels ? `${s.weaponName} | ${catalogName(s, t)}` : catalogName(s, t)}
                  sub={s.vanilla ? t('skins.v2.noFinish') : t(`skins.rarity.${s.rarity}`)}
                  sides={copy ? sidesOf(copy) : []}
                  on={!!copy && isOn(copy)}
                  owned={!!copy}
                  action={copy ? 'equip' : 'add'}
                  size={cardSize}
                  onClick={() => !(copy && isOn(copy)) && addAndEquip(s)}
                  label={
                    copy
                      ? t('skins.v2.loadout.equipLabel', {
                          name: catalogName(s, t),
                          where: whereText,
                        })
                      : t('skins.v2.loadout.addLabel', {
                          name: catalogName(s, t),
                          where: whereText,
                        })
                  }
                />
              );
            })}
      </Box>
      {tab === 'mine' && owned.length === 0 && (
        <Typography sx={{ fontSize: '0.8125rem', color: color.ink2 }}>
          {t('skins.v2.loadout.noneOwned')}{' '}
          <Box
            component="button"
            type="button"
            onClick={() => setTab('cat')}
            sx={{ all: 'unset', cursor: 'pointer', color: color.accent, fontWeight: 600 }}
          >
            {t('skins.v2.loadout.openCatalog')}
          </Box>
        </Typography>
      )}
      {tab === 'cat' && catalogList.length > shown && (
        <Button
          onClick={() => setShown((n) => n + PAGE)}
          sx={{ alignSelf: 'center', borderRadius: radii.sm }}
        >
          {t('skins.free.showMore', { count: catalogList.length - shown })}
        </Button>
      )}
      <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>
        {tab === 'mine'
          ? t('skins.v2.loadout.mineFoot', { where: whereText })
          : t('skins.v2.loadout.catalogFoot')}
      </Typography>
    </Box>
  );
}

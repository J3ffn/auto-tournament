import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { InfoIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import {
  apiErrorMessage,
  mono,
  pageTitle,
  radii,
  tokens,
  useModuleTranslation,
  useSnackbar,
  withAlpha,
} from '../../../../module-sdk';
import { InspectSkinDialog } from '../SkinParts';
import { RARITY_ORDER } from '../rarity';
import { skinCategory, type SkinCategory } from '../categories';
import { customOf, freeSkinName, pickFree, removeFreeSkin, useFreeCatalog } from '../freeSkins';
import { useMySkins, type OwnedSkin } from '../useSkins';
import { InventoryHeader } from './InventoryHeader';
import { ItemDetail } from './ItemDetail';
import { loadoutName } from './LoadoutMenu';
import { SIDE_COLOR, TIP_INVENTORY, type Side } from './model';
import { UndoToast, finishOf, sidesOf, type UndoNotice } from './parts';
import { useLoadouts } from './useLoadouts';
import { ItemCard } from './ItemParts';
import { restoreSlot, slotRows } from './undo';

const { color } = tokens;
type SideFilter = 'all' | 'ct' | 't' | 'none';
type Sort = 'equipped' | 'newest' | 'rarity' | 'weapon';
const TYPES: Array<'all' | SkinCategory> = [
  'all',
  'knives',
  'gloves',
  'pistols',
  'smgs',
  'rifles',
  'heavy',
];
const MAX_STARS = 6;

/**
 * Fork (free mode): the My items tab. Every skin the player has, filtered by
 * side, type and name; the one picked shows on the right with where it is
 * equipped and what can be done with it.
 */
export function ItemsPage() {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const loadouts = useLoadouts();
  const mine = useMySkins();
  const { skins: catalog } = useFreeCatalog(true);
  const [query, setQuery] = useState('');
  const [sideF, setSideF] = useState<SideFilter>('all');
  const [type, setType] = useState<'all' | SkinCategory>('all');
  const [sort, setSort] = useState<Sort>('equipped');
  const { hash } = useLocation();
  const [selected, setSelected] = useState<number | null>(() => {
    const id = /^#skin-(\d+)$/.exec(hash)?.[1];
    return id ? Number(id) : null;
  });
  const [inspect, setInspect] = useState<number | null>(null);
  const [notice, setNotice] = useState<UndoNotice | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    document.title = pageTitle(t('skins.v2.items.title'));
  }, [t]);

  const inventory = mine.inventory;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const bySide = (s: OwnedSkin) => {
    const on = sidesOf(s);
    if (sideF === 'all') return true;
    if (sideF === 'none') return on.length === 0;
    return on.includes(sideF === 'ct' ? 3 : 2);
  };
  const byQuery = (s: OwnedSkin) =>
    words.every((w) => `${s.weaponName} ${s.name}`.toLowerCase().includes(w));
  const byType = (s: OwnedSkin) => type === 'all' || skinCategory(s) === type;
  const shown = useMemo(() => {
    const list = inventory.filter((s) => bySide(s) && byQuery(s) && byType(s));
    const rank = (s: OwnedSkin) => RARITY_ORDER.indexOf(s.rarity);
    return [...list].sort((a, b) => {
      if (sort === 'newest') return b.createdAt - a.createdAt;
      if (sort === 'rarity') return rank(b) - rank(a);
      if (sort === 'weapon')
        return a.weaponName.localeCompare(b.weaponName) || a.name.localeCompare(b.name);
      return sidesOf(b).length - sidesOf(a).length || rank(b) - rank(a);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the filters are read above
  }, [inventory, sideF, type, query, sort]);
  const count = (tp: 'all' | SkinCategory) =>
    inventory.filter((s) => bySide(s) && byQuery(s) && (tp === 'all' || skinCategory(s) === tp))
      .length;

  const current = inventory.find((s) => s.id === selected) ?? shown[0] ?? null;
  const stars = mine.showcase.map((i) => i.skinId);
  const active = loadouts.active;
  const state = loadouts.state;

  if (mine.loading || !state) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress aria-label={t('skins.v2.items.title')} />
      </Box>
    );
  }

  const failed = (error: unknown) => showError(apiErrorMessage(error, t('skins.free.failed')));
  const label = (s: OwnedSkin) => `${s.weaponName} | ${finishOf(s, t)}`;
  const sideLabel = (side: Side) => (side === 3 ? t('skins.side.ct') : t('skins.side.t'));
  const equip = (s: OwnedSkin, side: Side) => {
    const rows = slotRows(inventory, s.slot);
    return mine
      .equipOn(s, side)
      .then(() =>
        setNotice({
          text: t('skins.v2.items.equippedToast', { name: label(s), side: sideLabel(side) }),
          undo: () => void restoreSlot(s.slot, rows).catch(failed),
        })
      )
      .catch(failed);
  };
  const unequip = (s: OwnedSkin, side: Side) => {
    const rows = slotRows(inventory, s.slot);
    return mine
      .equip(s, side)
      .then(() =>
        setNotice({
          text: t('skins.v2.items.offToast', { name: s.weaponName, side: sideLabel(side) }),
          undo: () => void restoreSlot(s.slot, rows).catch(failed),
        })
      )
      .catch(failed);
  };
  const star = (s: OwnedSkin) => {
    const on = stars.includes(s.id);
    if (!on && stars.length >= MAX_STARS) {
      showError(t('skins.v2.items.starsFull', { max: MAX_STARS }));
      return;
    }
    const before = mine.showcase;
    const next = on
      ? before.filter((i) => i.skinId !== s.id)
      : [...before, { skinId: s.id, big: before.length < 2 }];
    void mine
      .saveShowcase(next.map((i, n) => ({ ...i, big: n < 2 })))
      .then(() =>
        setNotice({
          text: on
            ? t('skins.v2.items.unstarred')
            : t('skins.v2.items.starred', { max: MAX_STARS }),
          undo: () => void mine.saveShowcase(before),
        })
      )
      .catch(failed);
  };
  const entryOf = (s: OwnedSkin) =>
    (catalog ?? []).find(
      (c) => c.weapon === s.weapon && (c.vanilla ? 'Vanilla' : freeSkinName(c)) === s.name
    ) ?? null;
  const remove = (s: OwnedSkin) => {
    const entry = entryOf(s);
    const sides = sidesOf(s);
    void removeFreeSkin(s.id)
      .then(() => {
        setSelected(null);
        setNotice({
          text: t('skins.v2.items.removed', { name: label(s) }),
          sub: sides.length ? t('skins.v2.items.removedSub') : undefined,
          undo: entry
            ? () => {
                let team: 0 | 2 | 3 = 0;
                if (sides.length === 1) team = sides[0];
                void pickFree(entry, customOf(s), team)
                  .then((id) => setSelected(id))
                  .catch(failed);
              }
            : undefined,
        });
      })
      .catch(failed);
  };

  const equippedCount = inventory.filter((s) => sidesOf(s).length > 0).length;
  const sideOptions: Array<{ key: SideFilter; label: string; dot?: string }> = [
    { key: 'all', label: t('skins.v2.items.all') },
    { key: 'ct', label: t('skins.side.ct'), dot: SIDE_COLOR[3] },
    { key: 't', label: t('skins.side.t'), dot: SIDE_COLOR[2] },
    { key: 'none', label: t('skins.v2.items.notEquipped') },
  ];
  const showTip = !state.tips.includes(TIP_INVENTORY);

  return (
    <Box data-testid="items-page">
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
          tab="items"
          loadouts={loadouts}
          subtitle={t('skins.v2.items.subtitle', {
            count: inventory.length,
            equipped: equippedCount,
            name: active ? loadoutName(active, t) : '',
          })}
        />
        {showTip && (
          <Box
            role="note"
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: '12px 10px 12px 16px',
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
            <Typography sx={{ flex: 1, fontSize: '0.8125rem', color: color.ink2 }}>
              <Box component="b" sx={{ color: color.ink }}>
                {t('skins.v2.items.tipTitle')}
              </Box>{' '}
              {t('skins.v2.items.tipBody')}
            </Typography>
            <IconButton
              onClick={() => void loadouts.closeTip(TIP_INVENTORY)}
              aria-label={t('skins.v2.closeNotice')}
              sx={{ borderRadius: '6px' }}
            >
              <XIcon size={16} />
            </IconButton>
          </Box>
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2.5 }}>
          <Box
            component="section"
            aria-label={t('skins.v2.items.title')}
            sx={{
              flex: '999 1 520px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center' }}>
              <TextField
                size="small"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('skins.v2.items.search')}
                inputProps={{
                  'aria-label': t('skins.v2.items.search'),
                  'data-testid': 'items-search',
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MagnifyingGlassIcon size={16} />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: radii.sm, bgcolor: color.paper2 },
                }}
                sx={{ flex: '1 1 220px' }}
              />
              <Box
                role="radiogroup"
                aria-label={t('skins.v2.items.side')}
                sx={{
                  display: 'flex',
                  gap: '2px',
                  p: '3px',
                  borderRadius: radii.sm,
                  bgcolor: color.paper2,
                  border: `1px solid ${withAlpha(color.ink, 0.07)}`,
                }}
              >
                {sideOptions.map((o) => {
                  const on = o.key === sideF;
                  return (
                    <ButtonBase
                      key={o.key}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSideF(o.key)}
                      data-testid={`items-side-${o.key}`}
                      sx={{
                        gap: 0.75,
                        height: 32,
                        px: 1.25,
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        bgcolor: on ? color.paper3 : 'transparent',
                        color: on ? color.ink : color.muted,
                      }}
                    >
                      {o.dot && (
                        <Box
                          component="span"
                          sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: o.dot }}
                        />
                      )}
                      {o.label}
                    </ButtonBase>
                  );
                })}
              </Box>
              <Select
                size="small"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                inputProps={{ 'aria-label': t('skins.sortLabel') }}
                sx={{ borderRadius: radii.sm, bgcolor: color.paper2, minWidth: 170 }}
              >
                <MenuItem value="equipped">{t('skins.v2.items.sortEquipped')}</MenuItem>
                <MenuItem value="newest">{t('skins.sort.newest')}</MenuItem>
                <MenuItem value="rarity">{t('skins.sort.rarity')}</MenuItem>
                <MenuItem value="weapon">{t('skins.v2.items.sortWeapon')}</MenuItem>
              </Select>
            </Box>
            <Box
              role="tablist"
              aria-label={t('skins.v2.items.type')}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
            >
              {TYPES.map((tp) => {
                const on = tp === type;
                return (
                  <ButtonBase
                    key={tp}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setType(tp)}
                    sx={{
                      gap: 0.75,
                      height: 30,
                      px: 1.25,
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      border: `1px solid ${on ? withAlpha(color.accent, 0.7) : withAlpha(color.ink, 0.08)}`,
                      bgcolor: on ? withAlpha(color.accent, 0.12) : color.paper2,
                      color: on ? color.accent2 : color.ink2,
                    }}
                  >
                    {t(`skins.filter.${tp}`)}
                    <Box component="span" sx={{ ...mono, opacity: 0.7 }}>
                      {count(tp)}
                    </Box>
                  </ButtonBase>
                );
              })}
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>
              {t('skins.v2.items.countLine', { count: shown.length })}
            </Typography>
            {shown.length === 0 ? (
              <Box
                sx={{
                  py: 5,
                  px: 2,
                  textAlign: 'center',
                  borderRadius: '12px',
                  bgcolor: color.paper2,
                  color: color.ink2,
                }}
              >
                <Typography sx={{ fontWeight: 600, color: color.ink }}>
                  {inventory.length
                    ? t('skins.v2.items.noneTitle')
                    : t('skins.v2.items.emptyTitle')}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem' }}>
                  {inventory.length ? t('skins.v2.items.noneBody') : t('skins.v2.items.emptyBody')}
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(142px, 1fr))',
                  gap: 1.25,
                }}
              >
                {shown.map((s) => (
                  <ItemCard
                    key={s.id}
                    skin={s}
                    on={s.id === current?.id}
                    star={stars.includes(s.id)}
                    onClick={() => setSelected(s.id)}
                  />
                ))}
              </Box>
            )}
          </Box>
          {current && (
            <Box
              sx={{
                flex: '1 1 320px',
                maxWidth: { md: 370 },
                position: { md: 'sticky' },
                top: { md: 'calc(var(--mat-impersonation-height, 0px) + 86px)' },
              }}
            >
              <ItemDetail
                key={current.id}
                skin={current}
                catalogEntry={entryOf(current)}
                loadouts={state.loadouts}
                starred={stars.includes(current.id)}
                onEquip={(side) => void equip(current, side)}
                onUnequip={(side) => void unequip(current, side)}
                onStar={() => star(current)}
                onRemove={current.source === 'free' ? () => remove(current) : null}
                onInspect={() => setInspect(current.id)}
                onChanged={() => void mine.reload()}
              />
            </Box>
          )}
        </Box>
      </Container>
      <InspectSkinDialog skinId={inspect} onClose={() => setInspect(null)} />
      <UndoToast notice={notice} onDone={clearNotice} />
    </Box>
  );
}

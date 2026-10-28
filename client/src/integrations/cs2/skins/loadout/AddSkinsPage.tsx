import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  CircularProgress,
  Container,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeftIcon, CheckIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import {
  PageHead,
  api,
  apiErrorMessage,
  mono,
  pageTitle,
  radii,
  tokens,
  useModuleTranslation,
  useSnackbar,
  withAlpha,
} from '../../../../module-sdk';
import { VirtualNotice, skinCardUrl } from '../SkinParts';
import { rarityColor, RARITY_ORDER } from '../rarity';
import { skinCategory, type SkinCategory } from '../categories';
import { useFreeCatalog, type FreeCatalogSkin } from '../freeSkins';
import { skinPaths } from '../paths';
import { announceChange, useMySkins } from '../useSkins';
import { catalogName, copyOf } from './parts';
import { CARD_SIZES, CardSizeToggle, useCardSize } from './cardSize';

const { color } = tokens;
const PAGE = 120;
const TYPES: Array<'all' | SkinCategory> = [
  'all',
  'rifles',
  'pistols',
  'smgs',
  'heavy',
  'knives',
  'gloves',
];
const keyOf = (s: Pick<FreeCatalogSkin, 'weapon' | 'paintKit'>) => `${s.weapon}|${s.paintKit}`;

/**
 * Fork (free mode): add many skins at once. Mark as many finishes as you
 * like and add them in one go, Factory New; one of each (the ones you have
 * are marked). They are not equipped unless "equip where it is the default"
 * is ticked.
 */
export function AddSkinsPage() {
  const { t } = useModuleTranslation('cs2');
  const { showError, showSuccess } = useSnackbar();
  const navigate = useNavigate();
  const mine = useMySkins();
  const { skins: catalog, failed } = useFreeCatalog(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | SkinCategory>('all');
  const [weapon, setWeapon] = useState('all');
  const [hideOwned, setHideOwned] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [equipEmpty, setEquipEmpty] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [cardSize, setCardSize] = useCardSize();

  useEffect(() => {
    document.title = pageTitle(t('skins.v2.add.title'));
  }, [t]);

  const owned = useMemo(() => {
    const out = new Set<string>();
    for (const s of catalog ?? []) if (copyOf(mine.inventory, s)) out.add(keyOf(s));
    return out;
  }, [catalog, mine.inventory]);
  const ofType = useMemo(
    () => (catalog ?? []).filter((s) => type === 'all' || skinCategory(s) === type),
    [catalog, type]
  );
  const weapons = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of ofType) m.set(s.weapon, s.weaponName);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ofType]);
  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return ofType
      .filter((s) => weapon === 'all' || s.weapon === weapon)
      .filter((s) => !hideOwned || !owned.has(keyOf(s)))
      .filter((s) =>
        words.every((w) => `${s.weaponName} ${s.name} ${s.variant ?? ''}`.toLowerCase().includes(w))
      )
      .sort(
        (a, b) =>
          a.weaponName.localeCompare(b.weaponName) ||
          RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
          a.name.localeCompare(b.name)
      );
  }, [ofType, weapon, hideOwned, owned, query]);

  const toggle = (s: FreeCatalogSkin) =>
    setPicked((set) => {
      const next = new Set(set);
      const k = keyOf(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const visibleFree = list.slice(0, shown).filter((s) => !owned.has(keyOf(s)));
  const allVisible = visibleFree.length > 0 && visibleFree.every((s) => picked.has(keyOf(s)));

  const add = async () => {
    if (!picked.size || busy) return;
    setBusy(true);
    try {
      const items = [...picked].map((k) => {
        const [w, p] = k.split('|');
        return { weapon: w, paintKit: Number(p) };
      });
      const r = await api.post<{ added: number[]; skipped: number }>('/api/skins/me/free/bulk', {
        items,
        equipEmpty,
      });
      announceChange();
      showSuccess(t('skins.v2.add.done', { count: r.added.length }));
      navigate(skinPaths.inventory);
    } catch (error) {
      showError(apiErrorMessage(error, t('skins.free.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box data-testid="add-skins-page" sx={{ pb: 12 }}>
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
        <Button
          component={RouterLink}
          to={skinPaths.inventory}
          startIcon={<ArrowLeftIcon size={14} />}
          sx={{ alignSelf: 'flex-start', borderRadius: radii.sm, color: color.ink2, px: 1 }}
        >
          {t('skins.v2.add.back')}
        </Button>
        <PageHead
          title={t('skins.v2.add.title')}
          subtitle={t('skins.v2.add.subtitle')}
          sx={{ mb: 0 }}
        />
        <VirtualNotice compact />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center' }}>
          <TextField
            size="small"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder={t('skins.v2.searchSkins')}
            inputProps={{ 'aria-label': t('skins.v2.searchSkins'), 'data-testid': 'add-search' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MagnifyingGlassIcon size={16} />
                </InputAdornment>
              ),
              sx: { borderRadius: radii.sm, bgcolor: color.paper2 },
            }}
            sx={{ flex: '1 1 240px' }}
          />
          <Select
            size="small"
            value={weapon}
            onChange={(e) => {
              setWeapon(String(e.target.value));
              setShown(PAGE);
            }}
            inputProps={{ 'aria-label': t('skins.v2.add.weapon') }}
            sx={{ borderRadius: radii.sm, bgcolor: color.paper2, minWidth: 180 }}
          >
            <MenuItem value="all">{t('skins.v2.add.allWeapons')}</MenuItem>
            {weapons.map(([w, name]) => (
              <MenuItem key={w} value={w}>
                {name}
              </MenuItem>
            ))}
          </Select>
          <CardSizeToggle size={cardSize} onChange={setCardSize} />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={hideOwned}
                onChange={(e) => setHideOwned(e.target.checked)}
              />
            }
            label={t('skins.v2.add.hideOwned')}
            sx={{
              m: 0,
              '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', color: color.ink2 },
            }}
          />
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
                onClick={() => {
                  setType(tp);
                  setWeapon('all');
                  setShown(PAGE);
                }}
                sx={{
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
              </ButtonBase>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.75rem', color: color.muted, flex: 1 }}>
            {t('skins.v2.add.count', { count: list.length })}
          </Typography>
          <Button
            size="small"
            disabled={visibleFree.length === 0}
            onClick={() =>
              setPicked((set) => {
                const next = new Set(set);
                for (const s of visibleFree) {
                  if (allVisible) next.delete(keyOf(s));
                  else next.add(keyOf(s));
                }
                return next;
              })
            }
            sx={{ borderRadius: radii.sm }}
          >
            {allVisible
              ? t('skins.v2.add.unmarkVisible')
              : t('skins.v2.add.markVisible', { count: visibleFree.length })}
          </Button>
        </Box>

        {!catalog ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            {failed ? (
              <Typography>{t('skins.free.failed')}</Typography>
            ) : (
              <CircularProgress aria-label={t('skins.v2.add.title')} />
            )}
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZES[cardSize].min}px, 1fr))`,
              gap: CARD_SIZES[cardSize].gap,
            }}
          >
            {list.slice(0, shown).map((s) => {
              const k = keyOf(s);
              const have = owned.has(k);
              const on = picked.has(k);
              return (
                <ButtonBase
                  key={k}
                  onClick={() => !have && toggle(s)}
                  disabled={have}
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${s.weaponName} | ${catalogName(s, t)}${have ? `, ${t('skins.v2.add.owned')}` : ''}`}
                  data-testid="add-card"
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    textAlign: 'left',
                    borderRadius: radii.sm,
                    overflow: 'hidden',
                    bgcolor: color.paper3,
                    border: `1px solid ${on ? color.accent : withAlpha(color.ink, 0.07)}`,
                    opacity: have ? 0.5 : 1,
                    '&:hover': { borderColor: on ? color.accent : withAlpha(color.ink, 0.22) },
                    '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
                  }}
                >
                  <Box
                    sx={{
                      height: CARD_SIZES[cardSize].image,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: color.paper,
                    }}
                  >
                    <Box
                      component="img"
                      src={s.vanilla ? s.image : skinCardUrl(s.image)}
                      alt=""
                      loading="lazy"
                      sx={{ maxWidth: '84%', maxHeight: '82%', objectFit: 'contain' }}
                    />
                  </Box>
                  <Box
                    sx={{ height: 2, bgcolor: s.vanilla ? 'transparent' : rarityColor[s.rarity] }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', p: '7px 10px 9px' }}>
                    <Typography noWrap sx={{ fontSize: '0.6875rem', color: color.muted }}>
                      {s.weaponName}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                      {catalogName(s, t)}
                    </Typography>
                    {have && (
                      <Typography sx={{ fontSize: '0.6875rem', color: color.muted }}>
                        {t('skins.v2.add.owned')}
                      </Typography>
                    )}
                  </Box>
                  <Box
                    aria-hidden
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 20,
                      height: 20,
                      borderRadius: '5px',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: on ? color.accent : withAlpha(color.paper, 0.85),
                      border: `1.5px solid ${on ? color.accent : withAlpha(color.ink, 0.3)}`,
                      color: color.accentInk,
                    }}
                  >
                    {on && <CheckIcon size={12} weight="bold" />}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        )}
        {list.length > shown && (
          <Button
            onClick={() => setShown((n) => n + PAGE)}
            sx={{ alignSelf: 'center', borderRadius: radii.sm }}
          >
            {t('skins.free.showMore', { count: list.length - shown })}
          </Button>
        )}
      </Container>

      <Box
        role="region"
        aria-label={t('skins.v2.add.bar')}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          bgcolor: withAlpha(color.paper2, 0.96),
          borderTop: `1px solid ${withAlpha(color.ink, 0.1)}`,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: { xs: 1, sm: 2 },
            py: 1.5,
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            <Box component="span" sx={mono}>
              {picked.size}
            </Box>{' '}
            {t('skins.v2.add.selected', { count: picked.size })}
          </Typography>
          {picked.size > 0 && (
            <Button
              size="small"
              onClick={() => setPicked(new Set())}
              sx={{ borderRadius: radii.sm, color: color.ink2 }}
            >
              {t('skins.v2.add.clear')}
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={equipEmpty}
                onChange={(e) => setEquipEmpty(e.target.checked)}
                data-testid="add-equip-empty"
              />
            }
            label={t('skins.v2.add.equipEmpty')}
            sx={{
              m: 0,
              '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', color: color.ink2 },
            }}
          />
          <Button
            variant="contained"
            disabled={!picked.size || busy}
            onClick={() => void add()}
            data-testid="add-submit"
            sx={{ height: 40, borderRadius: radii.sm, fontWeight: 700, minWidth: 140 }}
          >
            {t('skins.v2.add.submit', { count: picked.size })}
          </Button>
        </Container>
      </Box>
    </Box>
  );
}

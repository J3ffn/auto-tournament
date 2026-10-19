import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useModuleTranslation, tokens, radii, withAlpha } from '../../../module-sdk';
import { skinCardUrl } from './SkinParts';
import { rarityColor, RARITY_ORDER } from './rarity';
import { SKIN_CATEGORIES, skinCategory, type SkinCategory } from './categories';
import { freeSkinName, ownedCopy, useFreeCatalog, type FreeCatalogSkin } from './freeSkins';
import type { OwnedSkin } from './useSkins';

const { color } = tokens;
/** Cards drawn at a time; "Show more" adds this many again (the catalogue has about 2,000). */
const PAGE = 120;

/**
 * Fork (free mode): every finish there is, to pick from. A search box (any
 * words: "ak redline", "karambit fade"), the weapon groups, and the cards; a
 * click opens the editor. A finish the player already picked shows it.
 */
export function FreeCatalog({
  inventory,
  onPick,
  initialGroup = 'all',
}: {
  inventory: OwnedSkin[];
  onPick: (skin: FreeCatalogSkin) => void;
  /** The weapon group to open on (an empty loadout slot opens knives or gloves). */
  initialGroup?: 'all' | SkinCategory;
}) {
  const { t } = useModuleTranslation('cs2');
  const { skins, failed } = useFreeCatalog(true);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'all' | SkinCategory>(initialGroup);
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (skins ?? [])
      .filter((s) => group === 'all' || skinCategory(s) === group)
      .filter((s) => {
        const text = `${s.weaponName} ${s.name} ${s.variant ?? ''}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort(
        (a, b) =>
          a.weaponName.localeCompare(b.weaponName) ||
          RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
          a.name.localeCompare(b.name)
      );
  }, [skins, query, group]);

  if (failed)
    return <Typography sx={{ color: color.ink2 }}>{t('skins.free.loadFailed')}</Typography>;
  if (!skins)
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
        <CircularProgress aria-label={t('skins.free.catalog')} />
      </Box>
    );

  const chip = (key: 'all' | SkinCategory) => (
    <ButtonBase
      key={key}
      onClick={() => {
        setGroup(key);
        setShown(PAGE);
      }}
      aria-pressed={group === key}
      sx={{
        px: 1.75,
        py: 1,
        borderRadius: radii.pill,
        fontSize: '0.875rem',
        border: `1px solid ${group === key ? color.ink : color.rule}`,
        bgcolor: group === key ? color.ink : 'transparent',
        color: group === key ? color.accentInk : color.ink2,
        fontWeight: group === key ? 600 : 400,
      }}
    >
      {t(`skins.filter.${key}`)}
    </ButtonBase>
  );

  return (
    <Box data-testid="free-catalog" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        size="small"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShown(PAGE);
        }}
        placeholder={t('skins.free.search')}
        inputProps={{ 'aria-label': t('skins.free.search'), 'data-testid': 'free-search' }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <MagnifyingGlassIcon size={16} />
            </InputAdornment>
          ),
          sx: { borderRadius: radii.pill },
        }}
        sx={{ maxWidth: 420 }}
      />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {(['all', ...SKIN_CATEGORIES] as Array<'all' | SkinCategory>).map(chip)}
      </Box>
      <Typography sx={{ color: color.muted, fontSize: '0.875rem' }}>
        {t('skins.free.count', { count: list.length })}
      </Typography>
      {list.length === 0 ? (
        <Typography sx={{ color: color.ink2 }}>{t('skins.noneInFilter')}</Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 1.75,
          }}
        >
          {list.slice(0, shown).map((skin) => {
            const mine = ownedCopy(inventory, skin);
            return (
              <ButtonBase
                key={`${skin.weapon}|${skin.paintKit}`}
                onClick={() => onPick(skin)}
                data-testid="free-catalog-card"
                aria-label={`${skin.weaponName} | ${freeSkinName(skin)}`}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  textAlign: 'left',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  bgcolor: color.paper2,
                  border: `1px solid ${mine?.equipped ? color.accent : color.rule}`,
                  '&:hover': { borderColor: color.muted },
                  '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: '3px' },
                }}
              >
                <Box
                  component="img"
                  src={skinCardUrl(skin.image)}
                  alt=""
                  loading="lazy"
                  sx={{
                    width: '100%',
                    height: 96,
                    objectFit: 'contain',
                    bgcolor: color.paper3,
                    p: 1.25,
                    boxSizing: 'border-box',
                  }}
                />
                <Typography
                  sx={{ fontSize: '0.75rem', color: color.muted, px: 1.5, pt: 1.25 }}
                  noWrap
                >
                  {skin.weaponName}
                </Typography>
                <Typography
                  sx={{ fontWeight: 600, fontSize: '0.875rem', px: 1.5, pt: 0.25, pb: 1.5 }}
                  noWrap
                >
                  {freeSkinName(skin)}
                </Typography>
                <Box sx={{ mt: 'auto', height: 3, bgcolor: rarityColor[skin.rarity] }} />
                {mine && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      px: 1,
                      py: '2px',
                      borderRadius: radii.pill,
                      bgcolor: withAlpha(color.paper, 0.85),
                      border: `1px solid ${color.rule}`,
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                    }}
                  >
                    {mine.equipped ? t('skins.equipped') : t('skins.free.picked')}
                  </Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      )}
      {list.length > shown && (
        <Button
          variant="outlined"
          onClick={() => setShown((n) => n + PAGE)}
          sx={{ alignSelf: 'center', borderRadius: radii.pill }}
          data-testid="free-show-more"
        >
          {t('skins.free.showMore', { count: list.length - shown })}
        </Button>
      )}
    </Box>
  );
}

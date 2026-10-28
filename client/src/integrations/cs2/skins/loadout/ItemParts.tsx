import type { ReactNode } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { CheckIcon, PlusIcon, StarIcon } from '@phosphor-icons/react';
import { mono, radii, tokens, useModuleTranslation, withAlpha } from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { rarityColor } from '../rarity';
import type { OwnedSkin } from '../useSkins';
import { SIDE_COLOR, type Side } from './model';
import { CARD_SIZES, type CardSize } from './cardSize';
import { SideChip, finishOf, sideName, sidesOf } from './parts';

const { color } = tokens;

/** A small fact about the skin (rarity, wear, seed…). */
export function Chip({
  children,
  tone,
  tint,
}: {
  children: ReactNode;
  tone?: string;
  tint?: string;
}) {
  return (
    <Box
      component="span"
      sx={{
        px: 1,
        py: '2px',
        borderRadius: '4px',
        bgcolor: tint ?? color.paper3,
        color: tone ?? color.ink2,
        fontWeight: tone ? 600 : 400,
      }}
    >
      {children}
    </Box>
  );
}

/** One side's switch: filled in the side's colour with a check when on, a plus when off. */
export function SideSwitch({
  side,
  allowed,
  on,
  onClick,
}: {
  side: Side;
  allowed: boolean;
  on: boolean;
  onClick: () => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const fill = SIDE_COLOR[side];
  const name = sideName(side, t);
  let status = t('skins.v2.items.equip');
  if (!allowed) status = t('skins.v2.items.notOnSide');
  else if (on) status = t('skins.v2.items.equippedShort');
  let label = t('skins.v2.items.equipOn', { side: name });
  if (!allowed) label = t('skins.v2.items.noSide', { side: name });
  else if (on) label = t('skins.v2.items.takeOffOn', { side: name });
  let fg: string = color.ink;
  if (!allowed) fg = withAlpha(color.ink, 0.3);
  else if (on) fg = color.paper;
  return (
    <ButtonBase
      onClick={allowed ? onClick : undefined}
      aria-pressed={allowed ? on : undefined}
      aria-disabled={!allowed}
      aria-label={label}
      title={label}
      data-testid={`item-side-${side === 3 ? 'ct' : 't'}`}
      sx={{
        justifyContent: 'flex-start',
        gap: 1,
        height: 46,
        px: 1.5,
        borderRadius: radii.sm,
        border: `1px ${allowed ? 'solid' : 'dashed'} ${on ? fill : withAlpha(color.ink, allowed ? 0.12 : 0.1)}`,
        bgcolor: switchFill(on, allowed, fill),
        color: fg,
        cursor: allowed ? 'pointer' : 'not-allowed',
        '&:hover': allowed && !on ? { borderColor: withAlpha(fill, 0.8) } : {},
        '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
      }}
    >
      <Box component="span" sx={{ ...mono, fontSize: '0.9375rem', fontWeight: 700 }}>
        {name}
      </Box>
      <Box
        component="span"
        sx={{ flex: 1, textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}
      >
        {status}
      </Box>
      {allowed && on && <CheckIcon size={16} weight="bold" aria-hidden />}
      {allowed && !on && <PlusIcon size={16} weight="bold" aria-hidden />}
    </ButtonBase>
  );
}

function switchFill(on: boolean, allowed: boolean, fill: string): string {
  if (on) return fill;
  return allowed ? color.paper3 : 'transparent';
}

/** One skin of My items: picture, rarity, name, the sides it is on, and the profile star. */
export function ItemCard({
  skin,
  on,
  star,
  onClick,
  size = 'm',
}: {
  skin: OwnedSkin;
  on: boolean;
  star: boolean;
  onClick: () => void;
  size?: CardSize;
}) {
  const { t } = useModuleTranslation('cs2');
  const sides = sidesOf(skin);
  const dims = CARD_SIZES[size];
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      aria-label={`${skin.weaponName} | ${finishOf(skin, t)}${sides.length ? `, ${t('skins.v2.equipped')} ${sides.map((s) => (s === 3 ? t('skins.side.ct') : t('skins.side.t'))).join(' + ')}` : ''}`}
      data-testid="item-card"
      sx={{
        position: 'relative',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        borderRadius: radii.sm,
        overflow: 'hidden',
        border: `1px solid ${on ? color.accent : withAlpha(color.ink, 0.07)}`,
        bgcolor: color.paper3,
        textAlign: 'left',
        '&:hover': { borderColor: on ? color.accent : withAlpha(color.ink, 0.22) },
        '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
      }}
    >
      <Box sx={{ height: dims.image, display: 'grid', placeItems: 'center', bgcolor: color.paper }}>
        <Box
          component="img"
          src={skinCardUrl(skin.imageUrl)}
          alt=""
          loading="lazy"
          sx={{ maxWidth: '84%', maxHeight: '82%', objectFit: 'contain' }}
        />
      </Box>
      <Box sx={{ height: 2, bgcolor: rarityColor[skin.rarity] }} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          p: size === 's' ? '6px 8px 8px' : '7px 10px 9px',
        }}
      >
        <Typography noWrap sx={{ fontSize: '0.6875rem', color: color.muted }}>
          {skin.weaponName}
        </Typography>
        <Typography noWrap sx={{ fontSize: dims.name, fontWeight: 600 }}>
          {finishOf(skin, t)}
        </Typography>
      </Box>
      <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: '3px' }}>
        {sides.map((s) => (
          <SideChip key={s} side={s} />
        ))}
      </Box>
      {star && (
        <Box
          sx={{ position: 'absolute', top: 5, left: 6, color: color.medalGold, display: 'flex' }}
          aria-hidden
        >
          <StarIcon size={13} weight="fill" />
        </Box>
      )}
    </ButtonBase>
  );
}

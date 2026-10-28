import type { ReactNode } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';
import { BackpackIcon, CheckIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import {
  fontDisplay,
  radii,
  tokens,
  useModuleTranslation,
  withAlpha,
} from '../../../../module-sdk';
import type { FreeAgent, FreeCatalogSkin } from '../freeSkins';
import type { OwnedSkin } from '../useSkins';
import type { Side } from './model';
import { SideChip, sideName, type UndoNotice } from './parts';
import { CARD_SIZES, type CardSize } from './cardSize';

const { color } = tokens;

export interface PickerProps {
  slotId: string;
  side: Side;
  /** The slot's name ("AK-47", "Knife"). */
  label: string;
  /** Both sides use this slot: a skin can go on CT, TR or both. */
  shared: boolean;
  inventory: OwnedSkin[];
  equipOn: (skin: OwnedSkin, team: 0 | 2 | 3) => Promise<void>;
  /** Take what a side has in this slot off (back to the game's default). */
  resetSide: (side: Side) => Promise<void>;
  catalog: FreeCatalogSkin[] | null;
  defaultImage: string | null;
  agents: {
    agents: FreeAgent[];
    mine: { ct: string | null; t: string | null };
    setAgent: (team: Side, model: string | null) => Promise<void>;
  };
  loadoutName: string;
  onServer: boolean;
  onClose: () => void;
  notify: (n: UndoNotice) => void;
}

/** The picker's top: close, the slot's name and which sides use it, and the controls given. */
export function Header({ p, children }: { p: PickerProps; children?: ReactNode }) {
  const { t } = useModuleTranslation('cs2');
  const char = p.slotId === 'knife' || p.slotId === 'gloves' || p.slotId === 'agent';
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.75 }}>
      <IconButton
        onClick={p.onClose}
        aria-label={t('skins.v2.loadout.closePicker')}
        data-testid="picker-close"
        sx={{
          width: 36,
          height: 36,
          borderRadius: '6px',
          border: `1px solid ${withAlpha(color.ink, 0.14)}`,
        }}
      >
        <XIcon size={16} />
      </IconButton>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Typography
          id="picker-title"
          component="h2"
          sx={{
            fontFamily: fontDisplay,
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          {char ? `${p.label} · ${sideName(p.side, t)}` : p.label}
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: color.muted }}>
          {p.shared
            ? t('skins.v2.loadout.sharedSlot', { name: p.loadoutName })
            : t('skins.v2.loadout.oneSideSlot', { name: p.loadoutName, side: sideName(p.side, t) })}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

/** A card of the slot's choices: picture, name, where it is equipped, and a corner mark. */
export function PickCard({
  image,
  tone = null,
  plain = false,
  name,
  sub,
  sides = [],
  on,
  owned = false,
  action = null,
  onClick,
  label,
  size = 'm',
  tall = false,
  cover = false,
}: {
  image: string | null;
  tone?: string | null;
  plain?: boolean;
  name: string;
  sub: string;
  /** The sides it is equipped on: chips at the top, as on My items. */
  sides?: Side[];
  /** Equipped where the panel equips: marked, and listed first. */
  on: boolean;
  /** In the catalogue, one you already have: dimmed, with the inventory mark. */
  owned?: boolean;
  /** What a click does, shown as an icon in the corner on hover: add and equip, or equip. */
  action?: 'add' | 'equip' | null;
  onClick: () => void;
  label: string;
  size?: CardSize;
  tall?: boolean;
  cover?: boolean;
}) {
  const { t } = useModuleTranslation('cs2');
  const dims = CARD_SIZES[size];
  const dim = owned && !on;
  const icon = size === 's' ? 22 : 26;
  let imageOpacity = 1;
  if (plain) imageOpacity = 0.45;
  else if (dim) imageOpacity = 0.35;
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      data-testid="picker-card"
      data-owned={owned ? 'true' : undefined}
      sx={{
        position: 'relative',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        borderRadius: radii.sm,
        overflow: 'hidden',
        bgcolor: color.paper3,
        border: `1px solid ${on ? color.accent : withAlpha(color.ink, 0.07)}`,
        boxShadow: on ? `0 0 0 3px ${withAlpha(color.accent, 0.15)}` : 'none',
        textAlign: 'left',
        '& .pick-img': { transition: 'opacity 140ms, filter 140ms' },
        '& .pick-action': { opacity: 0, transition: 'opacity 120ms' },
        '&:hover': { borderColor: on ? color.accent : withAlpha(color.ink, 0.24) },
        '&:hover .pick-img': { opacity: 1, filter: 'none' },
        '&:hover .pick-action, &:focus-visible .pick-action': { opacity: 1 },
        '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: tall ? dims.image + 32 : dims.image,
          display: 'grid',
          placeItems: 'center',
          bgcolor: color.paper,
        }}
      >
        {image && (
          <Box
            component="img"
            className="pick-img"
            src={image}
            alt=""
            loading="lazy"
            sx={{
              maxWidth: cover ? '100%' : '84%',
              height: cover ? '100%' : 'auto',
              maxHeight: cover ? '100%' : '82%',
              objectFit: cover ? 'cover' : 'contain',
              filter: plain || dim ? 'grayscale(0.85)' : 'none',
              opacity: imageOpacity,
            }}
          />
        )}
        {owned && (
          <Box
            title={t('skins.v2.inInventory')}
            aria-hidden
            sx={{
              position: 'absolute',
              top: 6,
              left: 6,
              height: 20,
              px: '5px',
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '5px',
              bgcolor: withAlpha(color.paper, 0.85),
              color: '#8fd6a4',
            }}
          >
            <BackpackIcon size={13} weight="bold" />
          </Box>
        )}
        {sides.length > 0 && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: '3px' }}>
            {sides.map((s) => (
              <SideChip key={s} side={s} />
            ))}
          </Box>
        )}
        {action && !on && (
          <Box
            className="pick-action"
            aria-hidden
            sx={{
              position: 'absolute',
              top: sides.length ? 28 : 6,
              right: 6,
              width: icon,
              height: icon,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '6px',
              bgcolor: action === 'add' ? color.accent : color.ink,
              color: action === 'add' ? color.accentInk : color.paper,
              boxShadow: `0 4px 10px ${color.shadow}`,
            }}
          >
            {action === 'add' ? (
              <PlusIcon size={14} weight="bold" />
            ) : (
              <CheckIcon size={14} weight="bold" />
            )}
          </Box>
        )}
      </Box>
      <Box sx={{ height: 2, bgcolor: tone ?? 'transparent' }} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          p: size === 's' ? '6px 8px 8px' : '8px 10px 10px',
          minWidth: 0,
        }}
      >
        <Typography
          noWrap
          sx={{ fontSize: dims.name, fontWeight: 600, color: dim ? color.muted : color.ink }}
        >
          {name}
        </Typography>
        {size !== 's' && (
          <Typography noWrap sx={{ fontSize: '0.6875rem', color: tone ?? color.muted }}>
            {sub}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}

/** A small segmented control: CT / TR / both, or Inventory / Catalogue. */
export function Segments<T extends string>({
  label,
  prefix,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  prefix?: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; tone?: string }>;
  testId: string;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        p: '3px',
        borderRadius: radii.sm,
        bgcolor: color.paper,
        border: `1px solid ${withAlpha(color.ink, 0.07)}`,
      }}
    >
      {prefix && (
        <Typography
          sx={{
            px: 1,
            fontSize: '0.75rem',
            color: color.muted,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {prefix}
        </Typography>
      )}
      {options.map((o) => {
        const on = o.value === value;
        let bg: string = 'transparent';
        if (on) bg = o.tone ?? color.paper3;
        return (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            data-testid={`${testId}-${o.value}`}
            sx={{
              height: 30,
              px: 1.25,
              borderRadius: '6px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              bgcolor: bg,
              color: segmentInk(on, Boolean(o.tone)),
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

/** The text colour of a segment: on a side's colour, on the paper, or quiet when off. */
function segmentInk(on: boolean, toned: boolean): string {
  if (!on) return color.muted;
  return toned ? color.paper : color.ink;
}

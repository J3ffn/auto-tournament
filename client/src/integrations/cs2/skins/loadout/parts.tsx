import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { CheckIcon, UserIcon } from '@phosphor-icons/react';
import {
  mono,
  radii,
  siteEdgeRight,
  tokens,
  useModuleTranslation,
  withAlpha,
} from '../../../../module-sdk';
import type { FreeAgent, FreeCatalogSkin } from '../freeSkins';
import { freeSkinName } from '../freeSkins';
import type { OwnedSkin } from '../useSkins';
import { SIDE_COLOR, type Side } from './model';

const { color } = tokens;

/** The slot a weapon fills: every knife shares one, every glove one. */
export function slotOfWeapon(weapon: string): string {
  if (weapon.startsWith('weapon_knife') || weapon === 'weapon_bayonet') return 'knife';
  if (weapon.includes('gloves') || weapon.includes('handwraps')) return 'gloves';
  return weapon;
}

/** A skin's finish as the loadout shows it; a knife's plain model reads "Default". */
export function finishOf(skin: Pick<OwnedSkin, 'name'>, t: (key: string) => string): string {
  return skin.name === 'Vanilla' ? t('skins.v2.default') : skin.name;
}

/** A catalogue finish's name ("Doppler (Sapphire)", "Default"). */
export function catalogName(skin: FreeCatalogSkin, t: (key: string) => string): string {
  return skin.vanilla ? t('skins.v2.default') : freeSkinName(skin);
}

/** The player's copy of a catalogue finish (a picked one first), if they have one. */
export function copyOf(inventory: OwnedSkin[], skin: FreeCatalogSkin): OwnedSkin | null {
  const name = skin.vanilla ? 'Vanilla' : freeSkinName(skin);
  const mine = inventory.filter((o) => o.weapon === skin.weapon && o.name === name);
  return mine.find((o) => o.source === 'free') ?? mine[0] ?? null;
}

/** The sides a skin is on (both when equipped for both). */
export function sidesOf(skin: Pick<OwnedSkin, 'equippedSides' | 'side'>): Side[] {
  const s = skin.equippedSides;
  const both = s.includes(0);
  const out: Side[] = [];
  if (both ? skin.side !== 2 : s.includes(3)) out.push(3);
  if (both ? skin.side !== 3 : s.includes(2)) out.push(2);
  return out;
}

/** The short name of a side: CT, or T (TR in Portuguese). */
export function sideName(side: Side, t: (key: string) => string): string {
  return side === 3 ? t('skins.side.ct') : t('skins.side.t');
}

/** One side's chip, filled in its game colour: "CT", "TR". */
export function SideChip({ side, size = 'sm' }: { side: Side; size?: 'sm' | 'md' }) {
  const { t } = useModuleTranslation('cs2');
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: size === 'md' ? 0.75 : 0.6,
        height: size === 'md' ? 18 : 16,
        borderRadius: '4px',
        bgcolor: SIDE_COLOR[side],
        color: color.paper,
        ...mono,
        fontSize: size === 'md' ? '0.6875rem' : '0.625rem',
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {sideName(side, t)}
    </Box>
  );
}

/** "Equipped [CT] [TR]": where a skin is on, in the sides' colours. Nothing when it is off. */
export function EquippedOn({ sides, label = true }: { sides: Side[]; label?: boolean }) {
  const { t } = useModuleTranslation('cs2');
  if (sides.length === 0) return null;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        fontSize: '0.6875rem',
        color: color.ink2,
      }}
    >
      {label && t('skins.v2.equipped')}
      {sides.map((s) => (
        <SideChip key={s} side={s} />
      ))}
    </Box>
  );
}

/** An agent's picture (the game's portrait), or a silhouette for the game's default. */
export function AgentFigure({ agent, height }: { agent: FreeAgent | null; height: number }) {
  const [broken, setBroken] = useState(false);
  if (agent && !broken) {
    return (
      <Box
        component="img"
        src={agent.image}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        sx={{ width: '100%', height, objectFit: 'contain', display: 'block' }}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={{ height, display: 'grid', placeItems: 'center', color: withAlpha(color.ink, 0.18) }}
    >
      <UserIcon size={Math.min(96, height * 0.6)} weight="fill" />
    </Box>
  );
}

export interface UndoNotice {
  text: string;
  sub?: string;
  undo?: () => void;
}

/**
 * What just changed, with "Undo" (bottom right, under the site's edge). It
 * goes away by itself after a few seconds, or when the next one comes.
 */
export function UndoToast({ notice, onDone }: { notice: UndoNotice | null; onDone: () => void }) {
  const { t } = useModuleTranslation('cs2');
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(timer);
  }, [notice, onDone]);
  if (!notice) return null;
  return (
    <Box
      role="status"
      data-testid="loadout-toast"
      sx={{
        position: 'fixed',
        zIndex: 1300,
        right: { xs: 16, sm: siteEdgeRight },
        left: { xs: 16, sm: 'auto' },
        bottom: 24,
        maxWidth: { sm: 560 },
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.25,
        pl: 1.75,
        pr: 1.25,
        borderRadius: '10px',
        bgcolor: color.paper3,
        border: `1px solid ${withAlpha(color.ink, 0.1)}`,
        boxShadow: `0 12px 32px ${color.shadow}`,
      }}
    >
      <CheckIcon size={18} weight="bold" color={color.live} aria-hidden style={{ flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{notice.text}</Typography>
        {notice.sub && (
          <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>{notice.sub}</Typography>
        )}
      </Box>
      {notice.undo && (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            notice.undo?.();
            onDone();
          }}
          data-testid="loadout-undo"
          sx={{ borderRadius: radii.sm, flexShrink: 0 }}
        >
          {t('skins.v2.undo')}
        </Button>
      )}
    </Box>
  );
}

/** A panel of the loadout pages: the page's second paper, a quiet border, small corners. */
export const panel = {
  borderRadius: '12px',
  bgcolor: color.paper2,
  border: `1px solid ${withAlpha(color.ink, 0.07)}`,
} as const;

/** A card on a panel: one step lighter, a border that shows on hover. */
export const card = {
  borderRadius: radii.sm,
  bgcolor: color.paper3,
  border: `1px solid ${withAlpha(color.ink, 0.07)}`,
  '&:hover': { borderColor: withAlpha(color.ink, 0.22) },
  '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
} as const;

/** The small caps label over a group ("PISTOLS"). */
export const groupLabel = {
  ...mono,
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: color.muted,
} as const;

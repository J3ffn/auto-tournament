import { useState, type DragEvent } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { UserIcon } from '@phosphor-icons/react';
import { radii, tokens, useModuleTranslation, withAlpha } from '../../../../module-sdk';
import type { FreeAgent } from '../freeSkins';
import { COLUMNS, SIDE_COLOR, SIDE_TEXT, type Column, type Side } from './model';
import { AgentFigure, groupLabel, panel, sideName } from './parts';
import { WeaponSlot, type SlotDrag, type SlotLook } from './WeaponSlot';

const { color } = tokens;

/** A weapon being moved: dragged, or picked to be put somewhere with a click. */
export interface Moving {
  weapon: string;
  column: Column;
  /** Its slot in the loadout, or null for one from outside it. */
  from: number | null;
}

export interface BoardProps {
  side: Side;
  onSide: (side: Side) => void;
  /** The weapons each column of this side shows. */
  columns: Record<Column, string[]>;
  /** How many weapons each column could take. */
  poolSize: Record<Column, number>;
  look: (slotId: string, side: Side) => SlotLook;
  agentOf: (side: Side) => FreeAgent | null;
  selected: string | null;
  onSelect: (slotId: string, side: Side) => void;
  moving: Moving | null;
  /** Whether the weapon being moved can go in this slot. */
  canTake: (column: Column, index: number) => boolean;
  onDragStart: (m: Moving) => void;
  onDragEnd: () => void;
  onDrop: (column: Column, index: number) => void;
  startingPistols: string[];
}

/**
 * Fork (free mode): the loadout like the game's screen. The CT agent on the
 * left, the TR one on the right, the side being edited lit up in its colour,
 * and its weapons in three columns of five that can be dragged around.
 */
export function LoadoutBoard(p: BoardProps) {
  const { t } = useModuleTranslation('cs2');
  const tone = SIDE_COLOR[p.side];
  const fade =
    p.side === 3
      ? `linear-gradient(90deg, ${withAlpha(tone, 0.34)} 0%, ${withAlpha(tone, 0.12)} 34%, ${withAlpha(tone, 0)} 68%)`
      : `linear-gradient(270deg, ${withAlpha(tone, 0.3)} 0%, ${withAlpha(tone, 0.1)} 34%, ${withAlpha(tone, 0)} 68%)`;
  const titles: Record<Column, string> = {
    pistol: t('skins.v2.loadout.pistols'),
    mid: t('skins.v2.loadout.mid'),
    rifle: t('skins.v2.loadout.rifles'),
  };

  return (
    <Box
      component="section"
      aria-label={t('skins.v2.loadout.boardLabel', { side: sideName(p.side, t) })}
      data-testid="loadout-board"
      data-side={p.side}
      sx={{
        ...panel,
        background: `${fade}, ${color.paper2}`,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: '160px minmax(0, 1fr) 160px',
          lg: '190px minmax(0, 1fr) 190px',
        },
        gridTemplateAreas: { xs: '"ct t" "cols cols"', md: '"ct cols t"' },
      }}
    >
      {([3, 2] as const).map((s) => (
        <SidePanel key={s} {...p} panelSide={s} />
      ))}
      <Box
        sx={{
          gridArea: 'cols',
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: { xs: 2, sm: 1.25, lg: 1.5 },
          p: { xs: 1.5, md: '16px 8px' },
        }}
      >
        {COLUMNS.map((col) => (
          <Box key={col} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
            <Typography
              component="h3"
              sx={{
                ...groupLabel,
                color: SIDE_TEXT[p.side],
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              {titles[col]}
              <Box component="span" sx={{ color: color.muted, letterSpacing: 0 }}>
                {t('skins.v2.loadout.ofPool', { count: p.poolSize[col] })}
              </Box>
            </Typography>
            {p.columns[col].map((weapon, index) => {
              const look = p.look(weapon, p.side);
              const target =
                !!p.moving &&
                p.moving.column === col &&
                p.moving.weapon !== weapon &&
                p.canTake(col, index);
              const drag: SlotDrag = {
                onDragStart: (e: DragEvent) => {
                  try {
                    e.dataTransfer.setData('text/plain', weapon);
                    e.dataTransfer.effectAllowed = 'move';
                  } catch {
                    // Some browsers refuse data on synthetic drags; the state carries it.
                  }
                  p.onDragStart({ weapon, column: col, from: index });
                },
                onDragEnd: p.onDragEnd,
                onDragOver: (e: DragEvent) => {
                  if (target) e.preventDefault();
                },
                onDrop: (e: DragEvent) => {
                  e.preventDefault();
                  if (target) p.onDrop(col, index);
                },
              };
              const starting = col === 'pistol' && index === 0;
              return (
                <WeaponSlot
                  key={weapon}
                  slotId={weapon}
                  look={look}
                  note={starting ? t('skins.v2.loadout.starting') : undefined}
                  selected={p.selected === weapon}
                  target={target}
                  faded={p.moving?.from === index && p.moving.column === col}
                  sideTone={SIDE_TEXT[p.side]}
                  drag={drag}
                  label={t('skins.v2.loadout.slotLabel', { name: look.name, finish: look.finish })}
                  onClick={() => (target ? p.onDrop(col, index) : p.onSelect(weapon, p.side))}
                />
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** One side's agent, knife and gloves, and the button that edits that side. */
function SidePanel(p: BoardProps & { panelSide: Side }) {
  const { t } = useModuleTranslation('cs2');
  const s = p.panelSide;
  const on = s === p.side;
  const agent = p.agentOf(s);
  const chars: Array<{ id: string; label: string }> = [
    { id: 'agent', label: t('skins.v2.slot.agent') },
    { id: 'knife', label: t('skins.v2.slot.knife') },
    { id: 'gloves', label: t('skins.v2.slot.gloves') },
  ];
  return (
    <Box
      data-testid={`loadout-side-${s === 3 ? 'ct' : 't'}`}
      sx={{
        gridArea: s === 3 ? 'ct' : 't',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: { xs: 1.5, md: '16px 14px' },
        opacity: on ? 1 : 0.55,
        transition: 'opacity 160ms',
        '&:hover': { opacity: on ? 1 : 0.8 },
      }}
    >
      <ButtonBase
        onClick={() => p.onSide(s)}
        aria-pressed={on}
        data-testid={`loadout-edit-${s === 3 ? 'ct' : 't'}`}
        sx={{
          height: 34,
          borderRadius: '6px',
          border: `1px solid ${on ? 'transparent' : withAlpha(color.ink, 0.14)}`,
          bgcolor: on ? SIDE_COLOR[s] : withAlpha(color.paper, 0.5),
          color: on ? color.paper : color.ink2,
          fontWeight: 700,
          fontSize: '0.8125rem',
          letterSpacing: '0.02em',
          '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
        }}
      >
        {on
          ? t('skins.v2.loadout.editing', { side: sideName(s, t) })
          : t('skins.v2.loadout.edit', { side: sideName(s, t) })}
      </ButtonBase>
      <Box sx={{ display: 'flex', gap: 1, flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: { xs: 'none', md: 'flex' },
            alignItems: 'flex-end',
            '@media (max-height: 820px)': { display: { md: 'none' } },
          }}
        >
          <AgentFigure agent={agent} height={230} />
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            gap: 0.75,
            width: { xs: '100%', md: 58 },
            '@media (max-height: 820px)': { width: { md: '100%' }, flexDirection: { md: 'row' } },
          }}
        >
          {chars.map((c) => {
            const look = c.id === 'agent' ? null : p.look(c.id, s);
            const selected = on && p.selected === c.id;
            return (
              <ButtonBase
                key={c.id}
                onClick={() => p.onSelect(c.id, s)}
                aria-pressed={selected}
                aria-label={`${c.label}: ${c.id === 'agent' ? (agent?.name ?? t('skins.v2.default')) : (look?.finish ?? '')}`}
                data-testid="loadout-char"
                data-slot={c.id}
                sx={{
                  flex: { xs: 1, md: '0 0 auto' },
                  '@media (max-height: 820px)': { flex: 1 },
                  height: 52,
                  borderRadius: '6px',
                  position: 'relative',
                  overflow: 'hidden',
                  bgcolor: color.paper,
                  border: `1px solid ${selected ? color.accent : withAlpha(color.ink, 0.08)}`,
                  '&:hover': { borderColor: selected ? color.accent : withAlpha(color.ink, 0.24) },
                  '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
                }}
              >
                <CharPicture agent={c.id === 'agent' ? agent : undefined} look={look} />
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 2,
                    bgcolor: (c.id === 'agent' ? agent?.color : look?.rarity) ?? 'transparent',
                  }}
                />
              </ButtonBase>
            );
          })}
        </Box>
      </Box>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          gap: '1px',
          p: '8px 8px 9px',
          borderRadius: radii.sm,
          bgcolor: withAlpha(color.paper, 0.6),
          borderLeft: `3px solid ${agent?.color ?? withAlpha(color.ink, 0.14)}`,
        }}
      >
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.25 }}>
          {agent?.name ?? t('skins.v2.loadout.defaultAgent')}
        </Typography>
        <Typography sx={{ fontSize: '0.6875rem', color: color.muted }}>
          {s === 3 ? t('skins.v2.loadout.ctLong') : t('skins.v2.loadout.tLong')}
        </Typography>
      </Box>
    </Box>
  );
}

/** A character tile's picture: the agent's portrait, or the knife's or gloves' look. */
function CharPicture({
  agent,
  look,
}: {
  agent: FreeAgent | null | undefined;
  look: SlotLook | null;
}) {
  const [broken, setBroken] = useState(false);
  if (agent !== undefined) {
    if (!agent || broken) return <UserIcon size={22} color={color.muted} aria-hidden />;
    return (
      <Box
        component="img"
        src={agent.image}
        onError={() => setBroken(true)}
        alt=""
        sx={{ height: '100%', maxWidth: '100%', objectFit: 'cover' }}
      />
    );
  }
  if (!look?.image) return null;
  return (
    <Box
      component="img"
      src={look.image}
      alt=""
      sx={{
        maxWidth: '86%',
        maxHeight: '74%',
        objectFit: 'contain',
        filter: look.rarity ? 'none' : 'grayscale(1)',
        opacity: look.rarity ? 1 : 0.45,
      }}
    />
  );
}

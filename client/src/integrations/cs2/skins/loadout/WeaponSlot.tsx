import type { DragEvent } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { radii, tokens, withAlpha } from '../../../../module-sdk';

const { color } = tokens;

export interface SlotLook {
  /** The weapon's name ("AK-47"), or the slot's ("Knife"). */
  name: string;
  /** The equipped finish, or "Default". */
  finish: string;
  image: string | null;
  /** The finish's rarity colour; null for the game's default look. */
  rarity: string | null;
}

/** Drag and drop on a slot: what the board passes when the slot can take part. */
export interface SlotDrag {
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
}

/**
 * Fork (free mode): one weapon of the loadout. A click opens its skins (or,
 * while a weapon is being moved, puts it here); dragging moves the weapon.
 * `target` marks a slot the weapon being moved can go to, in the side's colour.
 */
export function WeaponSlot({
  look,
  note,
  selected,
  target,
  faded,
  sideTone,
  drag,
  onClick,
  label,
  compact = false,
  testId = 'loadout-slot',
  slotId,
}: {
  look: SlotLook;
  /** A word after the name ("starting"). */
  note?: string;
  selected: boolean;
  target: boolean;
  /** The slot the weapon being dragged came from. */
  faded?: boolean;
  sideTone: string;
  drag?: SlotDrag;
  onClick: () => void;
  label: string;
  compact?: boolean;
  testId?: string;
  slotId: string;
}) {
  const plain = look.rarity === null;
  let border = withAlpha(color.ink, 0.07);
  let bg: string = color.paper3;
  if (target) {
    border = withAlpha(sideTone, 0.9);
    bg = withAlpha(sideTone, 0.14);
  } else if (selected) {
    border = color.accent;
    bg = withAlpha(color.accent, 0.1);
  }
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      draggable={Boolean(drag)}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      data-testid={testId}
      data-slot={slotId}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        gap: 1.25,
        height: compact ? 50 : 60,
        '@media (max-height: 820px)': { height: compact ? 46 : 52 },
        p: '4px 8px 4px 4px',
        borderRadius: radii.sm,
        border: `1px ${target ? 'dashed' : 'solid'} ${border}`,
        bgcolor: bg,
        color: color.ink,
        textAlign: 'left',
        opacity: faded ? 0.4 : 1,
        cursor: drag ? 'grab' : 'pointer',
        transition: 'border-color 120ms, background-color 120ms, opacity 120ms',
        '&:hover': { borderColor: target || selected ? border : withAlpha(color.ink, 0.22) },
        '&:active': { cursor: drag ? 'grabbing' : 'pointer' },
        '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: compact ? 70 : 84,
          height: '100%',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '6px',
          overflow: 'hidden',
          bgcolor: color.paper,
        }}
      >
        {look.image && (
          <Box
            component="img"
            src={look.image}
            alt=""
            draggable={false}
            loading="lazy"
            sx={{
              maxWidth: '92%',
              maxHeight: '80%',
              objectFit: 'contain',
              filter: plain ? 'grayscale(1) contrast(0.9)' : 'none',
              opacity: plain ? 0.45 : 1,
            }}
          />
        )}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            bgcolor: look.rarity ?? 'transparent',
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontSize: '0.75rem', color: color.muted }}>
          {look.name}
          {note && (
            <Box component="span" sx={{ color: sideTone }}>
              {' · '}
              {note}
            </Box>
          )}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: '0.8125rem', fontWeight: 600, color: plain ? color.muted : color.ink }}
        >
          {look.finish}
        </Typography>
      </Box>
      {drag && (
        <DotsSixVerticalIcon
          size={16}
          aria-hidden
          style={{ flexShrink: 0, color: withAlpha(color.ink, 0.3) }}
        />
      )}
    </ButtonBase>
  );
}

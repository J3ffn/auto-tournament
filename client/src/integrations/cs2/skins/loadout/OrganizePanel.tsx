import type { DragEvent } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  fontDisplay,
  radii,
  tokens,
  useModuleTranslation,
  withAlpha,
} from '../../../../module-sdk';
import { COLUMNS, SIDE_TEXT, type Column, type Side } from './model';
import { groupLabel, panel, sideName } from './parts';
import type { Moving } from './LoadoutBoard';
import { WeaponSlot, type SlotLook } from './WeaponSlot';

const { color } = tokens;

/**
 * Fork (free mode): shown under the loadout while no slot is open. The
 * weapons this side can buy that its loadout does not show; drag one onto a
 * slot of its column (or click it, then the slot) to swap it in.
 */
export function OrganizePanel({
  side,
  outside,
  look,
  moving,
  onPick,
  onDragStart,
  onDragEnd,
  onReset,
  isDefault,
}: {
  side: Side;
  outside: Record<Column, string[]>;
  look: (slotId: string, side: Side) => SlotLook;
  moving: Moving | null;
  onPick: (m: Moving | null) => void;
  onDragStart: (m: Moving) => void;
  onDragEnd: () => void;
  onReset: () => void;
  isDefault: boolean;
}) {
  const { t } = useModuleTranslation('cs2');
  const titles: Record<Column, string> = {
    pistol: t('skins.v2.loadout.pistols'),
    mid: t('skins.v2.loadout.mid'),
    rifle: t('skins.v2.loadout.rifles'),
  };
  const carrying = moving && moving.from === null ? moving : null;
  return (
    <Box
      component="section"
      aria-labelledby="organize-title"
      data-testid="loadout-organize"
      sx={{
        ...panel,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        p: { xs: 2, md: '18px 20px 20px' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: 1.5,
          rowGap: 0.5,
        }}
      >
        <Typography
          id="organize-title"
          component="h2"
          sx={{ fontFamily: fontDisplay, fontSize: '1.25rem', fontWeight: 700 }}
        >
          {t('skins.v2.loadout.outside')}{' '}
          <Box component="span" sx={{ color: SIDE_TEXT[side] }}>
            · {sideName(side, t)}
          </Box>
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: color.muted, flex: '1 1 18rem' }}>
          {carrying
            ? t('skins.v2.loadout.placeHint', { name: look(carrying.weapon, side).name })
            : t('skins.v2.loadout.organizeHint')}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={isDefault}
          onClick={onReset}
          data-testid="loadout-reset-layout"
          sx={{ borderRadius: '6px', color: color.ink2, borderColor: withAlpha(color.ink, 0.14) }}
        >
          {t('skins.v2.loadout.resetLayout')}
        </Button>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {COLUMNS.map((col) => (
          <Box key={col} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
            <Typography component="h3" sx={groupLabel}>
              {titles[col]}
            </Typography>
            {outside[col].length === 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: color.muted, py: 1 }}>
                {t('skins.v2.loadout.allIn')}
              </Typography>
            )}
            {outside[col].map((weapon) => {
              const l = look(weapon, side);
              const on = carrying?.weapon === weapon;
              return (
                <WeaponSlot
                  key={weapon}
                  slotId={weapon}
                  testId="loadout-spare"
                  compact
                  look={l}
                  selected={on}
                  target={false}
                  sideTone={SIDE_TEXT[side]}
                  label={t('skins.v2.loadout.spareLabel', { name: l.name, column: titles[col] })}
                  drag={{
                    onDragStart: (e: DragEvent) => {
                      try {
                        e.dataTransfer.setData('text/plain', weapon);
                        e.dataTransfer.effectAllowed = 'move';
                      } catch {
                        // The state carries the weapon either way.
                      }
                      onDragStart({ weapon, column: col, from: null });
                    },
                    onDragEnd,
                  }}
                  onClick={() => onPick(on ? null : { weapon, column: col, from: null })}
                />
              );
            })}
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: '0.75rem', color: color.muted, borderRadius: radii.sm }}>
        {t('skins.v2.loadout.gameNote')}
      </Typography>
    </Box>
  );
}

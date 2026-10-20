import { useState } from 'react';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import { useModuleTranslation, tokens, radii } from '../../../../module-sdk';
import { rarityColor } from '../rarity';
import { slotsFor, SLOT_GROUPS, type GroupId, type Side } from './slots';
import type { SlotView } from './useArsenal';
import { SlotThumb } from './SlotThumb';

const { color } = tokens;

/** The group a slot belongs to. */
function groupOf(slotId: string): GroupId {
  return SLOT_GROUPS.find((g) => g.slots.some((s) => s.id === slotId))?.id ?? 'char';
}

/**
 * Fork (free mode): the loadout on a phone. The groups as a row of tabs, and
 * the group's slots as a row of tiles under it, each with what is on it (or
 * the game's own look).
 */
export function MobileLoadout({
  side,
  selected,
  view,
  onSelect,
  onCopy,
  copying,
}: {
  side: Side;
  selected: string;
  view: (slotId: string) => SlotView;
  onSelect: (slotId: string) => void;
  onCopy: () => void;
  copying: boolean;
}) {
  const { t } = useModuleTranslation('cs2');
  const [group, setGroup] = useState<GroupId>(() => groupOf(selected));
  const groups = slotsFor(side).filter((g) => g.slots.length > 0);
  const slots = groups.find((g) => g.id === group)?.slots ?? [];
  const otherName = side === 3 ? t('skins.side.t') : t('skins.side.ct');

  return (
    <Box data-testid="arsenal-loadout" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box
        role="group"
        aria-label={t('skins.arsenal.groups')}
        sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: -2, px: 2, pb: 0.5 }}
      >
        {groups.map((g) => {
          const on = g.id === group;
          return (
            <ButtonBase
              key={g.id}
              onClick={() => setGroup(g.id)}
              aria-pressed={on}
              sx={{
                flexShrink: 0,
                height: 38,
                px: 1.75,
                borderRadius: radii.pill,
                fontSize: '0.8125rem',
                fontWeight: on ? 600 : 400,
                whiteSpace: 'nowrap',
                border: `1px solid ${on ? color.ink : color.rule}`,
                bgcolor: on ? color.ink : 'transparent',
                color: on ? color.accentInk : color.ink2,
              }}
            >
              {t(`skins.arsenal.group.${g.id}`)}
            </ButtonBase>
          );
        })}
      </Box>
      <Box
        role="group"
        aria-label={t(`skins.arsenal.group.${group}`)}
        sx={{ display: 'flex', gap: 1, overflowX: 'auto', mx: -2, px: 2, pb: 0.5 }}
      >
        {slots.map((slot) => {
          const v = view(slot.id);
          const on = slot.id === selected;
          return (
            <ButtonBase
              key={slot.id}
              onClick={() => onSelect(slot.id)}
              aria-pressed={on}
              data-testid="arsenal-slot"
              data-slot={slot.id}
              sx={{
                flexShrink: 0,
                flexDirection: 'column',
                gap: 0.5,
                width: 96,
                p: '8px 6px',
                borderRadius: '14px',
                bgcolor: color.paper2,
                border: `1px solid ${on ? color.accent : color.rule}`,
                borderBottom: `3px solid ${v.rarity ? rarityColor[v.rarity] : color.rule}`,
              }}
            >
              <Box
                sx={{
                  width: 76,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  color: color.muted,
                }}
              >
                <SlotThumb src={v.image} agent={slot.id === 'agent'} width={76} height={44} />
              </Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, maxWidth: 88 }} noWrap>
                {v.label}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.625rem',
                  maxWidth: 88,
                  color: v.equipped ? color.ink2 : color.muted,
                  fontStyle: v.equipped ? 'normal' : 'italic',
                }}
                noWrap
              >
                {v.equipped ?? t('skins.arsenal.default')}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>
      <Button
        size="small"
        variant="outlined"
        onClick={onCopy}
        disabled={copying}
        data-testid="arsenal-copy"
        sx={{ alignSelf: 'flex-start', borderRadius: radii.pill }}
      >
        {t('skins.arsenal.copyTo', { side: otherName })}
      </Button>
    </Box>
  );
}

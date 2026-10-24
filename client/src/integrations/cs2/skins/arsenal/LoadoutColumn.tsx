import { useState } from 'react';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import { CaretRightIcon } from '@phosphor-icons/react';
import { useModuleTranslation, tokens, fontDisplay, radii } from '../../../../module-sdk';
import { rarityColor } from '../rarity';
import { slotsFor, type GroupId, type Side } from './slots';
import type { SlotView } from './useArsenal';
import { SlotThumb } from './SlotThumb';

const { color } = tokens;

/**
 * Fork (free mode): the side's whole loadout, grouped as the game's buy menu:
 * knife, gloves and agent, then pistols, SMGs, rifles, heavy and the Zeus.
 * Each row shows what is on the slot, or the game's own look when nothing is.
 */
export function LoadoutColumn({
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
  const [closed, setClosed] = useState<Partial<Record<GroupId, boolean>>>({
    smg: true,
    heavy: true,
    gear: true,
  });
  const sideName = side === 3 ? t('skins.side.ct') : t('skins.side.t');
  const otherName = side === 3 ? t('skins.side.t') : t('skins.side.ct');

  return (
    <Box
      component="aside"
      aria-labelledby="arsenal-loadout"
      data-testid="arsenal-loadout"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          p: 1.5,
          borderRadius: '16px',
          bgcolor: color.paper2,
          border: `1px solid ${color.rule}`,
          // Stays at the top while the column scrolls on its own.
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Typography
          id="arsenal-loadout"
          component="h2"
          sx={{ fontFamily: fontDisplay, fontSize: '1rem', fontWeight: 600 }}
        >
          {t('skins.arsenal.loadout', { side: sideName })}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={onCopy}
          disabled={copying}
          data-testid="arsenal-copy"
          sx={{ borderRadius: radii.pill, whiteSpace: 'nowrap' }}
        >
          {t('skins.arsenal.copyTo', { side: otherName })}
        </Button>
      </Box>

      {slotsFor(side).map((group) => {
        const open = !closed[group.id];
        return (
          <Box key={group.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <ButtonBase
              onClick={() => setClosed((c) => ({ ...c, [group.id]: open }))}
              aria-expanded={open}
              data-testid={`arsenal-group-${group.id}`}
              sx={{
                justifyContent: 'flex-start',
                gap: 1,
                height: 36,
                px: 0.5,
                borderRadius: '8px',
                color: color.ink,
              }}
            >
              <CaretRightIcon
                size={14}
                weight="bold"
                aria-hidden
                style={{ transition: 'transform 150ms', transform: `rotate(${open ? 90 : 0}deg)` }}
              />
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {t(`skins.arsenal.group.${group.id}`)}
              </Typography>
            </ButtonBase>
            {open &&
              group.slots.map((slot) => (
                <SlotRow
                  key={slot.id}
                  view={view(slot.id)}
                  on={slot.id === selected}
                  onClick={() => onSelect(slot.id)}
                />
              ))}
          </Box>
        );
      })}
    </Box>
  );
}

function SlotRow({ view, on, onClick }: { view: SlotView; on: boolean; onClick: () => void }) {
  const { t } = useModuleTranslation('cs2');
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      data-testid="arsenal-slot"
      data-slot={view.id}
      sx={{
        justifyContent: 'flex-start',
        gap: 1.25,
        p: '6px 10px 6px 6px',
        borderRadius: '12px',
        textAlign: 'left',
        bgcolor: on ? color.paper3 : color.paper2,
        border: `1px solid ${on ? color.accent : color.rule}`,
        '&:hover': { borderColor: on ? color.accent : color.muted },
        '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          width: 60,
          height: 40,
          borderRadius: '8px',
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          bgcolor: color.paper3,
          color: color.muted,
        }}
      >
        <SlotThumb
          src={view.image}
          agent={view.id === 'agent'}
          width={52}
          height={32}
          dim={!view.equipped}
        />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }} noWrap>
          {view.label}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: view.equipped ? color.ink2 : color.muted,
            fontStyle: view.equipped ? 'normal' : 'italic',
          }}
          noWrap
        >
          {view.equipped ?? t('skins.arsenal.default')}
        </Typography>
      </Box>
      <Box
        aria-hidden
        sx={{
          width: 3,
          alignSelf: 'stretch',
          borderRadius: '3px',
          bgcolor: view.rarity ? rarityColor[view.rarity] : 'transparent',
        }}
      />
    </ButtonBase>
  );
}

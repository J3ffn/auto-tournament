import { useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { UserCircleIcon } from '@phosphor-icons/react';
import { useModuleTranslation, tokens } from '../../../../module-sdk';
import type { FreeAgent } from '../freeSkins';
import { SHORT_SCREEN, TINY_SCREEN } from './layout';
import type { Side } from './slots';

const { color } = tokens;

/** Fork (free mode): a side's agents to pick from, the game's own one first. */
export function AgentGrid({
  side,
  agents,
  selected,
  onPick,
}: {
  side: Side;
  agents: FreeAgent[];
  selected: string | null;
  onPick: (model: string | null) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const mine = agents.filter((a) => a.team === side);
  const tile = (agent: FreeAgent | null) => {
    const on = (agent?.model ?? null) === selected;
    return (
      <ButtonBase
        key={agent?.model ?? 'default'}
        onClick={() => onPick(agent?.model ?? null)}
        aria-pressed={on}
        data-testid="arsenal-agent"
        sx={{
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0.75,
          p: 1,
          borderRadius: '14px',
          textAlign: 'left',
          bgcolor: color.paper2,
          border: `2px solid ${on ? color.accent : color.rule}`,
        }}
      >
        <AgentPicture agent={agent} />
        <Box
          aria-hidden
          sx={{ height: 3, borderRadius: '2px', bgcolor: agent?.color ?? color.rule }}
        />
        <Typography sx={{ fontSize: '0.8125rem' }}>
          {agent?.name ?? t('skins.free.defaultAgent')}
        </Typography>
      </ButtonBase>
    );
  };
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: 1.25,
      }}
    >
      {tile(null)}
      {mine.map(tile)}
    </Box>
  );
}

export function AgentPicture({
  agent,
  stage = false,
}: {
  agent: FreeAgent | null;
  /** The panel's big picture, sized like a skin's (smaller on short screens). */
  stage?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const size = stage
    ? {
        height: { xs: 170, sm: 200 },
        [SHORT_SCREEN]: { height: 140 },
        [TINY_SCREEN]: { height: 96 },
      }
    : { height: 120 };
  return agent && !broken ? (
    <Box
      component="img"
      src={agent.image}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      sx={{
        width: '100%',
        ...size,
        objectFit: 'contain',
        bgcolor: color.paper3,
        borderRadius: '10px',
      }}
    />
  ) : (
    <Box
      aria-hidden
      sx={{
        ...size,
        display: 'grid',
        placeItems: 'center',
        bgcolor: color.paper3,
        borderRadius: '10px',
        color: color.muted,
      }}
    >
      <UserCircleIcon size={stage ? 64 : 48} />
    </Box>
  );
}

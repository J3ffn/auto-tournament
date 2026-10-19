import { useState } from 'react';
import { Box, ButtonBase, Dialog, IconButton, Typography } from '@mui/material';
import { UserCircleIcon, XIcon } from '@phosphor-icons/react';
import {
  useModuleTranslation,
  useSnackbar,
  tokens,
  fontDisplay,
  dialogPaperSx,
} from '../../../module-sdk';
import { useFreeAgents, type FreeAgent } from './freeSkins';

const { color } = tokens;

/**
 * Fork (free mode): the agent (player model) per side, under the loadout. A
 * tile per side shows the pick, or the game's default; a click opens that
 * side's agents.
 */
export function FreeAgents() {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const { agents, mine, setAgent } = useFreeAgents(true);
  const [side, setSide] = useState<2 | 3 | null>(null);
  if (!agents.length) return null;

  const pickedFor = (team: 2 | 3) => {
    const model = team === 3 ? mine.ct : mine.t;
    return agents.find((a) => a.model === model) ?? null;
  };
  const choose = (team: 2 | 3, model: string | null) => {
    setSide(null);
    void setAgent(team, model).catch((error: unknown) =>
      showError(error instanceof Error ? error.message : t('skins.free.failed'))
    );
  };

  return (
    <Box
      component="section"
      aria-labelledby="agents-title"
      data-testid="free-agents"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Typography
        id="agents-title"
        component="h2"
        sx={{ fontFamily: fontDisplay, fontSize: '1.25rem', fontWeight: 600 }}
      >
        {t('skins.free.agents')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 1.25,
        }}
      >
        {([3, 2] as const).map((team) => {
          const agent = pickedFor(team);
          const sideName = team === 3 ? t('skins.side.ct') : t('skins.side.t');
          return (
            <ButtonBase
              key={team}
              onClick={() => setSide(team)}
              data-testid={`free-agent-${team === 3 ? 'ct' : 't'}`}
              aria-label={`${t('skins.free.agents')} ${sideName}: ${agent?.name ?? t('skins.free.defaultAgent')}`}
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                justifyContent: 'flex-start',
                textAlign: 'left',
                p: 1.25,
                borderRadius: '14px',
                bgcolor: color.paper2,
                border: `1px ${agent ? 'solid' : 'dashed'} ${agent ? agent.color : color.rule}`,
                '&:hover': { borderColor: color.muted },
              }}
            >
              <AgentPicture agent={agent} size={64} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: team === 3 ? color.sideCt : color.sideT,
                  }}
                >
                  {sideName}
                </Typography>
                <Typography sx={{ fontSize: '0.875rem' }} noWrap>
                  {agent?.name ?? t('skins.free.defaultAgent')}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
      {side !== null && (
        <AgentDialog
          team={side}
          agents={agents.filter((a) => a.team === side)}
          current={side === 3 ? mine.ct : mine.t}
          onPick={(model) => choose(side, model)}
          onClose={() => setSide(null)}
        />
      )}
    </Box>
  );
}

function AgentPicture({ agent, size }: { agent: FreeAgent | null; size: number }) {
  // A picture Steam does not serve (or a network that blocks it) falls back to the icon.
  const [broken, setBroken] = useState(false);
  return agent && !broken ? (
    <Box
      component="img"
      src={agent.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        bgcolor: color.paper3,
        borderRadius: '10px',
      }}
    />
  ) : (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        bgcolor: color.paper3,
        borderRadius: '10px',
        color: color.muted,
      }}
    >
      <UserCircleIcon size={size * 0.5} />
    </Box>
  );
}

function AgentDialog({
  team,
  agents,
  current,
  onPick,
  onClose,
}: {
  team: 2 | 3;
  agents: FreeAgent[];
  current: string | null;
  onPick: (model: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const tile = (agent: FreeAgent | null) => {
    const on = (agent?.model ?? null) === current;
    return (
      <ButtonBase
        key={agent?.model ?? 'default'}
        onClick={() => onPick(agent?.model ?? null)}
        aria-pressed={on}
        data-testid="free-agent-option"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0.75,
          p: 1,
          borderRadius: '14px',
          bgcolor: color.paper2,
          border: `2px solid ${on ? color.accent : 'transparent'}`,
          textAlign: 'left',
          '&:hover': { borderColor: on ? color.accent : color.muted },
        }}
      >
        <AgentPicture agent={agent} size={120} />
        <Box sx={{ height: 3, borderRadius: 2, bgcolor: agent?.color ?? color.rule }} />
        <Typography sx={{ fontSize: '0.8125rem' }}>
          {agent?.name ?? t('skins.free.defaultAgent')}
        </Typography>
      </ButtonBase>
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="agent-dialog-title"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            id="agent-dialog-title"
            component="h2"
            sx={{ fontFamily: fontDisplay, fontSize: '1.375rem', fontWeight: 600 }}
          >
            {t('skins.free.agentsFor', {
              side: team === 3 ? t('skins.side.ct') : t('skins.side.t'),
            })}
          </Typography>
          <IconButton aria-label={t('common.close')} onClick={onClose}>
            <XIcon size={16} />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 1.25,
          }}
        >
          {tile(null)}
          {agents.map(tile)}
        </Box>
      </Box>
    </Dialog>
  );
}

import { useState } from 'react';
import { Box } from '@mui/material';
import { apiErrorMessage, useModuleTranslation, useSnackbar } from '../../../../module-sdk';
import { panel, sideName } from './parts';
import { Header, PickCard, type PickerProps } from './PickParts';

/** Fork (free mode): the agent slot's choices, that side's agents and the game's default. */
export function AgentPicker(p: PickerProps) {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const [busy, setBusy] = useState(false);
  const list = p.agents.agents.filter((a) => a.team === p.side);
  const current = p.side === 3 ? p.agents.mine.ct : p.agents.mine.t;
  const pick = async (model: string | null) => {
    if (busy || model === current) return;
    const prev = current;
    setBusy(true);
    try {
      await p.agents.setAgent(p.side, model);
      const name = list.find((a) => a.model === model)?.name ?? t('skins.v2.loadout.defaultAgent');
      p.notify({
        text: t('skins.v2.loadout.agentToast', { name, side: sideName(p.side, t) }),
        sub: p.onServer ? t('skins.v2.loadout.appliesSpawn') : undefined,
        undo: () => void p.agents.setAgent(p.side, prev),
      });
    } catch (error) {
      showError(apiErrorMessage(error, t('skins.free.failed')));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box
      component="section"
      aria-labelledby="picker-title"
      data-testid="loadout-picker"
      sx={{
        ...panel,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        p: { xs: 2, md: '18px 20px 20px' },
      }}
    >
      <Header p={p} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 1.25,
        }}
      >
        <PickCard
          image={null}
          plain
          name={t('skins.v2.loadout.defaultAgent')}
          sub={t('skins.v2.noSkin')}
          on={!current}
          onClick={() => void pick(null)}
          label={t('skins.v2.loadout.defaultAgent')}
          tall
        />
        {list.map((a) => (
          <PickCard
            key={a.model}
            image={a.image}
            tone={a.color}
            name={a.name}
            sub={t('skins.v2.slot.agent')}
            on={a.model === current}
            onClick={() => void pick(a.model)}
            label={a.name}
            tall
            cover
          />
        ))}
      </Box>
    </Box>
  );
}

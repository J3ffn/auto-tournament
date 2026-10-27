import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { PlusIcon } from '@phosphor-icons/react';
import { PageHead, radii, tokens, useModuleTranslation, withAlpha } from '../../../../module-sdk';
import { VirtualNotice } from '../SkinParts';
import { skinPaths } from '../paths';
import { LoadoutMenu } from './LoadoutMenu';
import type { Loadouts } from './useLoadouts';

const { color } = tokens;

/**
 * Fork (free mode): the top of the inventory pages. The title, the saved
 * loadouts menu, "Add skins", the My items / Loadout tabs, and the notice that
 * these are not real CS2 skins.
 */
export function InventoryHeader({
  tab,
  subtitle,
  loadouts,
}: {
  tab: 'items' | 'loadout';
  subtitle: string;
  loadouts: Loadouts;
}) {
  const { t } = useModuleTranslation('cs2');
  const tabs = [
    { key: 'items', to: skinPaths.inventory, label: t('skins.v2.items.title') },
    { key: 'loadout', to: skinPaths.loadout, label: t('skins.v2.loadout.title') },
  ] as const;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <PageHead
        eyebrow={t('skins.v2.eyebrow')}
        title={tab === 'items' ? t('skins.v2.items.title') : t('skins.v2.loadout.title')}
        subtitle={subtitle}
        sx={{ mb: 0, '@media (max-height: 820px)': { '& h1': { fontSize: '2rem' } } }}
        actions={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <LoadoutMenu loadouts={loadouts} />
            <Button
              component={RouterLink}
              to={skinPaths.add}
              variant="contained"
              startIcon={<PlusIcon size={16} weight="bold" />}
              data-testid="inventory-add"
              sx={{ height: 40, borderRadius: radii.sm, fontWeight: 600 }}
            >
              {t('skins.v2.add.button')}
            </Button>
          </Box>
        }
      />
      <Box
        component="nav"
        aria-label={t('skins.inventory')}
        sx={{ display: 'flex', gap: 3, borderBottom: `1px solid ${withAlpha(color.ink, 0.08)}` }}
      >
        {tabs.map((x) => {
          const on = x.key === tab;
          return (
            <Box
              key={x.key}
              component={RouterLink}
              to={x.to}
              aria-current={on ? 'page' : undefined}
              data-testid={`inventory-tab-${x.key}`}
              sx={{
                py: 1.25,
                px: 0.25,
                mb: '-1px',
                color: on ? color.ink : color.ink2,
                textDecoration: 'none',
                fontWeight: 600,
                borderBottom: `2px solid ${on ? color.accent : 'transparent'}`,
                '&:hover': { color: color.ink },
                '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 2 },
              }}
            >
              {x.label}
            </Box>
          );
        })}
      </Box>
      <VirtualNotice compact />
    </Box>
  );
}

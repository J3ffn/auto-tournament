import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import {
  useModuleTranslation,
  tokens,
  fontDisplay,
  mono,
  radii,
  withAlpha,
} from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { SlotThumb } from './SlotThumb';
import { rarityColor, RARITY_ORDER } from '../rarity';
import { freeSkinName, type FreeAgent, type FreeCatalogSkin } from '../freeSkins';
import { AgentGrid } from './AgentGrid';
import { SHORT_SCREEN } from './layout';
import type { OwnedSkin, Rarity } from '../useSkins';
import { hasModels, type Side } from './slots';
import { finishName, slotOfWeapon } from './useArsenal';

const { color } = tokens;
const PAGE = 60;

/** A catalogue finish's key: weapon and paint kit. */
export const finishKey = (s: Pick<FreeCatalogSkin, 'weapon' | 'paintKit'>) =>
  `${s.weapon}|${s.paintKit}`;

/**
 * Fork (free mode): the finishes for the slot picked in the loadout. Knives and
 * gloves first ask for the model (a knife's first card is its plain look);
 * the agent slot lists that side's agents.
 */
export function SlotCatalog({
  slotId,
  label,
  side,
  catalog,
  inventory,
  model,
  onModel,
  selected,
  onPick,
  agents,
  agentSelected,
  onPickAgent,
}: {
  slotId: string;
  label: string;
  side: Side;
  catalog: FreeCatalogSkin[] | null;
  inventory: OwnedSkin[];
  model: string | null;
  onModel: (weapon: string) => void;
  selected: string | null;
  onPick: (skin: FreeCatalogSkin) => void;
  agents: FreeAgent[];
  agentSelected: string | null;
  onPickAgent: (model: string | null) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | Rarity>('all');
  const [shown, setShown] = useState(PAGE);

  const inSlot = useMemo(
    () => (catalog ?? []).filter((s) => slotOfWeapon(s.weapon) === slotId),
    [catalog, slotId]
  );
  const models = useMemo(() => {
    if (!hasModels(slotId)) return [];
    const byWeapon = new Map<string, FreeCatalogSkin>();
    for (const s of inSlot) {
      const had = byWeapon.get(s.weapon);
      // A knife shows its plain look; gloves their first finish.
      if (!had || (s.vanilla && !had.vanilla)) byWeapon.set(s.weapon, s);
    }
    return [...byWeapon.values()].sort((a, b) => a.weaponName.localeCompare(b.weaponName));
  }, [inSlot, slotId]);

  const list = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return inSlot
      .filter((s) => !hasModels(slotId) || s.weapon === model)
      .filter((s) => rarity === 'all' || s.rarity === rarity)
      .filter((s) => {
        const text = `${s.name} ${s.variant ?? ''}`.toLowerCase();
        return words.every((w) => text.includes(w));
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.vanilla)) - Number(Boolean(a.vanilla)) ||
          RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
          a.name.localeCompare(b.name)
      );
  }, [inSlot, slotId, model, rarity, query]);

  const rarities = useMemo(
    () => RARITY_ORDER.filter((r) => inSlot.some((s) => s.rarity === r)).reverse() as Rarity[],
    [inSlot]
  );
  const equippedName = (s: FreeCatalogSkin) =>
    inventory.some(
      (o) =>
        o.weapon === s.weapon &&
        o.name === (s.vanilla ? 'Vanilla' : freeSkinName(s)) &&
        (o.equippedSides.includes(side) || o.equippedSides.includes(0))
    );
  let count = t('skins.free.count', { count: inSlot.length });
  if (slotId === 'agent') count = t('skins.arsenal.agentCount', { count: agents.length });
  else if (hasModels(slotId) && model) {
    const modelName = models.find((m) => m.weapon === model)?.weaponName ?? '';
    count = `${modelName} · ${t('skins.arsenal.finishCount', { count: list.length })}`;
  }

  return (
    <Box
      component="section"
      aria-labelledby="arsenal-catalog"
      data-testid="arsenal-catalog"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, minWidth: 0 }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0 }}>
          <Typography
            id="arsenal-catalog"
            component="h2"
            sx={{ fontFamily: fontDisplay, fontSize: '1.375rem', fontWeight: 600 }}
          >
            {label}
          </Typography>
          <Typography sx={{ ...mono, fontSize: '0.8125rem', color: color.muted }}>
            {count}
          </Typography>
        </Box>
        {slotId !== 'agent' && (
          <TextField
            size="small"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            placeholder={t('skins.arsenal.search')}
            inputProps={{
              'aria-label': t('skins.arsenal.search'),
              'data-testid': 'arsenal-search',
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MagnifyingGlassIcon size={16} />
                </InputAdornment>
              ),
              sx: { borderRadius: radii.pill },
            }}
            sx={{ width: { xs: '100%', sm: 260 } }}
          />
        )}
      </Box>

      {models.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: color.ink2 }}>
            {t('skins.arsenal.model')}
          </Typography>
          <Box
            role="group"
            aria-label={t('skins.arsenal.model')}
            sx={{
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 0.5,
              mx: { xs: -2, sm: 0 },
              px: { xs: 2, sm: 0 },
            }}
          >
            {models.map((m) => {
              const on = m.weapon === model;
              return (
                <ButtonBase
                  key={m.weapon}
                  onClick={() => {
                    onModel(m.weapon);
                    setShown(PAGE);
                  }}
                  aria-pressed={on}
                  data-testid="arsenal-model"
                  sx={{
                    flexShrink: 0,
                    flexDirection: 'column',
                    gap: 0.75,
                    minWidth: 104,
                    p: '8px 10px',
                    borderRadius: '12px',
                    bgcolor: on ? color.paper3 : color.paper2,
                    border: `2px solid ${on ? color.accent : color.rule}`,
                  }}
                >
                  <Box sx={{ width: 80, height: 40, display: 'grid', placeItems: 'center' }}>
                    <SlotThumb src={skinCardUrl(m.image)} width={80} height={40} />
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {m.weaponName}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      )}

      {slotId === 'agent' && (
        <AgentGrid side={side} agents={agents} selected={agentSelected} onPick={onPickAgent} />
      )}
      {slotId !== 'agent' && !catalog && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress aria-label={label} />
        </Box>
      )}
      {slotId !== 'agent' && catalog && (
        <>
          {rarities.length > 1 && (
            <Box
              role="group"
              aria-label={t('skins.arsenal.rarity')}
              // One scrolling row on a phone, so the finishes start higher up.
              sx={{
                display: 'flex',
                flexWrap: { xs: 'nowrap', sm: 'wrap' },
                overflowX: { xs: 'auto', sm: 'visible' },
                mx: { xs: -2, sm: 0 },
                px: { xs: 2, sm: 0 },
                pb: { xs: 0.5, sm: 0 },
                gap: 1,
              }}
            >
              {(['all', ...rarities] as Array<'all' | Rarity>).map((r) => (
                <Chip
                  key={r}
                  on={rarity === r}
                  dot={r === 'all' ? null : rarityColor[r]}
                  onClick={() => setRarity(r)}
                >
                  {r === 'all' ? t('skins.filter.all') : t(`skins.rarity.${r}`)}
                </Chip>
              ))}
            </Box>
          )}
          {list.length === 0 ? (
            <Typography sx={{ color: color.ink2 }}>{t('skins.noneInFilter')}</Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(auto-fill, minmax(140px, 1fr))',
                  sm: 'repeat(auto-fill, minmax(160px, 1fr))',
                },
                gap: { xs: 1, sm: 1.5 },
              }}
            >
              {list.slice(0, shown).map((s) => (
                <FinishCard
                  key={finishKey(s)}
                  skin={s}
                  name={finishName(s, t)}
                  on={selected === finishKey(s)}
                  equipped={equippedName(s)}
                  onClick={() => onPick(s)}
                />
              ))}
            </Box>
          )}
          {list.length > shown && (
            <Button
              variant="outlined"
              onClick={() => setShown((n) => n + PAGE)}
              sx={{ alignSelf: 'center', borderRadius: radii.pill }}
            >
              {t('skins.free.showMore', { count: list.length - shown })}
            </Button>
          )}
        </>
      )}
    </Box>
  );
}

function Chip({
  on,
  dot,
  onClick,
  children,
}: {
  on: boolean;
  dot: string | null;
  onClick: () => void;
  children: string;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      sx={{
        flexShrink: 0,
        gap: 1,
        height: { xs: 40, sm: 36 },
        px: 1.75,
        whiteSpace: 'nowrap',
        borderRadius: radii.pill,
        fontSize: '0.8125rem',
        fontWeight: on ? 600 : 400,
        border: `1px solid ${on ? color.ink : color.rule}`,
        bgcolor: on ? color.ink : 'transparent',
        color: on ? color.accentInk : color.ink2,
      }}
    >
      {dot && (
        <Box
          component="span"
          aria-hidden
          sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dot }}
        />
      )}
      {children}
    </ButtonBase>
  );
}

function FinishCard({
  skin,
  name,
  on,
  equipped,
  onClick,
}: {
  skin: FreeCatalogSkin;
  name: string;
  on: boolean;
  equipped: boolean;
  onClick: () => void;
}) {
  const { t } = useModuleTranslation('cs2');
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      data-testid="arsenal-finish"
      aria-label={`${skin.weaponName} | ${name}`}
      sx={{
        position: 'relative',
        flexDirection: 'column',
        alignItems: 'stretch',
        overflow: 'hidden',
        borderRadius: '16px',
        textAlign: 'left',
        bgcolor: color.paper2,
        border: `2px solid ${on ? color.accent : color.rule}`,
        boxShadow: on ? `0 0 0 4px ${withAlpha(color.accent, 0.18)}` : 'none',
        '&:focus-visible': { outline: `2px solid ${color.focus}`, outlineOffset: 3 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          height: 104,
          [SHORT_SCREEN]: { height: 88 },
          bgcolor: color.paper3,
        }}
      >
        <SlotThumb src={skinCardUrl(skin.image)} width="86%" height={88} />
        {equipped && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              px: 1,
              py: '2px',
              borderRadius: radii.pill,
              bgcolor: withAlpha(color.paper, 0.85),
              border: `1px solid ${color.rule}`,
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}
          >
            {t('skins.equipped')}
          </Box>
        )}
      </Box>
      <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }} noWrap>
          {name}
        </Typography>
        <Typography
          sx={{ fontSize: '0.75rem', color: skin.vanilla ? color.muted : rarityColor[skin.rarity] }}
          noWrap
        >
          {skin.vanilla ? t('skins.arsenal.noFinish') : t(`skins.rarity.${skin.rarity}`)}
        </Typography>
      </Box>
      <Box
        aria-hidden
        sx={{ height: 3, bgcolor: skin.vanilla ? color.rule : rarityColor[skin.rarity] }}
      />
    </ButtonBase>
  );
}

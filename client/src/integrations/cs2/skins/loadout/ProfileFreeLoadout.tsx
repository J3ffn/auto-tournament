import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { api, radii, tokens, useModuleTranslation, withAlpha } from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { rarityColor } from '../rarity';
import { useFreeAgents, useFreeCatalog } from '../freeSkins';
import { equippedFor } from '../loadoutSides';
import { skinPaths } from '../paths';
import type { OwnedSkin } from '../useSkins';
import { LoadoutDot, loadoutName } from './LoadoutMenu';
import { COLUMNS, SIDE_COLOR, SIDE_TEXT, type Column, type Layout, type Side } from './model';
import { AgentFigure, finishOf, groupLabel, panel, sideName } from './parts';
import { WeaponSlot, type SlotLook } from './WeaponSlot';

const { color } = tokens;

/** What a profile gets about the loadout (api: GET /api/skins/players/:steamId, free mode). */
export interface ProfileLoadoutInfo {
  show: boolean;
  name: string;
  color: string | null;
  layout: Layout;
  agents: { ct: string | null; t: string | null };
}

/**
 * Fork (free mode): the loadout on a profile, as the Loadout tab shows it.
 * One side at a time (CT or TR), the agent, knife and gloves big, and the
 * three columns. The owner gets "Edit" and the switch that hides it.
 */
export function ProfileFreeLoadout({
  info,
  inventory,
  isOwn,
  onInspect,
}: {
  info: ProfileLoadoutInfo;
  inventory: OwnedSkin[];
  isOwn: boolean;
  onInspect: (skinId: number) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const [side, setSide] = useState<Side>(3);
  const [show, setShow] = useState(info.show);
  const { skins: catalog, defaults } = useFreeCatalog(true);
  const { agents } = useFreeAgents(true);
  const on = useMemo(() => equippedFor(inventory, side), [inventory, side]);
  const names = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of catalog ?? []) out[s.weapon] ??= s.weaponName;
    return out;
  }, [catalog]);
  const model = side === 3 ? info.agents.ct : info.agents.t;
  const agent = agents.find((a) => a.model === model) ?? null;

  const look = (slotId: string): { look: SlotLook; skin: OwnedSkin | null } => {
    const skin = on.get(slotId) ?? null;
    const char = slotId === 'knife' || slotId === 'gloves';
    const name = char
      ? t(`skins.v2.slot.${slotId}`)
      : (names[slotId] ?? slotId.replace('weapon_', ''));
    const fallback = char ? defaults[`${slotId}:${side}`] : defaults[slotId];
    if (!skin)
      return {
        skin,
        look: { name, finish: t('skins.v2.default'), image: fallback ?? null, rarity: null },
      };
    const finish = finishOf(skin, t);
    return {
      skin,
      look: {
        name,
        finish: char ? `${skin.weaponName} | ${finish}` : finish,
        image: skinCardUrl(skin.imageUrl),
        rarity: skin.name === 'Vanilla' ? null : rarityColor[skin.rarity],
      },
    };
  };
  const titles: Record<Column, string> = {
    pistol: t('skins.v2.loadout.pistols'),
    mid: t('skins.v2.loadout.mid'),
    rifle: t('skins.v2.loadout.rifles'),
  };

  if (!info.show && !isOwn) return null;
  const tone = SIDE_COLOR[side];
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
      data-testid="profile-free-loadout"
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
        <Box
          role="radiogroup"
          aria-label={t('skins.v2.items.side')}
          sx={{
            display: 'flex',
            gap: '2px',
            p: '3px',
            borderRadius: radii.sm,
            bgcolor: color.paper2,
            border: `1px solid ${withAlpha(color.ink, 0.07)}`,
          }}
        >
          {([3, 2] as const).map((s) => (
            <ButtonBase
              key={s}
              role="radio"
              aria-checked={s === side}
              onClick={() => setSide(s)}
              sx={{
                height: 30,
                px: 1.5,
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                bgcolor: s === side ? SIDE_COLOR[s] : 'transparent',
                color: s === side ? color.paper : color.muted,
              }}
            >
              {sideName(s, t)}
            </ButtonBase>
          ))}
        </Box>
        {info.color && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              height: 26,
              borderRadius: '6px',
              bgcolor: color.paper2,
              fontSize: '0.75rem',
              color: color.ink2,
            }}
          >
            <LoadoutDot tone={info.color} size={8} />
            {t('skins.v2.profile.inUse', { name: loadoutName(info, t) })}
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {isOwn && (
          <>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={show}
                  onChange={(e) => {
                    setShow(e.target.checked);
                    void api
                      .put('/api/skins/me/profile-loadout', { show: e.target.checked })
                      .catch(() => setShow(!e.target.checked));
                  }}
                />
              }
              label={t('skins.v2.profile.show')}
              sx={{
                m: 0,
                '& .MuiFormControlLabel-label': { fontSize: '0.8125rem', color: color.ink2 },
              }}
            />
            <Button
              component={RouterLink}
              to={skinPaths.loadout}
              size="small"
              variant="outlined"
              startIcon={<PencilSimpleIcon size={14} />}
              sx={{ borderRadius: radii.sm }}
            >
              {t('skins.v2.profile.edit')}
            </Button>
          </>
        )}
      </Box>
      {isOwn && !show && (
        <Typography sx={{ fontSize: '0.8125rem', color: color.muted }}>
          {t('skins.v2.profile.hidden')}
        </Typography>
      )}
      <Box
        sx={{
          ...panel,
          overflow: 'hidden',
          opacity: isOwn && !show ? 0.5 : 1,
          background: `linear-gradient(${side === 3 ? 90 : 270}deg, ${withAlpha(tone, 0.26)} 0%, ${withAlpha(tone, 0)} 55%), ${color.paper2}`,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '180px minmax(0, 1fr)' },
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 1,
            p: 2,
          }}
        >
          <AgentFigure agent={agent} height={220} />
          <Box
            sx={{
              p: '6px 8px',
              borderRadius: radii.sm,
              bgcolor: withAlpha(color.paper, 0.6),
              borderLeft: `3px solid ${agent?.color ?? withAlpha(color.ink, 0.14)}`,
            }}
          >
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
              {agent?.name ?? t('skins.v2.loadout.defaultAgent')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 1.5, md: 2 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            {(['knife', 'gloves'] as const).map((id) => {
              const x = look(id);
              return (
                <WeaponSlot
                  key={id}
                  slotId={id}
                  look={x.look}
                  selected={false}
                  target={false}
                  sideTone={SIDE_TEXT[side]}
                  label={`${x.look.name}: ${x.look.finish}`}
                  onClick={() => x.skin && onInspect(x.skin.id)}
                />
              );
            })}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {COLUMNS.map((c) => (
              <Box
                key={c}
                sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}
              >
                <Typography component="h3" sx={{ ...groupLabel, color: SIDE_TEXT[side] }}>
                  {titles[c]}
                </Typography>
                {info.layout[side][c].map((w) => {
                  const x = look(w);
                  return (
                    <WeaponSlot
                      key={w}
                      slotId={w}
                      compact
                      look={x.look}
                      selected={false}
                      target={false}
                      sideTone={SIDE_TEXT[side]}
                      label={`${x.look.name}: ${x.look.finish}`}
                      onClick={() => x.skin && onInspect(x.skin.id)}
                    />
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

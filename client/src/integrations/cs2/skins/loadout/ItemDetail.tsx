import { useCallback, useEffect, useState } from 'react';
import { Box, Button, ButtonBase, Collapse, IconButton, Typography } from '@mui/material';
import {
  CaretDownIcon,
  GameControllerIcon,
  MagnifyingGlassPlusIcon,
  SlidersHorizontalIcon,
  StarIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import {
  api,
  apiErrorMessage,
  fontDisplay,
  mono,
  radii,
  tokens,
  useModuleTranslation,
  useSnackbar,
  withAlpha,
} from '../../../../module-sdk';
import { rarityColor } from '../rarity';
import type { FreeCatalogSkin } from '../freeSkins';
import { wearKey, type OwnedSkin } from '../useSkins';
import { Customize } from './Customize';
import { LoadoutDot, loadoutName } from './LoadoutMenu';
import { sidesIn, type SavedLoadout, type Side } from './model';
import { SideChip, finishOf, panel, sideName, sidesOf } from './parts';
import { Chip, SideSwitch } from './ItemParts';

const { color } = tokens;

interface TryoutServer {
  name: string;
  address: string;
  connectIp: string | null;
  port: number;
}

/** The skin tryout servers online now (Ready Up's Skin tryout set), for "See in game". */
function useTryout() {
  const [servers, setServers] = useState<TryoutServer[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ servers: TryoutServer[] }>('/api/skins/tryout')
      .then((r) => !cancelled && setServers(r.servers ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return servers;
}

/**
 * Fork (free mode): the skin picked in My items. Its picture and details,
 * where it is equipped in the loadout in use (a CT and a TR switch, in the
 * sides' colours), the other loadouts that use it, inspect and see in game,
 * its wear and the rest, the profile star, and remove.
 */
export function ItemDetail({
  skin,
  catalogEntry,
  loadouts,
  starred,
  onEquip,
  onUnequip,
  onStar,
  onRemove,
  onInspect,
  onChanged,
}: {
  skin: OwnedSkin;
  catalogEntry: FreeCatalogSkin | null;
  loadouts: SavedLoadout[];
  starred: boolean;
  onEquip: (side: Side) => void;
  onUnequip: (side: Side) => void;
  onStar: () => void;
  onRemove: (() => void) | null;
  onInspect: () => void;
  onChanged: () => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const { showError } = useSnackbar();
  const [open, setOpen] = useState(false);
  const servers = useTryout();
  const active = loadouts.find((l) => l.active) ?? null;
  const others = loadouts.filter((l) => !l.active && sidesIn(l, skin.id).length > 0);
  const on = sidesOf(skin);
  const tone = rarityColor[skin.rarity];
  const plain = skin.name === 'Vanilla';
  const failed = useCallback(
    (error: unknown) => showError(apiErrorMessage(error, t('skins.free.failed'))),
    [showError, t]
  );
  let hint = t('skins.v2.items.hintPick');
  if (skin.side !== null) hint = t('skins.v2.items.hintOneSide', { side: sideName(skin.side, t) });
  else if (on.length === 2) hint = t('skins.v2.items.hintBoth');

  const server = servers[0];
  return (
    <Box
      component="aside"
      aria-labelledby="item-name"
      data-testid="item-detail"
      sx={{ ...panel, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Box
        sx={{
          position: 'relative',
          height: { xs: 160, md: 180 },
          display: 'grid',
          placeItems: 'center',
          bgcolor: color.paper,
          borderBottom: `2px solid ${tone}`,
        }}
      >
        <Box
          component="img"
          src={skin.imageUrl}
          alt=""
          sx={{ maxWidth: '86%', maxHeight: '86%', objectFit: 'contain' }}
        />
        <IconButton
          onClick={onInspect}
          aria-label={t('skins.v2.items.inspect')}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 36,
            height: 36,
            borderRadius: '6px',
            bgcolor: withAlpha(color.paper, 0.8),
            border: `1px solid ${withAlpha(color.ink, 0.1)}`,
          }}
        >
          <MagnifyingGlassPlusIcon size={16} />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: '16px 18px 18px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>
            {skin.stattrak !== null ? `${t('skins.stattrak')} ` : ''}
            {skin.weaponName}
          </Typography>
          <Typography
            id="item-name"
            component="h2"
            sx={{
              fontFamily: fontDisplay,
              fontSize: '1.375rem',
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {finishOf(skin, t)}
          </Typography>
          {!plain && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, fontSize: '0.75rem' }}>
              <Chip tone={tone} tint={withAlpha(tone, 0.15)}>
                {t(`skins.rarity.${skin.rarity}`)}
              </Chip>
              <Chip>
                {t(`skins.wear.${wearKey(skin.float)}`)} ·{' '}
                <Box component="span" sx={mono}>
                  {skin.float.toFixed(4)}
                </Box>
              </Chip>
              <Chip>
                <Box component="span" sx={mono}>
                  {t('skins.v2.items.seed', { n: skin.pattern })}
                </Box>
              </Chip>
              {skin.stattrak !== null && (
                <Chip tone="#f0a070" tint="rgba(207,106,50,0.18)">
                  {t('skins.stattrak')}
                </Chip>
              )}
              {skin.nametag && <Chip>“{skin.nametag}”</Chip>}
            </Box>
          )}
        </Box>

        <Box
          role="group"
          aria-labelledby="item-equip-title"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            p: 1.5,
            borderRadius: '10px',
            bgcolor: color.paper,
            border: `1px solid ${withAlpha(color.ink, 0.07)}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 1,
            }}
          >
            <Typography id="item-equip-title" sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
              {t('skins.v2.items.equippedIn')}
            </Typography>
            {active && (
              <Typography
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  fontSize: '0.75rem',
                  color: color.muted,
                }}
              >
                <LoadoutDot tone={active.color} size={8} />
                {t('skins.v2.items.loadoutName', { name: loadoutName(active, t) })}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            {([3, 2] as const).map((s) => {
              const allowed = skin.side === null || skin.side === s;
              const isOn = on.includes(s);
              return (
                <SideSwitch
                  key={s}
                  side={s}
                  allowed={allowed}
                  on={isOn}
                  onClick={() => (isOn ? onUnequip(s) : onEquip(s))}
                />
              );
            })}
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>{hint}</Typography>
          {others.map((l) => (
            <Box
              key={l.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                pt: 1,
                borderTop: `1px solid ${withAlpha(color.ink, 0.06)}`,
                fontSize: '0.75rem',
                color: color.ink2,
              }}
            >
              <LoadoutDot tone={l.color} size={8} />
              {t('skins.v2.items.alsoIn', { name: loadoutName(l, t) })}
              {sidesIn(l, skin.id).map((s) => (
                <SideChip key={s} side={s} />
              ))}
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: server ? 'repeat(2, minmax(0, 1fr))' : '1fr',
            gap: 0.75,
          }}
        >
          <Button
            variant="outlined"
            onClick={onInspect}
            startIcon={<MagnifyingGlassPlusIcon size={15} />}
            sx={{
              height: 40,
              borderRadius: radii.sm,
              color: color.ink,
              borderColor: withAlpha(color.ink, 0.14),
            }}
          >
            {t('skins.v2.items.inspect')}
          </Button>
          {server && (
            <Button
              variant="outlined"
              component="a"
              href={`steam://connect/${server.connectIp ?? server.address.split(':')[0]}:${server.port}`}
              title={t('skins.v2.items.seeInGameHint', { name: server.name })}
              startIcon={<GameControllerIcon size={15} />}
              sx={{
                height: 40,
                borderRadius: radii.sm,
                color: color.ink,
                borderColor: withAlpha(color.ink, 0.14),
              }}
            >
              {t('skins.v2.items.seeInGame')}
            </Button>
          )}
        </Box>

        {!plain && (
          <Box
            sx={{
              borderRadius: '10px',
              bgcolor: color.paper,
              border: `1px solid ${withAlpha(color.ink, 0.07)}`,
            }}
          >
            <ButtonBase
              onClick={() => setOpen((x) => !x)}
              aria-expanded={open}
              data-testid="item-customize-toggle"
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                gap: 1.25,
                minHeight: 46,
                px: 1.75,
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <SlidersHorizontalIcon size={16} aria-hidden />
              <Box component="span" sx={{ flex: 1, textAlign: 'left' }}>
                {t('skins.v2.items.customize')}
              </Box>
              <CaretDownIcon
                size={14}
                aria-hidden
                style={{
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 160ms',
                }}
              />
            </ButtonBase>
            <Collapse in={open} unmountOnExit>
              <Box sx={{ px: 1.75, pb: 1.75 }}>
                <Customize
                  skin={skin}
                  statTrakOk={catalogEntry?.statTrak ?? skin.stattrak !== null}
                  onSaved={onChanged}
                  onFailed={failed}
                />
              </Box>
            </Collapse>
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            pt: 1.5,
            borderTop: `1px solid ${withAlpha(color.ink, 0.07)}`,
          }}
        >
          <Button
            onClick={onStar}
            aria-pressed={starred}
            data-testid="item-star"
            startIcon={<StarIcon size={15} weight={starred ? 'fill' : 'regular'} />}
            sx={{
              flex: 1,
              justifyContent: 'flex-start',
              height: 38,
              borderRadius: radii.sm,
              color: starred ? color.medalGold : color.ink2,
            }}
          >
            {starred ? t('skins.v2.items.onProfile') : t('skins.v2.items.showOnProfile')}
          </Button>
          {onRemove && (
            <Button
              onClick={onRemove}
              data-testid="item-remove"
              startIcon={<TrashIcon size={15} />}
              sx={{ height: 38, borderRadius: radii.sm, color: color.ban }}
            >
              {t('skins.v2.items.remove')}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

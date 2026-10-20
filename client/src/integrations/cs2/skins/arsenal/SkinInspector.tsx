import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Box, Button, ButtonBase, Slider, Switch, TextField, Typography } from '@mui/material';
import { CrosshairSimpleIcon, DiceFiveIcon } from '@phosphor-icons/react';
import { useModuleTranslation, tokens, fontDisplay, mono, radii } from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { rarityColor } from '../rarity';
import { wearKey, type OwnedSkin } from '../useSkins';
import {
  NAMETAG_MAX,
  customOf,
  freshCustom,
  type FreeAgent,
  type FreeCatalogSkin,
  type FreeCustom,
} from '../freeSkins';
import { AgentPicture } from './SlotCatalog';
import type { Side } from './slots';
import { finishName } from './useArsenal';

const { color } = tokens;

/** What the panel shows: a finish to set up, the slot's default look, or an agent. */
export type InspectTarget =
  | { kind: 'finish'; skin: FreeCatalogSkin; copy: OwnedSkin | null; equipped: boolean }
  | { kind: 'default'; label: string; image: string | null; equipped: OwnedSkin | null }
  | { kind: 'agent'; agent: FreeAgent | null; current: boolean };

/** CS2's wear ranges, with the float each one's button sets. */
const WEARS = [
  { key: 'fn', from: 0, to: 0.07, set: 0.01, tone: '#3a7d2c' },
  { key: 'mw', from: 0.07, to: 0.15, set: 0.1, tone: '#5a9f32' },
  { key: 'ft', from: 0.15, to: 0.38, set: 0.25, tone: '#8fa83a' },
  { key: 'ww', from: 0.38, to: 0.45, set: 0.41, tone: '#c46a62' },
  { key: 'bs', from: 0.45, to: 1, set: 0.6, tone: '#d63c34' },
] as const;

/**
 * Fork (free mode): the panel beside the list. Set up the picked finish (wear,
 * pattern, StatTrak, name tag) and equip it on this side or both; or go back
 * to the game's default look; or pick an agent.
 */
export function SkinInspector({
  target,
  side,
  canBoth,
  busy,
  onEquip,
  onDefault,
  onAgent,
}: {
  target: InspectTarget;
  side: Side;
  /** Both sides use this slot: offer "Equip on both". */
  canBoth: boolean;
  busy: boolean;
  onEquip: (custom: FreeCustom, team: 0 | Side) => void;
  /** Take what is on this side off: the game's default look comes back. */
  onDefault: () => void;
  onAgent: (model: string | null) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const [custom, setCustom] = useState<FreeCustom>(freshCustom);
  const key =
    target.kind === 'finish'
      ? `${target.skin.weapon}|${target.skin.paintKit}|${target.copy?.id ?? ''}`
      : target.kind;
  useEffect(() => {
    if (target.kind === 'finish') setCustom(target.copy ? customOf(target.copy) : freshCustom());
    // Only a new finish (or copy) starts over; equipping keeps what was set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (patch: Partial<FreeCustom>) => setCustom((c) => ({ ...c, ...patch }));
  const sideName = side === 3 ? t('skins.side.ct') : t('skins.side.t');

  if (target.kind === 'agent') {
    return (
      <Panel>
        <AgentPicture agent={target.agent} height={200} />
        <Title
          over={t('skins.arsenal.slot.agent')}
          name={target.agent?.name ?? t('skins.free.defaultAgent')}
        />
        <Button
          variant="contained"
          disabled={busy || target.current}
          onClick={() => onAgent(target.agent?.model ?? null)}
          data-testid="arsenal-equip"
          sx={{ height: 48, borderRadius: radii.pill, fontWeight: 700 }}
        >
          {target.current
            ? t('skins.arsenal.inUse')
            : t('skins.arsenal.equipOn', { side: sideName })}
        </Button>
      </Panel>
    );
  }

  if (target.kind === 'default') {
    return (
      <Panel>
        <Stage image={target.image} tone={color.rule} />
        <Title over={target.label} name={t('skins.arsenal.default')} />
        <Typography sx={{ fontSize: '0.875rem', color: color.ink2 }}>
          {t('skins.arsenal.defaultHint')}
        </Typography>
        {target.equipped && (
          <Button
            variant="outlined"
            disabled={busy}
            onClick={onDefault}
            data-testid="arsenal-default"
            sx={{ height: 44, borderRadius: radii.pill }}
          >
            {t('skins.arsenal.useDefault', { side: sideName })}
          </Button>
        )}
      </Panel>
    );
  }

  const skin = target.skin;
  const plain = Boolean(skin.vanilla);
  const statTrakOk = skin.statTrak && !plain;
  const nametagOk = skin.slot !== 'gloves' && !plain;
  const wear = WEARS.find((w) => custom.float >= w.from && custom.float < w.to) ?? WEARS[4];
  const image = target.copy?.imageUrl && !plain ? target.copy.imageUrl : skin.image;

  return (
    <Panel>
      <Stage
        image={image}
        tone={plain ? color.rule : rarityColor[skin.rarity]}
        nametag={nametagOk ? custom.nametag.trim() : ''}
      />
      <Title
        over={`${custom.stattrak && statTrakOk ? `${t('skins.stattrak')} ` : ''}${skin.weaponName}`}
        name={finishName(skin, t)}
        rarity={
          plain ? null : { label: t(`skins.rarity.${skin.rarity}`), tone: rarityColor[skin.rarity] }
        }
      />

      {plain ? (
        <Typography sx={{ fontSize: '0.875rem', color: color.ink2 }}>
          {t('skins.arsenal.plainHint')}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                {t('skins.free.wear')}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: color.ink2 }}>
                {t(`skins.wear.${wearKey(custom.float)}`)}
              </Typography>
            </Box>
            <Box
              role="group"
              aria-label={t('skins.free.wear')}
              sx={{
                display: 'flex',
                height: 36,
                gap: '2px',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              {WEARS.map((w) => {
                const on = w.key === wear.key;
                return (
                  <ButtonBase
                    key={w.key}
                    onClick={() => set({ float: w.set })}
                    aria-pressed={on}
                    aria-label={t(`skins.wear.${w.key}`)}
                    title={t(`skins.wear.${w.key}`)}
                    data-testid={`arsenal-wear-${w.key}`}
                    sx={{
                      flex: `${Math.max(0.09, w.to - w.from)} 1 0`,
                      ...mono,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#fff',
                      bgcolor: w.tone,
                      opacity: on ? 1 : 0.45,
                      boxShadow: on ? `inset 0 0 0 2px ${color.ink}` : 'none',
                    }}
                  >
                    {w.key.toUpperCase()}
                  </ButtonBase>
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Slider
                value={custom.float}
                min={0}
                max={1}
                step={0.0001}
                onChange={(_e, v) => set({ float: Number(v) })}
                aria-label={t('skins.free.float')}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                type="number"
                value={custom.float}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) set({ float: Math.max(0, Math.min(1, n)) });
                }}
                inputProps={{
                  min: 0,
                  max: 1,
                  step: 0.0001,
                  'aria-label': t('skins.free.float'),
                  'data-testid': 'arsenal-float',
                }}
                sx={{ width: 112 }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              type="number"
              label={t('skins.free.pattern')}
              value={custom.pattern}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) set({ pattern: Math.max(0, Math.min(1000, n)) });
              }}
              inputProps={{ min: 0, max: 1000, step: 1, 'data-testid': 'arsenal-pattern' }}
              helperText={t('skins.free.patternHelp')}
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              onClick={() => set({ pattern: Math.floor(Math.random() * 1001) })}
              aria-label={t('skins.free.random')}
              sx={{ minWidth: 44, height: 40, borderRadius: '10px' }}
            >
              <DiceFiveIcon size={18} />
            </Button>
          </Box>

          {statTrakOk && (
            <Box
              component="label"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                p: '10px 14px',
                borderRadius: '12px',
                bgcolor: color.paper,
                border: `1px solid ${custom.stattrak ? color.accent : color.rule}`,
                cursor: 'pointer',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  {t('skins.stattrak')}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>
                  {t('skins.arsenal.stattrakHint')}
                </Typography>
              </Box>
              <Switch
                checked={custom.stattrak}
                onChange={(e) => set({ stattrak: e.target.checked })}
                slotProps={{
                  input: {
                    'data-testid': 'arsenal-stattrak',
                  } as InputHTMLAttributes<HTMLInputElement>,
                }}
              />
            </Box>
          )}

          {nametagOk && (
            <TextField
              size="small"
              label={t('skins.free.nametag')}
              value={custom.nametag}
              onChange={(e) => set({ nametag: [...e.target.value].slice(0, NAMETAG_MAX).join('') })}
              helperText={`${[...custom.nametag].length}/${NAMETAG_MAX}`}
              inputProps={{ 'data-testid': 'arsenal-nametag' }}
            />
          )}
        </>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          disabled={busy}
          onClick={() => onEquip(custom, side)}
          data-testid="arsenal-equip"
          sx={{ height: 48, borderRadius: radii.pill, fontWeight: 700, gap: 1.25 }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: side === 3 ? color.sideCt : color.sideT,
              boxShadow: `0 0 0 2px ${color.accentInk}`,
            }}
          />
          {target.equipped
            ? t('skins.arsenal.save')
            : t('skins.arsenal.equipOn', { side: sideName })}
        </Button>
        {canBoth && (
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => onEquip(custom, 0)}
            data-testid="arsenal-equip-both"
            sx={{ height: 44, borderRadius: radii.pill }}
          >
            {t('skins.arsenal.equipBoth')}
          </Button>
        )}
        {target.equipped && (
          <Button
            disabled={busy}
            onClick={onDefault}
            data-testid="arsenal-default"
            sx={{ height: 40, borderRadius: radii.pill, color: color.ink2 }}
          >
            {t('skins.arsenal.useDefault', { side: sideName })}
          </Button>
        )}
      </Box>
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <Box
      component="aside"
      data-testid="arsenal-inspector"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
        p: 2.5,
        borderRadius: '20px',
        bgcolor: color.paper2,
        border: `1px solid ${color.rule}`,
        position: { md: 'sticky' },
        top: { md: 24 },
      }}
    >
      {children}
    </Box>
  );
}

function Stage({
  image,
  tone,
  nametag = '',
}: {
  image: string | null;
  tone: string;
  nametag?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        height: 200,
        borderRadius: '14px',
        bgcolor: color.paper3,
        borderBottom: `3px solid ${tone}`,
      }}
    >
      {image && broken !== image ? (
        <Box
          component="img"
          src={image}
          alt=""
          // The full-size picture comes on demand; the card size ships with the module.
          onError={(e: SyntheticEvent<HTMLImageElement>) => {
            const small = skinCardUrl(image);
            if (e.currentTarget.src !== new URL(small, window.location.href).href)
              e.currentTarget.src = small;
            else setBroken(image);
          }}
          sx={{ width: '100%', maxHeight: 180, objectFit: 'contain' }}
        />
      ) : (
        <CrosshairSimpleIcon size={64} color={color.muted} aria-hidden />
      )}
      {nametag && (
        <Typography
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 10,
            textAlign: 'center',
            ...mono,
            fontSize: '0.8125rem',
            color: color.ink2,
          }}
        >
          “{nametag}”
        </Typography>
      )}
    </Box>
  );
}

function Title({
  over,
  name,
  rarity,
}: {
  over: string;
  name: string;
  rarity?: { label: string; tone: string } | null;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography sx={{ fontSize: '0.8125rem', color: color.muted }}>{over}</Typography>
      <Typography
        component="h2"
        sx={{
          fontFamily: fontDisplay,
          fontSize: '1.625rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
        }}
      >
        {name}
      </Typography>
      {rarity && (
        <Box
          component="span"
          sx={{
            alignSelf: 'flex-start',
            px: 1.25,
            py: '3px',
            borderRadius: radii.pill,
            ...mono,
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: rarity.tone,
            bgcolor: `${rarity.tone}22`,
          }}
        >
          {rarity.label}
        </Box>
      )}
    </Box>
  );
}

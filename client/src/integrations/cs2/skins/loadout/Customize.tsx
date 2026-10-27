import { useEffect, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Slider, Switch, TextField, Typography } from '@mui/material';
import { DiceFiveIcon } from '@phosphor-icons/react';
import { mono, radii, tokens, useModuleTranslation } from '../../../../module-sdk';
import { NAMETAG_MAX, customOf, editSkin, type FreeCustom } from '../freeSkins';
import { wearKey, type OwnedSkin } from '../useSkins';

const { color } = tokens;

/** CS2's wear ranges, with the float each one's button sets. */
export const WEARS = [
  { key: 'fn', from: 0, to: 0.07, set: 0.01, tone: '#3a7d2c' },
  { key: 'mw', from: 0.07, to: 0.15, set: 0.1, tone: '#5a9f32' },
  { key: 'ft', from: 0.15, to: 0.38, set: 0.25, tone: '#8fa83a' },
  { key: 'ww', from: 0.38, to: 0.45, set: 0.41, tone: '#c46a62' },
  { key: 'bs', from: 0.45, to: 1, set: 0.6, tone: '#d63c34' },
] as const;

/**
 * Fork (free mode): wear, pattern, StatTrak and name tag of one of the
 * player's skins. Saved by itself a moment after the last change; it counts
 * in every loadout using the skin.
 */
export function Customize({
  skin,
  statTrakOk,
  onSaved,
  onFailed,
}: {
  skin: OwnedSkin;
  statTrakOk: boolean;
  onSaved: () => void;
  onFailed: (error: unknown) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const [custom, setCustom] = useState<FreeCustom>(() => customOf(skin));
  const [dirty, setDirty] = useState(false);
  const timer = useRef<number | null>(null);
  const nametagOk = skin.slot !== 'gloves';

  useEffect(() => {
    setCustom(customOf(skin));
    setDirty(false);
    // A new skin starts from its own values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skin.id]);

  useEffect(() => {
    if (!dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setDirty(false);
      editSkin(skin.id, custom).then(onSaved, onFailed);
    }, 700);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [custom, dirty, skin.id, onSaved, onFailed]);

  const set = (patch: Partial<FreeCustom>) => {
    setCustom((c) => ({ ...c, ...patch }));
    setDirty(true);
  };
  const wear = WEARS.find((w) => custom.float >= w.from && custom.float < w.to) ?? WEARS[4];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }} data-testid="item-customize">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <Typography component="span" sx={{ fontSize: 'inherit', color: color.ink2 }}>
            {t('skins.free.wear')} · {t(`skins.wear.${wearKey(custom.float)}`)}
          </Typography>
          <Typography component="span" sx={{ ...mono, fontSize: 'inherit' }}>
            {custom.float.toFixed(4)}
          </Typography>
        </Box>
        <Box
          role="group"
          aria-label={t('skins.free.wear')}
          sx={{ display: 'flex', gap: '2px', height: 28, borderRadius: '6px', overflow: 'hidden' }}
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
                data-testid={`item-wear-${w.key}`}
                sx={{
                  flex: `${Math.max(0.09, w.to - w.from)} 1 0`,
                  minWidth: 32,
                  ...mono,
                  fontSize: '0.6875rem',
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
        <Slider
          size="small"
          value={custom.float}
          min={0}
          max={1}
          step={0.0001}
          onChange={(_e, v) => set({ float: Number(v) })}
          aria-label={t('skins.free.float')}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          size="small"
          type="number"
          label={t('skins.free.pattern')}
          value={custom.pattern}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) set({ pattern: Math.max(0, Math.min(1000, n)) });
          }}
          inputProps={{ min: 0, max: 1000, step: 1, 'data-testid': 'item-pattern' }}
          sx={{ flex: 1 }}
        />
        <Button
          variant="outlined"
          onClick={() => set({ pattern: Math.floor(Math.random() * 1001) })}
          aria-label={t('skins.free.random')}
          sx={{ minWidth: 42, height: 40, borderRadius: radii.sm }}
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
            gap: 1,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          <Switch
            size="small"
            checked={custom.stattrak}
            onChange={(e) => set({ stattrak: e.target.checked })}
            inputProps={{ 'aria-label': t('skins.stattrak') }}
          />
          {t('skins.stattrak')}
        </Box>
      )}
      {nametagOk && (
        <TextField
          size="small"
          label={t('skins.free.nametag')}
          value={custom.nametag}
          onChange={(e) => set({ nametag: [...e.target.value].slice(0, NAMETAG_MAX).join('') })}
          placeholder={t('skins.v2.optional')}
          inputProps={{ maxLength: NAMETAG_MAX }}
        />
      )}
      <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>
        {t('skins.v2.items.savesItself')}
      </Typography>
    </Box>
  );
}

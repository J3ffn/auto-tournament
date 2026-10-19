import { useEffect, useState, type InputHTMLAttributes, type SyntheticEvent } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DiceFiveIcon, XIcon } from '@phosphor-icons/react';
import {
  useModuleTranslation,
  useSnackbar,
  tokens,
  fontDisplay,
  radii,
  withAlpha,
  dialogPaperSx,
} from '../../../module-sdk';
import { WearBar, skinCardUrl } from './SkinParts';
import { rarityColor } from './rarity';
import { wearKey, type OwnedSkin } from './useSkins';
import type { LoadoutTeam } from './loadoutSides';
import {
  NAMETAG_MAX,
  WEAR_PRESETS,
  customOf,
  editSkin,
  freeSkinName,
  freshCustom,
  pickFree,
  removeFreeSkin,
  type FreeCatalogSkin,
  type FreeCustom,
} from './freeSkins';

/** What the editor works on: a finish from the catalogue, or a skin the player owns. */
export type EditorTarget =
  | { kind: 'catalog'; skin: FreeCatalogSkin; existing?: OwnedSkin }
  | { kind: 'owned'; skin: OwnedSkin };

const { color } = tokens;

/**
 * Fork (free mode): set up a skin, then equip it. The float (slider, number
 * and a button per wear), the pattern, StatTrak and a name tag; then Equip on
 * CT, T or both (a weapon only one side buys has one Equip). On an owned skin
 * also Save, Take off, and Remove for a picked one.
 */
export function FreeSkinEditor({
  target,
  onClose,
  onEquipOwned,
  onTakeOffOwned,
}: {
  target: EditorTarget | null;
  onClose: () => void;
  /** Equip an owned skin on a side (the inventory's own equip, so the grid updates at once). */
  onEquipOwned: (skin: OwnedSkin, team: LoadoutTeam) => Promise<void>;
  /** Take an owned skin off every side it is on. */
  onTakeOffOwned: (skin: OwnedSkin) => Promise<void>;
}) {
  const { t } = useModuleTranslation('cs2');
  const { showError, showSuccess } = useSnackbar();
  const [custom, setCustom] = useState<FreeCustom>(freshCustom);
  const [busy, setBusy] = useState(false);

  // A new target starts from what it is set to now (or what the player's copy of it is).
  useEffect(() => {
    if (!target) return;
    if (target.kind === 'owned') setCustom(customOf(target.skin));
    else setCustom(target.existing ? customOf(target.existing) : freshCustom());
  }, [target]);

  if (!target) return null;
  const skin = target.skin;
  const name = target.kind === 'catalog' ? freeSkinName(target.skin) : target.skin.name;
  const image = target.kind === 'catalog' ? target.skin.image : target.skin.imageUrl;
  const slot = skin.slot;
  const statTrakOk = slot !== 'gloves';
  const nametagOk = slot !== 'gloves';
  const owned = target.kind === 'owned' ? target.skin : (target.existing ?? null);
  const set = (patch: Partial<FreeCustom>) => setCustom((c) => ({ ...c, ...patch }));

  const run = async (work: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await work();
      if (done) showSuccess(done);
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : t('skins.free.failed'));
    } finally {
      setBusy(false);
    }
  };

  const equip = (team: LoadoutTeam) =>
    run(
      async () => {
        if (target.kind === 'catalog') {
          await pickFree(target.skin, custom, team);
        } else {
          await editSkin(target.skin.id, custom);
          await onEquipOwned(target.skin, team);
        }
      },
      t('skins.free.equipped', { name: `${skin.weaponName} | ${name}` })
    );

  const sides: Array<{ team: LoadoutTeam; label: string; id: string }> =
    skin.side === null
      ? [
          { team: 3, label: t('skins.equipOnCt'), id: 'ct' },
          { team: 2, label: t('skins.equipOnT'), id: 't' },
          { team: 0, label: t('skins.equipOnBoth'), id: 'both' },
        ]
      : [{ team: 0, label: t('skins.free.equip'), id: 'one' }];

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="free-editor-title"
      PaperProps={{ sx: { ...dialogPaperSx, overflow: 'hidden' } }}
    >
      <Box
        data-testid="free-skin-editor"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) minmax(0,1.1fr)' },
        }}
      >
        <Box
          sx={{
            bgcolor: color.paper3,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            p: { xs: 3, md: 4 },
            gap: 2,
            borderBottom: `4px solid ${rarityColor[skin.rarity]}`,
          }}
        >
          <Box
            component="img"
            src={image}
            alt={`${skin.weaponName} ${name}`}
            // The full-size picture is fetched on demand; the card size is bundled with the module.
            onError={(e: SyntheticEvent<HTMLImageElement>) => {
              const small = skinCardUrl(image);
              if (e.currentTarget.src !== new URL(small, window.location.href).href)
                e.currentTarget.src = small;
            }}
            sx={{ width: '100%', maxHeight: 240, objectFit: 'contain' }}
          />
          {custom.nametag.trim() && nametagOk && (
            <Typography sx={{ textAlign: 'center', fontStyle: 'italic', color: color.ink2 }}>
              “{custom.nametag.trim()}”
            </Typography>
          )}
        </Box>
        <Box sx={{ p: { xs: 2.5, md: 3.5 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: color.muted, fontSize: '0.875rem' }}>
                {custom.stattrak && statTrakOk && (
                  <Box component="span" sx={{ color: color.accent }}>
                    {t('skins.stattrak')}{' '}
                  </Box>
                )}
                {skin.weaponName}
              </Typography>
              <Typography
                id="free-editor-title"
                component="h2"
                sx={{ fontFamily: fontDisplay, fontSize: '1.625rem', fontWeight: 700 }}
              >
                {name}
              </Typography>
            </Box>
            <IconButton
              aria-label={t('common.close')}
              onClick={onClose}
              disabled={busy}
              sx={{ border: `1px solid ${color.rule}`, alignSelf: 'flex-start' }}
            >
              <XIcon size={16} />
            </IconButton>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 600, mb: 0.75 }}>
              {t('skins.free.wear')} · {t(`skins.wear.${wearKey(custom.float)}`)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.25 }}>
              {WEAR_PRESETS.map((p) => {
                const on = wearKey(custom.float) === p.key;
                return (
                  <ButtonBase
                    key={p.key}
                    onClick={() => set({ float: p.float })}
                    aria-pressed={on}
                    data-testid={`free-wear-${p.key}`}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: radii.pill,
                      fontSize: '0.8125rem',
                      border: `1px solid ${on ? color.accent : color.rule}`,
                      bgcolor: on ? withAlpha(color.accent, 0.12) : 'transparent',
                      color: on ? color.accent : color.ink2,
                    }}
                  >
                    {t(`skins.wear.${p.key}`)}
                  </ButtonBase>
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
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
                  'data-testid': 'free-float',
                }}
                sx={{ width: 130 }}
              />
            </Box>
            <WearBar float={custom.float} pattern={custom.pattern} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              type="number"
              label={t('skins.free.pattern')}
              value={custom.pattern}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) set({ pattern: Math.max(0, Math.min(1000, n)) });
              }}
              inputProps={{ min: 0, max: 1000, step: 1, 'data-testid': 'free-pattern' }}
              helperText={t('skins.free.patternHelp')}
              sx={{ width: 180 }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<DiceFiveIcon size={16} />}
              onClick={() => set({ pattern: Math.floor(Math.random() * 1001) })}
              sx={{ borderRadius: radii.pill, mb: 3 }}
            >
              {t('skins.free.random')}
            </Button>
          </Box>

          {statTrakOk && (
            <Box
              component="label"
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography>{t('skins.stattrak')}</Typography>
              <Switch
                checked={custom.stattrak}
                onChange={(e) => set({ stattrak: e.target.checked })}
                slotProps={{
                  input: {
                    'data-testid': 'free-stattrak',
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
              inputProps={{ 'data-testid': 'free-nametag' }}
            />
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            {sides.map((s) => (
              <Button
                key={s.id}
                variant="contained"
                disabled={busy}
                onClick={() => void equip(s.team)}
                data-testid={`free-equip-${s.id}`}
                sx={{ borderRadius: radii.pill, flex: '1 1 140px' }}
              >
                {s.label}
              </Button>
            ))}
          </Box>
          {target.kind === 'owned' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                disabled={busy}
                onClick={() =>
                  void run(() => editSkin(target.skin.id, custom), t('skins.free.saved'))
                }
                data-testid="free-save"
                sx={{ borderRadius: radii.pill }}
              >
                {t('skins.free.save')}
              </Button>
              {target.skin.equipped && (
                <Button
                  disabled={busy}
                  onClick={() => void run(() => onTakeOffOwned(target.skin))}
                  sx={{ borderRadius: radii.pill, color: color.ink2 }}
                >
                  {t('skins.takeOff')}
                </Button>
              )}
              {target.skin.source === 'free' && (
                <Button
                  disabled={busy}
                  color="error"
                  onClick={() => void run(() => removeFreeSkin(target.skin.id))}
                  data-testid="free-remove"
                  sx={{ borderRadius: radii.pill, ml: 'auto' }}
                >
                  {t('skins.free.remove')}
                </Button>
              )}
            </Box>
          )}
          {owned && target.kind === 'catalog' && (
            <Typography sx={{ fontSize: '0.8125rem', color: color.muted }}>
              {t('skins.free.alreadyPicked')}
            </Typography>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

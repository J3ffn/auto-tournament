import { useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  Divider,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { CaretDownIcon, CheckIcon, PlusIcon } from '@phosphor-icons/react';
import {
  ConfirmDialog,
  apiErrorMessage,
  dialogPaperSx,
  fontDisplay,
  radii,
  tokens,
  useModuleTranslation,
  useSnackbar,
  withAlpha,
} from '../../../../module-sdk';
import type { Loadouts } from './useLoadouts';
import type { SavedLoadout } from './model';

const { color } = tokens;

/** A saved loadout's name as shown: the first one, never named, is "Main". */
export function loadoutName(l: Pick<SavedLoadout, 'name'>, t: (key: string) => string): string {
  return l.name || t('skins.v2.menu.main');
}

/** A loadout's colour dot. */
export function LoadoutDot({ tone, size = 10 }: { tone: string; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ width: size, height: size, borderRadius: '3px', bgcolor: tone, flexShrink: 0 }}
    />
  );
}

/**
 * Fork (free mode): the saved loadouts button ("Loadout: Blue ▾"). Switch to
 * another, make a new one (a copy of this one or empty), rename or recolour
 * this one, or throw it away.
 */
export function LoadoutMenu({ loadouts }: { loadouts: Loadouts }) {
  const { t } = useModuleTranslation('cs2');
  const { showError, showSuccess } = useSnackbar();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<'new' | 'edit' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const { state, active } = loadouts;
  if (!state || !active) return null;

  const run = async (work: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await work();
      setDialog(null);
      if (done) showSuccess(done);
    } catch (error) {
      showError(apiErrorMessage(error, t('skins.free.failed')));
    } finally {
      setBusy(false);
    }
  };
  const close = () => setAnchor(null);

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        data-testid="loadout-menu"
        sx={{
          gap: 1,
          height: 40,
          px: 1.75,
          borderRadius: radii.sm,
          border: `1px solid ${withAlpha(color.ink, 0.14)}`,
          bgcolor: color.paper2,
          color: color.ink,
          fontSize: '0.875rem',
          fontWeight: 600,
          '&:hover': { borderColor: withAlpha(color.ink, 0.28) },
        }}
      >
        <LoadoutDot tone={active.color} />
        {t('skins.v2.menu.button', { name: loadoutName(active, t) })}
        <CaretDownIcon size={14} weight="bold" aria-hidden />
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width: 280,
              borderRadius: '10px',
              bgcolor: color.paper3,
              border: `1px solid ${withAlpha(color.ink, 0.1)}`,
            },
          },
        }}
      >
        <Typography
          sx={{
            px: 2,
            pt: 0.5,
            pb: 0.75,
            fontSize: '0.6875rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: color.muted,
          }}
        >
          {t('skins.v2.menu.yours')}
        </Typography>
        {state.loadouts.map((l) => (
          <MenuItem
            key={l.id}
            role="menuitemradio"
            aria-checked={l.active}
            data-testid="loadout-menu-item"
            onClick={() => {
              close();
              if (!l.active)
                void run(
                  () => loadouts.activate(l.id),
                  t('skins.v2.menu.switched', { name: loadoutName(l, t) })
                );
            }}
            sx={{ gap: 1.25, minHeight: 42 }}
          >
            <LoadoutDot tone={l.color} />
            <Box component="span" sx={{ flex: 1, fontWeight: 600 }}>
              {loadoutName(l, t)}
            </Box>
            <Box component="span" sx={{ fontSize: '0.75rem', color: color.muted }}>
              {t('skins.v2.menu.count', { count: new Set(l.items.map((i) => i.skinId)).size })}
            </Box>
            <Box component="span" sx={{ width: 16, color: color.accent, display: 'flex' }}>
              {l.active && <CheckIcon size={14} weight="bold" aria-hidden />}
            </Box>
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.75 }} />
        <MenuItem
          disabled={state.loadouts.length >= state.max}
          onClick={() => {
            close();
            setDialog('new');
          }}
          data-testid="loadout-new"
          sx={{ gap: 1 }}
        >
          <PlusIcon size={14} aria-hidden />
          {t('skins.v2.menu.new')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            setDialog('edit');
          }}
          sx={{ color: color.ink2 }}
        >
          {t('skins.v2.menu.edit', { name: loadoutName(active, t) })}
        </MenuItem>
        <MenuItem
          disabled={state.loadouts.length < 2}
          onClick={() => {
            close();
            setDialog('delete');
          }}
          sx={{ color: color.ban }}
        >
          {t('skins.v2.menu.delete', { name: loadoutName(active, t) })}
        </MenuItem>
      </Menu>

      {dialog === 'new' && (
        <NewLoadoutDialog
          busy={busy}
          activeName={loadoutName(active, t)}
          suggested={t('skins.v2.menu.suggested', { n: state.loadouts.length + 1 })}
          onClose={() => setDialog(null)}
          onCreate={(name, copy) =>
            void run(() => loadouts.create(name, copy), t('skins.v2.menu.created', { name }))
          }
        />
      )}
      {dialog === 'edit' && (
        <EditLoadoutDialog
          busy={busy}
          name={active.name}
          tone={active.color}
          colors={state.colors}
          onClose={() => setDialog(null)}
          onSave={(name, tone) => void run(() => loadouts.update(active.id, { name, color: tone }))}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('skins.v2.menu.deleteTitle', { name: loadoutName(active, t) })}
        message={t('skins.v2.menu.deleteBody')}
        confirmLabel={t('skins.v2.menu.deleteConfirm')}
        cancelLabel={t('skins.v2.cancel')}
        confirmColor="error"
        loading={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => void run(() => loadouts.remove(active.id))}
      />
    </>
  );
}

function NewLoadoutDialog({
  busy,
  activeName,
  suggested,
  onClose,
  onCreate,
}: {
  busy: boolean;
  activeName: string;
  suggested: string;
  onClose: () => void;
  onCreate: (name: string, copy: boolean) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const [name, setName] = useState(suggested);
  const [copy, setCopy] = useState(true);
  const options = [
    {
      copy: true,
      title: t('skins.v2.menu.copyOf', { name: activeName }),
      sub: t('skins.v2.menu.copyHint'),
    },
    { copy: false, title: t('skins.v2.menu.empty'), sub: t('skins.v2.menu.emptyHint') },
  ];
  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="new-loadout-title"
      PaperProps={{
        sx: { ...dialogPaperSx, borderRadius: '12px', width: 440, maxWidth: 'calc(100% - 32px)' },
      }}
    >
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim(), copy);
        }}
        sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography
          id="new-loadout-title"
          component="h2"
          sx={{ fontFamily: fontDisplay, fontSize: '1.25rem', fontWeight: 700 }}
        >
          {t('skins.v2.menu.newTitle')}
        </Typography>
        <TextField
          label={t('skins.v2.menu.name')}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          autoFocus
          inputProps={{ maxLength: 24, 'data-testid': 'loadout-name' }}
        />
        <Box
          role="radiogroup"
          aria-label={t('skins.v2.menu.startWith')}
          sx={{ display: 'grid', gap: 1 }}
        >
          <Typography sx={{ fontSize: '0.8125rem', color: color.ink2 }}>
            {t('skins.v2.menu.startWith')}
          </Typography>
          {options.map((o) => {
            const on = o.copy === copy;
            return (
              <ButtonBase
                key={String(o.copy)}
                role="radio"
                aria-checked={on}
                onClick={() => setCopy(o.copy)}
                sx={{
                  justifyContent: 'flex-start',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: radii.sm,
                  textAlign: 'left',
                  border: `1px solid ${on ? color.accent : withAlpha(color.ink, 0.1)}`,
                  bgcolor: on ? withAlpha(color.accent, 0.08) : 'transparent',
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `2px solid ${on ? color.accent : color.muted}`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {on && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color.accent }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{o.title}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: color.muted }}>{o.sub}</Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: radii.sm }}>
            {t('skins.v2.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !name.trim()}
            data-testid="loadout-create"
            sx={{ borderRadius: radii.sm }}
          >
            {t('skins.v2.menu.create')}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

function EditLoadoutDialog({
  busy,
  name: startName,
  tone: startTone,
  colors,
  onClose,
  onSave,
}: {
  busy: boolean;
  name: string;
  tone: string;
  colors: string[];
  onClose: () => void;
  onSave: (name: string | undefined, tone: string) => void;
}) {
  const { t } = useModuleTranslation('cs2');
  const [name, setName] = useState(startName || t('skins.v2.menu.main'));
  const [tone, setTone] = useState(startTone);
  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="edit-loadout-title"
      PaperProps={{
        sx: { ...dialogPaperSx, borderRadius: '12px', width: 420, maxWidth: 'calc(100% - 32px)' },
      }}
    >
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim(), tone);
        }}
        sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography
          id="edit-loadout-title"
          component="h2"
          sx={{ fontFamily: fontDisplay, fontSize: '1.25rem', fontWeight: 700 }}
        >
          {t('skins.v2.menu.editTitle')}
        </Typography>
        <TextField
          label={t('skins.v2.menu.name')}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          autoFocus
          inputProps={{ maxLength: 24 }}
        />
        <Box
          role="radiogroup"
          aria-label={t('skins.v2.menu.color')}
          sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
        >
          {colors.map((c) => (
            <ButtonBase
              key={c}
              role="radio"
              aria-checked={c === tone}
              aria-label={c}
              onClick={() => setTone(c)}
              sx={{
                width: 32,
                height: 32,
                borderRadius: radii.sm,
                bgcolor: c,
                boxShadow:
                  c === tone ? `0 0 0 2px ${color.paper2}, 0 0 0 4px ${color.ink}` : 'none',
              }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: radii.sm }}>
            {t('skins.v2.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy || !name.trim()}
            sx={{ borderRadius: radii.sm }}
          >
            {t('skins.v2.save')}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}

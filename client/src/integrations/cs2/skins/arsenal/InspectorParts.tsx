import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { CrosshairSimpleIcon, XIcon } from '@phosphor-icons/react';
import { useModuleTranslation, tokens, fontDisplay, mono, radii } from '../../../../module-sdk';
import { skinCardUrl } from '../SkinParts';
import { SHORT_SCREEN, TINY_SCREEN, thinScroll } from './layout';

const { color } = tokens;

/**
 * Where the panel is: a column beside the list (it never grows past the
 * window), or a drawer (a sheet from the bottom on a phone, a side panel on a
 * medium screen) with a close button. Either way the buttons stay pinned at
 * the bottom and the rest scrolls.
 */
export type InspectMode = 'column' | 'bottom' | 'side';

/** Fork (free mode): the inspector's frame, picture and heading. */
export function Panel({
  mode,
  onClose,
  actions,
  children,
}: {
  mode: InspectMode;
  onClose?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useModuleTranslation('cs2');
  const drawer = mode !== 'column';
  return (
    <Box
      component="aside"
      data-testid="arsenal-inspector"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Shrinks to its box (a sticky column or a drawer); a side drawer is filled.
        flex: mode === 'side' ? '1 1 auto' : '0 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: color.paper2,
        border: mode === 'column' ? `1px solid ${color.rule}` : 'none',
        borderRadius: { column: '20px', bottom: '20px 20px 0 0', side: 0 }[mode],
      }}
    >
      {drawer && (
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexShrink: 0,
            minHeight: 44,
            px: 1,
            pt: 0.5,
          }}
        >
          {mode === 'bottom' && (
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                left: '50%',
                top: 8,
                width: 40,
                height: 4,
                ml: '-20px',
                borderRadius: 2,
                bgcolor: color.rule,
              }}
            />
          )}
          {onClose && (
            <IconButton
              onClick={onClose}
              aria-label={t('skins.close')}
              data-testid="arsenal-close"
              sx={{ width: 40, height: 40 }}
            >
              <XIcon size={18} />
            </IconButton>
          )}
        </Box>
      )}
      <Box
        sx={{
          ...thinScroll,
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2.25,
          px: 2.5,
          pt: drawer ? 0 : 2.5,
          pb: 2.5,
          [SHORT_SCREEN]: { gap: 1.75, px: 2, pb: 2, pt: drawer ? 0 : 2 },
        }}
      >
        {children}
      </Box>
      {actions && (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            px: 2.5,
            pt: 1.5,
            // Clear of the phone's home bar in a bottom sheet.
            pb: mode === 'bottom' ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : 2,
            borderTop: `1px solid ${color.rule}`,
            bgcolor: color.paper2,
            [SHORT_SCREEN]: { px: 2, pt: 1.25 },
            // A landscape phone: the buttons side by side, to leave room for the rest.
            [TINY_SCREEN]: {
              flexDirection: 'row',
              flexWrap: 'wrap',
              '& > *': { flex: '1 1 180px' },
            },
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
}

export function Stage({
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
        flexShrink: 0,
        height: { xs: 170, sm: 200 },
        [SHORT_SCREEN]: { height: 140 },
        [TINY_SCREEN]: { height: 96 },
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
          // Boxed into the stage, whatever its height.
          sx={{
            position: 'absolute',
            inset: '10px',
            width: 'calc(100% - 20px)',
            height: 'calc(100% - 20px)',
            objectFit: 'contain',
          }}
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

export function Title({
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
          [SHORT_SCREEN]: { fontSize: '1.375rem' },
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

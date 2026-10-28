import { useEffect, useState } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { radii, tokens, useModuleTranslation, withAlpha } from '../../../../module-sdk';

const { color } = tokens;

export type CardSize = 's' | 'm' | 'l';

/** Each size: the smallest card width, the picture's height, the name's font size. */
export const CARD_SIZES: Record<
  CardSize,
  { min: number; image: number; name: string; gap: number }
> = {
  s: { min: 118, image: 62, name: '0.75rem', gap: 1 },
  m: { min: 150, image: 88, name: '0.8125rem', gap: 1.25 },
  l: { min: 210, image: 132, name: '0.875rem', gap: 1.5 },
};

const KEY = 'skins.cardSize';
const EVENT = 'skins:card-size';

function read(): CardSize {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 's' || v === 'l' ? v : 'm';
  } catch {
    return 'm';
  }
}

/**
 * Fork (free mode): the size of the skin cards, the same on the catalogue, My
 * items and Add skins. Kept in this browser (a convenience, not an account
 * setting); every open list follows a change.
 */
export function useCardSize(): [CardSize, (size: CardSize) => void] {
  const [size, setSize] = useState<CardSize>(read);
  useEffect(() => {
    const again = () => setSize(read());
    window.addEventListener(EVENT, again);
    return () => window.removeEventListener(EVENT, again);
  }, []);
  const change = (next: CardSize) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Private mode or blocked storage: this page still follows the change.
    }
    setSize(next);
    window.dispatchEvent(new Event(EVENT));
  };
  return [size, change];
}

/** Small, medium, large: three grid icons, the one in use lit. */
export function CardSizeToggle({
  size,
  onChange,
  showLabel = false,
}: {
  size: CardSize;
  onChange: (size: CardSize) => void;
  showLabel?: boolean;
}) {
  const { t } = useModuleTranslation('cs2');
  const options: Array<{ key: CardSize; icon: number }> = [
    { key: 's', icon: 10 },
    { key: 'm', icon: 13 },
    { key: 'l', icon: 16 },
  ];
  return (
    <Box
      role="radiogroup"
      aria-label={t('skins.v2.cardSize.label')}
      data-testid="card-size"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        p: '3px',
        borderRadius: radii.sm,
        bgcolor: color.paper,
        border: `1px solid ${withAlpha(color.ink, 0.07)}`,
      }}
    >
      {showLabel && (
        <Typography
          sx={{
            px: 1,
            fontSize: '0.75rem',
            color: color.muted,
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {t('skins.v2.cardSize.label')}
        </Typography>
      )}
      {options.map((o) => {
        const on = o.key === size;
        return (
          <ButtonBase
            key={o.key}
            role="radio"
            aria-checked={on}
            aria-label={t(`skins.v2.cardSize.${o.key}`)}
            title={t(`skins.v2.cardSize.${o.key}`)}
            onClick={() => onChange(o.key)}
            data-testid={`card-size-${o.key}`}
            sx={{
              width: 34,
              height: 30,
              borderRadius: '6px',
              bgcolor: on ? color.paper3 : 'transparent',
              color: on ? color.ink : color.muted,
              '&:hover': { color: color.ink },
            }}
          >
            <svg width={o.icon} height={o.icon} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

import { useState } from 'react';
import { Box } from '@mui/material';
import { CrosshairSimpleIcon, UserCircleIcon } from '@phosphor-icons/react';
import { tokens } from '../../../../module-sdk';

const { color } = tokens;

/**
 * Fork (free mode): a loadout slot's picture: the equipped skin, else the
 * game's default look. An icon stands in when there is no picture or it does
 * not load (the image cache is offline, say).
 */
export function SlotThumb({
  src,
  agent = false,
  width,
  height,
  dim = false,
}: {
  src: string | null;
  agent?: boolean;
  width: number | string;
  height: number;
  dim?: boolean;
}) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  if (!src || brokenSrc === src) {
    const Icon = agent ? UserCircleIcon : CrosshairSimpleIcon;
    return <Icon size={Math.round(height * 0.55)} color={color.muted} aria-hidden />;
  }
  return (
    <Box
      component="img"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBrokenSrc(src)}
      sx={{ maxWidth: width, maxHeight: height, objectFit: 'contain', opacity: dim ? 0.85 : 1 }}
    />
  );
}

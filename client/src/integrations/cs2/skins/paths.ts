/** The skin pages' URLs (site pages, under core's top bar). */
export const skinPaths = {
  inventory: '/inventory',
  /** Fork (free mode): the loadout, and adding many skins at once. */
  loadout: '/inventory/loadout',
  add: '/inventory/add',
  playerInventory: '/player/:steamId/inventory',
  /** How drops work and their odds, for every player. */
  dropRates: '/inventory/drops',
} as const;

/** `/player/<steamId>/inventory`. */
export const playerInventoryPath = (steamId: string) =>
  `/player/${encodeURIComponent(steamId)}/inventory`;

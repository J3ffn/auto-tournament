/**
 * Fork: free skin mode's routes, under /api/skins (mounted by ./routes.ts).
 * Every one answers 404 while skins or free mode are off.
 *
 * GET    /free/catalog       every finish a player can pick, and each slot's default look
 * GET    /free/img/:kind/:key  a weapon's default look (base) or an agent's picture (agent)
 * GET    /free/agents        the agents per side, and (signed in) the ones you picked
 * POST   /me/free            pick a finish ({ weapon, paintKit, float?, pattern?, stattrak?, nametag?, team?, equip? })
 * PATCH  /me/skins/:id       change one of your skins ({ float?, pattern?, stattrak?, nametag? })
 * DELETE /me/skins/:id       throw away one of your picked skins
 * PUT    /me/agents          set a side's agent ({ team: 2 | 3, model | null })
 * POST   /me/free/bulk       add many finishes at once ({ items: [{ weapon, paintKit }], equipEmpty? })
 * GET    /me/loadouts        saved loadouts, the page's preferences, and whether you are on a server
 * POST   /me/loadouts        a new loadout ({ name, color?, copy? }), switched to at once
 * PATCH  /me/loadouts/:id    rename or recolour one ({ name?, color? })
 * DELETE /me/loadouts/:id    throw one away (never the last)
 * POST   /me/loadouts/:id/activate  switch to it
 * PUT    /me/layout          the weapons each side's loadout shows ({ layout })
 * POST   /me/tips            close a notice for good ({ tip })
 * PUT    /me/profile-loadout whether your profile shows your loadout ({ show })
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../../config/database';
import { log } from '../../../utils/logger';
import { resolveViewerAccount } from '../../../utils/viewerIdentity';
import { AGENTS, freeMode, parseCustom, requireFreeMode } from './freeMode';
import {
  DEFAULT_LAYOUT,
  LOADOUT_COLORS,
  MAX_LOADOUTS,
  POOLS,
  STARTING_PISTOLS,
  loadouts,
  parseLayout,
} from './loadouts';
import freeImages from './freeImages';
import { SkinError } from './skinService';

const router = Router();

// The game's default looks and the agents' pictures (public).
router.use(freeImages);

function fail(res: Response, error: unknown, what: string) {
  if (error instanceof SkinError)
    return res.status(error.status).json({ success: false, error: error.message });
  log.error(`[Skins] ${what} failed`, { error });
  return res.status(500).json({ success: false, error: `${what} failed` });
}

/** The signed-in player's account while free mode is on; otherwise the answer is already sent. */
async function player(req: Request, res: Response): Promise<string | null> {
  await requireFreeMode();
  const viewer = await resolveViewerAccount(req);
  if (!viewer.uid) {
    res.status(401).json({ success: false, error: 'Sign in first' });
    return null;
  }
  if (viewer.isImpersonating) {
    res.status(403).json({ success: false, error: 'Stop impersonating to change a loadout.' });
    return null;
  }
  return viewer.uid;
}

/** A loadout changed: a player on a server right now sees it in game at once. */
async function loadoutChanged(uid: string): Promise<void> {
  const row = await db.queryOneAsync<{ id: string }>('SELECT id FROM players WHERE uid = ?', [uid]);
  if (!row) return;
  const { pushLoadoutLive } = await import('../fleet/push/skins');
  await pushLoadoutLive(row.id);
}

/**
 * @openapi
 * /api/skins/free/catalog:
 *   get:
 *     tags: [Skins]
 *     summary: Every finish a player can pick in free mode (public)
 *     responses:
 *       200: { description: "{ skins: [{ weapon, weaponName, paintKit, name, variant, rarity, slot, side, image, statTrak, vanilla? }], defaults: { <weapon> | knife:2 | knife:3 | gloves:2 | gloves:3: picture url } }" }
 *       404: { description: Skins or free mode are off }
 */
router.get('/free/catalog', async (_req, res) => {
  try {
    await requireFreeMode();
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      skins: await freeMode.catalog(),
      defaults: freeMode.defaults(),
    });
  } catch (error) {
    return fail(res, error, 'Reading the skin list');
  }
});

/**
 * @openapi
 * /api/skins/free/agents:
 *   get:
 *     tags: [Skins]
 *     summary: The agents per side, and the ones the signed-in player picked
 *     responses:
 *       200: { description: "{ agents: [{ team, name, model, image, color }], mine: { ct, t } | null }" }
 *       404: { description: Skins or free mode are off }
 */
router.get('/free/agents', async (req, res) => {
  try {
    await requireFreeMode();
    const viewer = await resolveViewerAccount(req);
    return res.json({
      success: true,
      agents: AGENTS,
      mine: viewer.uid ? await freeMode.myAgents(viewer.uid) : null,
    });
  } catch (error) {
    return fail(res, error, 'Reading the agents');
  }
});

/**
 * @openapi
 * /api/skins/me/free:
 *   post:
 *     tags: [Skins]
 *     summary: Pick any finish (free mode), set it up and equip it
 *     description: One copy per finish per player; picking it again changes that copy. Float and pattern are rolled when left out (a Factory New float).
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [weapon, paintKit]
 *             properties:
 *               weapon: { type: string }
 *               paintKit: { type: integer }
 *               float: { type: number, minimum: 0, maximum: 1 }
 *               pattern: { type: integer, minimum: 0, maximum: 1000 }
 *               stattrak: { type: boolean }
 *               nametag: { type: string, maxLength: 20, nullable: true }
 *               team: { type: integer, enum: [0, 2, 3], description: '0 both sides (default), 2 T, 3 CT' }
 *               equip: { type: boolean, description: 'false: only save it (default true)' }
 *     responses:
 *       200: { description: "{ skinId }" }
 *       400: { description: Not in the catalogue, or a bad value }
 *       404: { description: Skins or free mode are off }
 */
router.post('/me/free', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    const body = req.body ?? {};
    const skinId = await freeMode.pick(
      uid,
      { weapon: body.weapon, paintKit: body.paintKit, team: body.team, equip: body.equip },
      parseCustom(body)
    );
    void loadoutChanged(uid);
    return res.json({ success: true, skinId });
  } catch (error) {
    return fail(res, error, 'Picking a skin');
  }
});

/**
 * @openapi
 * /api/skins/me/skins/{id}:
 *   patch:
 *     tags: [Skins]
 *     summary: Change one of your skins' float, pattern, StatTrak or name tag (free mode)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Changed }
 *       400: { description: A bad value }
 *       404: { description: Not yours, or skins or free mode are off }
 *   delete:
 *     tags: [Skins]
 *     summary: Throw away one of your picked skins (free mode)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Removed }
 *       404: { description: Not one of your picked skins, or skins or free mode are off }
 */
router.patch('/me/skins/:id', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    await freeMode.edit(uid, Number(req.params.id), parseCustom(req.body));
    void loadoutChanged(uid);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, 'Changing a skin');
  }
});

router.delete('/me/skins/:id', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    await freeMode.remove(uid, Number(req.params.id));
    void loadoutChanged(uid);
    return res.json({ success: true });
  } catch (error) {
    return fail(res, error, 'Removing a skin');
  }
});

/**
 * @openapi
 * /api/skins/me/agents:
 *   put:
 *     tags: [Skins]
 *     summary: Set (or clear) your agent for one side (free mode)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team]
 *             properties:
 *               team: { type: integer, enum: [2, 3] }
 *               model: { type: string, nullable: true, description: 'An agent model from /free/agents; null for the default' }
 *     responses:
 *       200: { description: "{ mine: { ct, t } }" }
 *       400: { description: Not an agent of that side }
 *       404: { description: Skins or free mode are off }
 */
router.put('/me/agents', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    await freeMode.setAgent(uid, req.body?.team, req.body?.model ?? null);
    void loadoutChanged(uid);
    return res.json({ success: true, mine: await freeMode.myAgents(uid) });
  } catch (error) {
    return fail(res, error, 'Setting an agent');
  }
});

/** The loadout page's data: saved loadouts, preferences, and whether the player is on a server. */
async function loadoutState(uid: string) {
  const [list, prefs, row] = await Promise.all([
    loadouts.list(uid),
    loadouts.prefs(uid),
    db.queryOneAsync<{ id: string }>('SELECT id FROM players WHERE uid = ?', [uid]),
  ]);
  const { onAServer } = await import('../fleet/push/skins');
  return {
    loadouts: list,
    layout: prefs.layout,
    tips: prefs.tips,
    showLoadout: prefs.showLoadout,
    onServer: row ? onAServer(row.id) : false,
    colors: LOADOUT_COLORS,
    max: MAX_LOADOUTS,
    pools: POOLS,
    startingPistols: STARTING_PISTOLS,
    defaultLayout: DEFAULT_LAYOUT,
  };
}

/**
 * @openapi
 * /api/skins/me/free/bulk:
 *   post:
 *     tags: [Skins]
 *     summary: Add many finishes at once (free mode), Factory New
 *     description: One copy of each finish per player; finishes already owned are skipped. With equipEmpty, each new skin is equipped where its slot has nothing on.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items: { type: array, maxItems: 200, items: { type: object, properties: { weapon: { type: string }, paintKit: { type: integer } } } }
 *               equipEmpty: { type: boolean }
 *     responses:
 *       200: { description: "{ added: [skinId], skipped }" }
 *       400: { description: Nothing picked, too many, or not in the catalogue }
 *       404: { description: Skins or free mode are off }
 */
router.post('/me/free/bulk', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    const result = await freeMode.addMany(uid, req.body?.items, req.body?.equipEmpty === true);
    if (req.body?.equipEmpty === true && result.added.length) void loadoutChanged(uid);
    return res.json({ success: true, ...result });
  } catch (error) {
    return fail(res, error, 'Adding skins');
  }
});

/**
 * @openapi
 * /api/skins/me/loadouts:
 *   get:
 *     tags: [Skins]
 *     summary: Your saved loadouts and the loadout page's preferences (free mode)
 *     responses:
 *       200: { description: "{ loadouts: [{ id, name, color, active, items, agents }], layout, tips, showLoadout, onServer, colors, max, pools, startingPistols, defaultLayout }" }
 *   post:
 *     tags: [Skins]
 *     summary: Make a new loadout and switch to it
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string, maxLength: 24 }, color: { type: string }, copy: { type: boolean, description: 'false: start empty (default: a copy of the active one)' } } }
 *     responses:
 *       200: { description: The page's data, as GET }
 *       400: { description: No name, or too many loadouts }
 */
router.get('/me/loadouts', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    return res.json({ success: true, ...(await loadoutState(uid)) });
  } catch (error) {
    return fail(res, error, 'Reading your loadouts');
  }
});

router.post('/me/loadouts', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    const body = req.body ?? {};
    const id = await loadouts.create(uid, { name: body.name, color: body.color, copy: body.copy });
    void loadoutChanged(uid);
    return res.json({ success: true, id, ...(await loadoutState(uid)) });
  } catch (error) {
    return fail(res, error, 'Making a loadout');
  }
});

/**
 * @openapi
 * /api/skins/me/loadouts/{id}:
 *   patch:
 *     tags: [Skins]
 *     summary: Rename or recolour a saved loadout
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The page's data }
 *   delete:
 *     tags: [Skins]
 *     summary: Throw a saved loadout away (not the last one)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The page's data }
 *       400: { description: It is the last one }
 */
router.patch('/me/loadouts/:id', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    await loadouts.update(uid, req.params.id, { name: req.body?.name, color: req.body?.color });
    return res.json({ success: true, ...(await loadoutState(uid)) });
  } catch (error) {
    return fail(res, error, 'Changing a loadout');
  }
});

router.delete('/me/loadouts/:id', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    await loadouts.remove(uid, req.params.id);
    void loadoutChanged(uid);
    return res.json({ success: true, ...(await loadoutState(uid)) });
  } catch (error) {
    return fail(res, error, 'Removing a loadout');
  }
});

/**
 * @openapi
 * /api/skins/me/loadouts/{id}/activate:
 *   post:
 *     tags: [Skins]
 *     summary: Switch to a saved loadout (the one in use is saved first)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The page's data }
 */
router.post('/me/loadouts/:id/activate', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    await loadouts.activate(uid, req.params.id);
    void loadoutChanged(uid);
    return res.json({ success: true, ...(await loadoutState(uid)) });
  } catch (error) {
    return fail(res, error, 'Switching loadouts');
  }
});

/**
 * @openapi
 * /api/skins/me/layout:
 *   put:
 *     tags: [Skins]
 *     summary: The weapons each side's loadout shows, per column (five each, a starting pistol first)
 *     responses:
 *       200: { description: "{ layout }" }
 *       400: { description: Not a valid layout }
 */
router.put('/me/layout', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    const layout = parseLayout(req.body?.layout);
    await loadouts.savePrefs(uid, { layout });
    return res.json({ success: true, layout });
  } catch (error) {
    return fail(res, error, 'Saving the loadout layout');
  }
});

/**
 * @openapi
 * /api/skins/me/tips:
 *   post:
 *     tags: [Skins]
 *     summary: Close a notice of the inventory pages for good
 *     responses:
 *       200: { description: "{ tips }: the notices closed" }
 */
router.post('/me/tips', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    return res.json({ success: true, tips: await loadouts.closeTip(uid, req.body?.tip) });
  } catch (error) {
    return fail(res, error, 'Closing a notice');
  }
});

/**
 * @openapi
 * /api/skins/me/profile-loadout:
 *   put:
 *     tags: [Skins]
 *     summary: Whether your profile shows your loadout
 *     responses:
 *       200: { description: "{ showLoadout }" }
 */
router.put('/me/profile-loadout', async (req, res) => {
  try {
    const uid = await player(req, res);
    if (!uid) return;
    const show = req.body?.show !== false;
    await loadouts.savePrefs(uid, { showLoadout: show });
    return res.json({ success: true, showLoadout: show });
  } catch (error) {
    return fail(res, error, 'Saving the profile setting');
  }
});

export default router;

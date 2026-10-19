/**
 * Fork: free skin mode's routes, under /api/skins (mounted by ./routes.ts).
 * Every one answers 404 while skins or free mode are off.
 *
 * GET    /free/catalog       every finish a player can pick
 * GET    /free/agents        the agents per side, and (signed in) the ones you picked
 * POST   /me/free            pick a finish ({ weapon, paintKit, float?, pattern?, stattrak?, nametag?, team?, equip? })
 * PATCH  /me/skins/:id       change one of your skins ({ float?, pattern?, stattrak?, nametag? })
 * DELETE /me/skins/:id       throw away one of your picked skins
 * PUT    /me/agents          set a side's agent ({ team: 2 | 3, model | null })
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../../../config/database';
import { log } from '../../../utils/logger';
import { resolveViewerAccount } from '../../../utils/viewerIdentity';
import { AGENTS, freeMode, parseCustom, requireFreeMode } from './freeMode';
import { SkinError } from './skinService';

const router = Router();

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
 *       200: { description: "{ skins: [{ weapon, weaponName, paintKit, name, variant, rarity, slot, side, image, statTrak }] }" }
 *       404: { description: Skins or free mode are off }
 */
router.get('/free/catalog', async (_req, res) => {
  try {
    await requireFreeMode();
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, skins: await freeMode.catalog() });
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

export default router;

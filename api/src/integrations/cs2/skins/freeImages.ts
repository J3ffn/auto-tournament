/* global AbortController, fetch */
/**
 * Fork (free skin mode): the game's default look of each weapon, knife and
 * glove, and the agents' pictures, served by the platform.
 *
 *   GET /api/skins/free/img/base/:key    a weapon's default look (weapon_ak47, weapon_knife_t, ct_gloves, …)
 *   GET /api/skins/free/img/agent/:key   an agent (its model's file name, e.g. ctm_st6_variantj)
 *
 * The pictures are Steam's (./baseWeapons.json and ./agents.json, from
 * ByMykel/CSGO-API). Each is fetched once and kept in DATA_DIR/cache, so a
 * player's browser never talks to Steam, and a picture Steam stops serving
 * still shows. A miss is not asked for again for 10 minutes; with
 * CATALOG_OFFLINE nothing is fetched.
 */

import fs from 'fs';
import path from 'path';
import { Router, type Request, type Response } from 'express';
import { DATA_DIR } from '../../../config/dataDir';
import { log } from '../../../utils/logger';
import agentsJson from './agents.json';
import baseJson from './baseWeapons.json';

const router = Router();

const CACHE_DIR = path.join(DATA_DIR, 'cache', 'cs2-images', 'steam');
const KEY = /^[a-z0-9_]{1,64}$/;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MISS_TTL_MS = 10 * 60 * 1000;
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

const BASE: Readonly<Record<string, { name: string; image: string }>> = baseJson;

/** An agent's key: its model's file name (`agents/models/ctm_st6/ctm_st6_variantj.vmdl` → `ctm_st6_variantj`). */
export function agentKey(model: string): string {
  return path.posix.basename(model, '.vmdl').toLowerCase();
}

/** Where the platform serves a weapon's default look. */
export function baseImageUrl(weapon: string): string {
  return `/api/skins/free/img/base/${weapon}`;
}

/** Where the platform serves an agent's picture. */
export function agentImageUrl(model: string): string {
  return `/api/skins/free/img/agent/${agentKey(model)}`;
}

/** Whether the game has a default look for this weapon, knife or glove. */
export function hasBaseImage(weapon: string): boolean {
  return Boolean(BASE[weapon]);
}

function sourceUrl(kind: string, key: string): string | null {
  if (kind === 'base') return BASE[key]?.image ?? null;
  if (kind === 'agent') {
    const agent = (agentsJson as Array<{ model: string; image: string }>).find(
      (a) => agentKey(a.model) === key
    );
    return agent?.image ?? null;
  }
  return null;
}

function offline(): boolean {
  return ['1', 'true', 'yes'].includes((process.env.CATALOG_OFFLINE || '').trim().toLowerCase());
}

/** The cached file for a picture, if there is one. */
function cached(kind: string, key: string): string | null {
  for (const ext of Object.keys(TYPES)) {
    const file = path.join(CACHE_DIR, kind, `${key}.${ext}`);
    try {
      if (fs.statSync(file).isFile()) return file;
    } catch {
      // not this one
    }
  }
  return null;
}

const misses = new Map<string, number>();
const inFlight = new Map<string, Promise<string | null>>();

async function download(kind: string, key: string): Promise<string | null> {
  const url = sourceUrl(kind, key);
  if (!url || offline()) return null;
  const id = `${kind}/${key}`;
  if ((misses.get(id) ?? 0) > Date.now()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const ext = Object.keys(TYPES).find((e) => TYPES[e] === type);
    if (!res.ok || !ext) throw new Error(`HTTP ${res.status} ${type}`);
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length === 0 || data.length > MAX_BYTES) throw new Error(`${data.length} bytes`);
    const target = path.join(CACHE_DIR, kind, `${key}.${ext}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, target);
    return target;
  } catch (error) {
    misses.set(id, Date.now() + MISS_TTL_MS);
    log.warn(`[Skins] default picture ${id} not fetched: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolve(kind: string, key: string): Promise<string | null> {
  const hit = cached(kind, key);
  if (hit) return Promise.resolve(hit);
  const id = `${kind}/${key}`;
  let job = inFlight.get(id);
  if (!job) {
    job = download(kind, key).finally(() => inFlight.delete(id));
    inFlight.set(id, job);
  }
  return job;
}

/**
 * @openapi
 * /api/skins/free/img/{kind}/{key}:
 *   get:
 *     tags: [Skins]
 *     summary: A weapon's default look, or an agent's picture (public)
 *     parameters:
 *       - { in: path, name: kind, required: true, schema: { type: string, enum: [base, agent] } }
 *       - { in: path, name: key, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: The picture }
 *       404: { description: Unknown, or Steam did not serve it }
 */
router.get('/free/img/:kind/:key', async (req: Request, res: Response) => {
  const { kind, key } = req.params;
  if ((kind !== 'base' && kind !== 'agent') || !KEY.test(key)) return res.status(404).end();
  const file = await resolve(kind, key);
  if (!file) return res.status(404).end();
  res.setHeader('Content-Type', TYPES[file.slice(file.lastIndexOf('.') + 1)]);
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return res.sendFile(file);
});

export default router;

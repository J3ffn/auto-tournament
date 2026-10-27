import { test, expect } from '@playwright/test';
import { getAuthHeader, signInAsPlayerViaRequest, signInViaRequest } from '../helpers/auth';
import {
  DEFAULT_LAYOUT,
  cleanName,
  parseLayout,
} from '../../api/src/integrations/cs2/skins/loadouts';

/**
 * Fork: the free mode loadout pages. Saved loadouts (switching puts another
 * one's skins and agents in the game), the weapons each side's loadout shows
 * (five per column, a starting pistol first), notices closed for good, adding
 * many skins at once (one of each, Factory New), and the profile's loadout.
 *
 * @tag api
 */

const STEAM_ID = '76561198099990291';

test.describe('Skins free mode loadouts: input checks', () => {
  test('a layout is five weapons per column from that side, a starting pistol first', () => {
    expect(parseLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
    const copy = () => JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
    const ak = copy();
    ak['3'].rifle[0] = 'weapon_ak47';
    expect(() => parseLayout(ak)).toThrow();
    const pistols = copy();
    pistols['2'].pistol[1] = 'weapon_glock';
    expect(() => parseLayout(pistols)).toThrow();
    const usp = copy();
    usp['3'].pistol = [
      'weapon_p250',
      'weapon_usp_silencer',
      'weapon_fiveseven',
      'weapon_elite',
      'weapon_deagle',
    ];
    expect(() => parseLayout(usp)).toThrow();
    const p2000 = copy();
    p2000['3'].pistol[0] = 'weapon_hkp2000';
    expect(parseLayout(p2000)['3'].pistol[0]).toBe('weapon_hkp2000');
    const short = copy();
    short['2'].mid = short['2'].mid.slice(0, 4);
    expect(() => parseLayout(short)).toThrow();
  });

  test('loadout names are one line of at most 24 characters', () => {
    expect(cleanName('  Azul  ')).toBe('Azul');
    expect(cleanName('a\nb')).toBe('a b');
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(24));
    expect(cleanName(7)).toBe('');
  });
});

test.describe.serial('Skins free mode loadouts', () => {
  test(
    'add many at once, save loadouts and switch between them, arrange weapons, profile',
    { tag: ['@api'] },
    async ({ request, playwright, baseURL }) => {
      await signInViaRequest(request);
      expect(
        (
          await request.put('/api/skins/admin/config', {
            headers: getAuthHeader(),
            data: { enabled: true, freeMode: true },
          })
        ).ok()
      ).toBe(true);
      const player = await playwright.request.newContext({ baseURL });
      expect(await signInAsPlayerViaRequest(player, STEAM_ID, 'Loadout Tester')).toBe(true);

      const catalog = await (await player.get('/api/skins/free/catalog')).json();
      test.skip(!catalog.skins?.length, 'The skin catalogue could not be read');
      const first = (weapon: string) =>
        catalog.skins.find(
          (s: { weapon: string; vanilla?: boolean }) => s.weapon === weapon && !s.vanilla
        );
      const items = ['weapon_ak47', 'weapon_m4a1', 'weapon_awp'].map((w) => {
        const s = first(w);
        return { weapon: s.weapon, paintKit: s.paintKit };
      });

      // Bulk: nothing picked and unknown finishes are refused.
      expect((await player.post('/api/skins/me/free/bulk', { data: { items: [] } })).status()).toBe(
        400
      );
      expect(
        (
          await player.post('/api/skins/me/free/bulk', {
            data: { items: [{ weapon: 'weapon_ak47', paintKit: 1 }] },
          })
        ).status()
      ).toBe(400);

      // Added Factory New and, asked to, equipped where the slot was empty.
      const added = await (
        await player.post('/api/skins/me/free/bulk', { data: { items, equipEmpty: true } })
      ).json();
      expect(added.added).toHaveLength(3);
      const mine = async () => (await (await player.get('/api/skins/me')).json()).inventory;
      const inv = await mine();
      expect(inv).toHaveLength(3);
      for (const s of inv) {
        expect(s.float).toBeLessThan(0.07);
        expect(s.equipped).toBe(true);
      }
      // One of each: the same finishes again add nothing.
      const again = await (
        await player.post('/api/skins/me/free/bulk', { data: { items } })
      ).json();
      expect(again).toEqual(expect.objectContaining({ added: [], skipped: 3 }));

      // The first loadout is made on first read and holds what is equipped.
      let state = await (await player.get('/api/skins/me/loadouts')).json();
      expect(state.loadouts).toHaveLength(1);
      expect(state.loadouts[0]).toEqual(expect.objectContaining({ name: '', active: true }));
      expect(state.loadouts[0].items).toHaveLength(3);
      expect(state.layout).toEqual(DEFAULT_LAYOUT);
      expect(state.onServer).toBe(false);
      const mainId = state.loadouts[0].id;

      // A new, empty loadout goes into use: nothing equipped in the game.
      expect((await player.post('/api/skins/me/loadouts', { data: { name: '  ' } })).status()).toBe(
        400
      );
      state = await (
        await player.post('/api/skins/me/loadouts', { data: { name: 'Vermelho', copy: false } })
      ).json();
      const red = state.loadouts.find((l: { name: string }) => l.name === 'Vermelho');
      expect(red.active).toBe(true);
      expect((await mine()).filter((s: { equipped: boolean }) => s.equipped)).toHaveLength(0);

      // Equip one skin there and set an agent, then switch back: the first one returns.
      const ak = (await mine()).find((s: { weapon: string }) => s.weapon === 'weapon_ak47');
      expect(
        (await player.post('/api/skins/me/equip', { data: { skinId: ak.id, team: 0 } })).ok()
      ).toBe(true);
      const agents = await (await player.get('/api/skins/free/agents')).json();
      const ctAgent = agents.agents.find((a: { team: number }) => a.team === 3).model;
      await player.put('/api/skins/me/agents', { data: { team: 3, model: ctAgent } });
      await player.post(`/api/skins/me/loadouts/${mainId}/activate`);
      expect((await mine()).filter((s: { equipped: boolean }) => s.equipped)).toHaveLength(3);
      expect((await (await player.get('/api/skins/free/agents')).json()).mine.ct).toBeNull();
      // …and back to Vermelho: its AK and agent.
      state = await (await player.post(`/api/skins/me/loadouts/${red.id}/activate`)).json();
      expect(
        (await mine())
          .filter((s: { equipped: boolean }) => s.equipped)
          .map((s: { id: number }) => s.id)
      ).toEqual([ak.id]);
      expect((await (await player.get('/api/skins/free/agents')).json()).mine.ct).toBe(ctAgent);
      // The other loadout's items are there for "also in loadout …".
      expect(state.loadouts.find((l: { id: number }) => l.id === mainId).items).toHaveLength(3);

      // Rename, recolour (only the offered colours), delete (never the last).
      state = await (
        await player.patch(`/api/skins/me/loadouts/${red.id}`, {
          data: { name: 'Red', color: '#3fc168' },
        })
      ).json();
      expect(state.loadouts.find((l: { id: number }) => l.id === red.id)).toEqual(
        expect.objectContaining({ name: 'Red', color: '#3fc168' })
      );
      state = await (await player.delete(`/api/skins/me/loadouts/${red.id}`)).json();
      expect(state.loadouts).toHaveLength(1);
      expect(state.loadouts[0]).toEqual(expect.objectContaining({ id: mainId, active: true }));
      expect((await player.delete(`/api/skins/me/loadouts/${mainId}`)).status()).toBe(400);

      // Layout: saved when valid, refused otherwise.
      const layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT));
      layout['3'].rifle[1] = 'weapon_m4a1_silencer';
      expect((await player.put('/api/skins/me/layout', { data: { layout } })).ok()).toBe(true);
      layout['3'].rifle[2] = 'weapon_ak47';
      expect((await player.put('/api/skins/me/layout', { data: { layout } })).status()).toBe(400);
      state = await (await player.get('/api/skins/me/loadouts')).json();
      expect(state.layout['3'].rifle[1]).toBe('weapon_m4a1_silencer');

      // Notices closed stay closed; unknown ones are refused.
      expect((await player.post('/api/skins/me/tips', { data: { tip: 'nope' } })).status()).toBe(
        400
      );
      const tips = await (
        await player.post('/api/skins/me/tips', { data: { tip: 'loadout-same-as-game' } })
      ).json();
      expect(tips.tips).toEqual(['loadout-same-as-game']);

      // The profile gets the loadout, and its owner can hide it.
      let profile = await (await player.get(`/api/skins/players/${STEAM_ID}`)).json();
      expect(profile.loadout).toEqual(
        expect.objectContaining({
          show: true,
          layout: expect.objectContaining({ '3': expect.anything() }),
        })
      );
      await player.put('/api/skins/me/profile-loadout', { data: { show: false } });
      profile = await (await player.get(`/api/skins/players/${STEAM_ID}`)).json();
      expect(profile.loadout.show).toBe(false);
    }
  );
});

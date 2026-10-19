import { test, expect } from '@playwright/test';
import { getAuthHeader, signInAsPlayerViaRequest, signInViaRequest } from '../helpers/auth';
import { cleanNametag, parseCustom } from '../../api/src/integrations/cs2/skins/freeMode';
import { loadoutPayload } from '../../api/src/integrations/cs2/skins/skinService';

/**
 * Fork: free skin mode. Off, its routes answer 404. On, a player picks any
 * finish with the float, pattern, StatTrak and name tag they set, equips it
 * per side, changes and removes it, and picks an agent per side; the loadout
 * sent to Ready Up carries the name tag and the agents.
 *
 * @tag api
 */

const STEAM_ID = '76561198099990188';

test.describe('Skins free mode: input checks', () => {
  test('name tags are one line of at most 20 characters', () => {
    expect(cleanNametag('  Ready Up test  ')).toBe('Ready Up test');
    expect(cleanNametag('a\u0000b\nc')).toBe('abc');
    expect(cleanNametag('x'.repeat(40))).toBe('x'.repeat(20));
    expect(cleanNametag('   ')).toBeNull();
    expect(cleanNametag(42)).toBeNull();
  });

  test('bad floats and patterns are refused, not guessed', () => {
    expect(parseCustom({ float: 0.15, pattern: 661, stattrak: true })).toEqual({
      float: 0.15,
      pattern: 661,
      stattrak: true,
    });
    expect(() => parseCustom({ float: 1.5 })).toThrow();
    expect(() => parseCustom({ float: 'abc' })).toThrow();
    expect(() => parseCustom({ pattern: 1001 })).toThrow();
    expect(() => parseCustom({ pattern: 2.5 })).toThrow();
    expect(parseCustom({})).toEqual({});
  });

  test('the loadout carries name tags and agents, and agents alone are a loadout', () => {
    const payload = loadoutPayload(
      [
        {
          weapon: 'weapon_ak47',
          paint_kit: 282,
          float_value: 0.15,
          pattern: 661,
          slot: 'weapon_ak47',
          team: 0,
          stattrak: 7,
          nametag: 'Ready Up',
        },
      ],
      [{ team: 3, model: 'agents/models/ctm_st6/ctm_st6_variantj.vmdl' }]
    );
    expect(payload?.paints[0]).toEqual(
      expect.objectContaining({ defindex: 7, paint: 282, nametag: 'Ready Up', stattrak: 7 })
    );
    expect(payload?.agents).toEqual([
      { team: 3, model: 'agents/models/ctm_st6/ctm_st6_variantj.vmdl' },
    ]);
    expect(
      loadoutPayload([], [{ team: 2, model: 'agents/models/tm_leet/tm_leet_variantf.vmdl' }])
    ).toEqual({
      paints: [],
      agents: [{ team: 2, model: 'agents/models/tm_leet/tm_leet_variantf.vmdl' }],
    });
    expect(loadoutPayload([])).toBeNull();
  });
});

test.describe.serial('Skins free mode', () => {
  test(
    'pick any finish, set it up, equip it, change it, remove it; agents per side',
    { tag: ['@api'] },
    async ({ request, playwright, baseURL }) => {
      await signInViaRequest(request);
      const setConfig = (data: Record<string, unknown>) =>
        request.put('/api/skins/admin/config', { headers: getAuthHeader(), data });

      const player = await playwright.request.newContext({ baseURL });
      expect(await signInAsPlayerViaRequest(player, STEAM_ID, 'Free Mode Tester')).toBe(true);

      // Skins on, free mode off: its routes are not there.
      expect((await setConfig({ enabled: true, freeMode: false })).ok()).toBe(true);
      expect((await player.get('/api/skins/free/catalog')).status()).toBe(404);
      expect((await player.get('/api/skins/status')).ok()).toBe(true);
      expect((await (await player.get('/api/skins/status')).json()).freeMode).toBe(false);

      const on = await setConfig({ freeMode: true });
      expect((await on.json()).config.freeMode).toBe(true);
      expect((await (await player.get('/api/skins/status')).json()).freeMode).toBe(true);

      const catalog = await (await player.get('/api/skins/free/catalog')).json();
      test.skip(!catalog.skins?.length, 'The skin catalogue could not be read');
      const redline = catalog.skins.find(
        (s: { weapon: string; name: string }) => s.weapon === 'weapon_ak47' && s.name === 'Redline'
      );
      const karambit = catalog.skins.find(
        (s: { slot: string; statTrak: boolean }) => s.slot === 'knife' && s.statTrak
      );
      expect(redline).toEqual(expect.objectContaining({ side: 2, statTrak: true }));
      expect(karambit).toBeTruthy();

      // Not in the catalogue, and a bad float.
      expect(
        (
          await player.post('/api/skins/me/free', { data: { weapon: 'weapon_ak47', paintKit: 1 } })
        ).status()
      ).toBe(400);
      expect(
        (
          await player.post('/api/skins/me/free', {
            data: { weapon: redline.weapon, paintKit: redline.paintKit, float: 2 },
          })
        ).status()
      ).toBe(400);

      const picked = await player.post('/api/skins/me/free', {
        data: {
          weapon: redline.weapon,
          paintKit: redline.paintKit,
          float: 0.1234,
          pattern: 661,
          stattrak: true,
          nametag: '  Clutch King  ',
        },
      });
      expect(picked.ok(), await picked.text()).toBe(true);
      const { skinId } = await picked.json();

      // A knife on CT only.
      const knife = await player.post('/api/skins/me/free', {
        data: { weapon: karambit.weapon, paintKit: karambit.paintKit, team: 3 },
      });
      expect(knife.ok(), await knife.text()).toBe(true);
      const knifeId = (await knife.json()).skinId;

      const mine = async () => (await (await player.get('/api/skins/me')).json()).inventory;
      expect(await mine()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: skinId,
            source: 'free',
            float: 0.1234,
            pattern: 661,
            stattrak: 0,
            nametag: 'Clutch King',
            equipped: true,
            seen: true,
          }),
          expect.objectContaining({ id: knifeId, equippedSides: [3] }),
        ])
      );

      // Picking the same finish again changes that copy instead of adding one.
      const again = await player.post('/api/skins/me/free', {
        data: { weapon: redline.weapon, paintKit: redline.paintKit, float: 0.5, stattrak: false },
      });
      expect((await again.json()).skinId).toBe(skinId);
      const changed = (await mine()).filter((s: { weapon: string }) => s.weapon === 'weapon_ak47');
      expect(changed).toEqual([
        expect.objectContaining({ id: skinId, float: 0.5, pattern: 661, stattrak: null }),
      ]);

      // Editing: name tag off, StatTrak on again.
      const edit = await player.patch(`/api/skins/me/skins/${skinId}`, {
        data: { nametag: null, stattrak: true },
      });
      expect(edit.ok(), await edit.text()).toBe(true);
      expect((await mine()).find((s: { id: number }) => s.id === skinId)).toEqual(
        expect.objectContaining({ nametag: null, stattrak: 0 })
      );
      expect((await player.patch('/api/skins/me/skins/999999', { data: {} })).status()).toBe(404);

      // Agents: one per side, only that side's, cleared with null.
      const agents = await (await player.get('/api/skins/free/agents')).json();
      const ct = agents.agents.find((a: { team: number }) => a.team === 3);
      const t = agents.agents.find((a: { team: number }) => a.team === 2);
      expect(agents.mine).toEqual({ ct: null, t: null });
      expect(
        (await player.put('/api/skins/me/agents', { data: { team: 2, model: ct.model } })).status()
      ).toBe(400);
      const setCt = await player.put('/api/skins/me/agents', {
        data: { team: 3, model: ct.model },
      });
      expect((await setCt.json()).mine).toEqual({ ct: ct.model, t: null });
      await player.put('/api/skins/me/agents', { data: { team: 2, model: t.model } });
      const cleared = await player.put('/api/skins/me/agents', { data: { team: 3, model: null } });
      expect((await cleared.json()).mine).toEqual({ ct: null, t: t.model });

      // Removing: a picked skin goes, with its loadout slot.
      expect((await player.delete(`/api/skins/me/skins/${skinId}`)).ok()).toBe(true);
      expect((await player.delete(`/api/skins/me/skins/${skinId}`)).status()).toBe(404);
      expect((await mine()).map((s: { id: number }) => s.id)).toEqual([knifeId]);

      // Clean up: the player's skins and agent, and free mode off again.
      await request.delete(`/api/skins/admin/players/${STEAM_ID}/inventory`, {
        headers: getAuthHeader(),
      });
      await player.put('/api/skins/me/agents', { data: { team: 2, model: null } });
      await setConfig({ freeMode: false });
      expect((await player.put('/api/skins/me/agents', { data: { team: 2 } })).status()).toBe(404);
      await player.dispose();
    }
  );
});

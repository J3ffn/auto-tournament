import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../module-sdk';
import { announceChange } from '../useSkins';
import type { Layout, LoadoutState } from './model';

const CHANGED = 'skins:loadouts';

/**
 * Fork (free mode): the saved loadouts and the loadout pages' preferences
 * (api: GET /api/skins/me/loadouts), with the actions on them. Every page
 * using it reads again after a change made on any of them.
 */
export function useLoadouts() {
  const [state, setState] = useState<LoadoutState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<LoadoutState>('/api/skins/me/loadouts')
        .then((r) => {
          if (cancelled) return;
          setState(r);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true));
    };
    load();
    window.addEventListener(CHANGED, load);
    // An equip changes the active loadout's items (the "also in" notes).
    window.addEventListener('skins:changed', load);
    return () => {
      cancelled = true;
      window.removeEventListener(CHANGED, load);
      window.removeEventListener('skins:changed', load);
    };
  }, []);

  /** Read again (every page using this does). */
  const reload = useCallback(() => window.dispatchEvent(new Event(CHANGED)), []);

  /** Take the page's data from an answer, and tell every other view (skins too: they changed). */
  const took = useCallback((next: LoadoutState, skinsToo: boolean) => {
    setState(next);
    window.dispatchEvent(new Event(CHANGED));
    if (skinsToo) announceChange();
  }, []);

  const activate = useCallback(
    async (id: number) => {
      took(await api.post<LoadoutState>(`/api/skins/me/loadouts/${id}/activate`, {}), true);
    },
    [took]
  );

  const create = useCallback(
    async (name: string, copy: boolean) => {
      took(await api.post<LoadoutState>('/api/skins/me/loadouts', { name, copy }), true);
    },
    [took]
  );

  const update = useCallback(
    async (id: number, change: { name?: string; color?: string }) => {
      took(await api.patch<LoadoutState>(`/api/skins/me/loadouts/${id}`, change), false);
    },
    [took]
  );

  const remove = useCallback(
    async (id: number) => {
      took((await api.delete(`/api/skins/me/loadouts/${id}`)) as LoadoutState, true);
    },
    [took]
  );

  /** Save the weapons each side shows: on screen at once, put back if the server refuses. */
  const saveLayout = useCallback(
    async (layout: Layout) => {
      const before = state;
      setState((s) => (s ? { ...s, layout } : s));
      try {
        await api.put('/api/skins/me/layout', { layout });
      } catch (error) {
        setState(before);
        throw error;
      }
    },
    [state]
  );

  const closeTip = useCallback(async (tip: string) => {
    setState((s) => (s ? { ...s, tips: [...s.tips, tip] } : s));
    await api.post('/api/skins/me/tips', { tip }).catch(() => undefined);
  }, []);

  const setShowLoadout = useCallback(async (show: boolean) => {
    setState((s) => (s ? { ...s, showLoadout: show } : s));
    await api.put('/api/skins/me/profile-loadout', { show });
  }, []);

  const active = state?.loadouts.find((l) => l.active) ?? null;
  return {
    state,
    failed,
    active,
    reload,
    activate,
    create,
    update,
    remove,
    saveLayout,
    closeTip,
    setShowLoadout,
  };
}

export type Loadouts = ReturnType<typeof useLoadouts>;

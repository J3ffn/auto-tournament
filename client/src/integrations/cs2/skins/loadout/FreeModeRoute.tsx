import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../../../module-sdk';
import { skinPaths } from '../paths';
import { AddSkinsPage } from './AddSkinsPage';
import { LoadoutPage } from './LoadoutPage';

/** Whether free mode is on (null while asking). */
function useFreeModeOn(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ freeMode?: boolean }>('/api/skins/status')
      .then((r) => !cancelled && setOn(r.freeMode === true))
      .catch(() => !cancelled && setOn(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return on;
}

/** Fork: the Loadout tab, while free mode is on (else back to the inventory). */
export function LoadoutRoute() {
  const on = useFreeModeOn();
  if (on === null) return null;
  return on ? <LoadoutPage /> : <Navigate to={skinPaths.inventory} replace />;
}

/** Fork: "Add skins", while free mode is on (else back to the inventory). */
export function AddSkinsRoute() {
  const on = useFreeModeOn();
  if (on === null) return null;
  return on ? <AddSkinsPage /> : <Navigate to={skinPaths.inventory} replace />;
}

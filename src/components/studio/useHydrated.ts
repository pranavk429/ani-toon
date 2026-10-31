'use client';

import { useSyncExternalStore } from 'react';

// False during SSR and the hydration pass, true once the client owns the tree.
// Scenes are pure trig; keeping them off the server avoids float-level
// hydration diffs without suppressing warnings.
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function useHydrated() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}

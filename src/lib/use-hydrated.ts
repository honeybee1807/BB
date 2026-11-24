import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False in the server-rendered HTML. A form clicked before hydration would submit natively.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

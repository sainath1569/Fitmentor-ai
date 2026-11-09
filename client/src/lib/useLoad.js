import { useCallback, useEffect, useState } from 'react';

/** Loads data on mount. `reload` refetches without clearing what is on screen. */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    try {
      const data = await loader();
      setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
      return null;
    }
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

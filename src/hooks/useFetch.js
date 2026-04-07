import { useEffect, useState } from 'react';

export function useFetch(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;
    setState((prev) => ({ ...prev, loading: true }));

    async function run() {
      try {
        const data = await asyncFn();
        if (!isMounted) return;
        setState({ data, loading: false, error: null });
      } catch (error) {
        if (!isMounted) return;
        setState({ data: null, loading: false, error: error.message });
      }
    }

    run();

    return () => {
      isMounted = false;
    };
  }, deps);

  return state;
}

import { useEffect, useState } from 'react';
import { normalizeAppError } from '../utils/appError.js';

export function useFetch(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null, errorInfo: null });

  useEffect(() => {
    let isMounted = true;
    setState((prev) => ({ ...prev, loading: true, error: null, errorInfo: null }));

    async function run() {
      try {
        const data = await asyncFn();
        if (!isMounted) return;
        setState({ data, loading: false, error: null, errorInfo: null });
      } catch (error) {
        if (!isMounted) return;
        const normalized = normalizeAppError(error);
        setState({
          data: null,
          loading: false,
          error: normalized.message,
          errorInfo: normalized,
        });
      }
    }

    run();

    return () => {
      isMounted = false;
    };
  }, deps);

  return state;
}

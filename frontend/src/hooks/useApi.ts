import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string) {
  const [state, setState] = useState<UseApiState<T>>({ data: null, loading: true, error: null });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await api.get<T>(url);
      setState({ data: response.data, loading: false, error: null });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error
        ?? (err as Error).message
        ?? 'Erro ao buscar dados';
      setState({ data: null, loading: false, error: message });
    }
  }, [url]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { ...state, refetch: fetchData };
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { fetchHabitations, type FetchHabitationsParams } from '@/lib/api/relocation';
import type { HabitationListItem } from '@/lib/api/types';

export interface UseHabitationQueueOptions extends FetchHabitationsParams {
  enabled?: boolean;
}

export interface UseHabitationQueueResult {
  habitations: HabitationListItem[];
  total: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

interface QueueState {
  key: string;
  habitations: HabitationListItem[];
  total: number;
  error: ApiError | null;
}

/** Loads the prioritised habitation triage queue — the demand side of a relocation plan. */
export function useHabitationQueue(
  options: UseHabitationQueueOptions = {},
): UseHabitationQueueResult {
  const { admin, tier, sort, limit = 50, offset = 0, enabled = true } = options;

  const [state, setState] = useState<QueueState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const requestKey = [admin ?? '', tier ?? '', sort ?? '', limit, offset, reloadToken].join('|');

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    fetchHabitations({ admin, tier, sort, limit, offset }, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setState({ key: requestKey, habitations: page.items, total: page.total, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key: requestKey,
          habitations: [],
          total: 0,
          error:
            cause instanceof ApiError
              ? cause
              : new ApiError('Unexpected error loading the triage queue.', 0),
        });
      });

    return () => controller.abort();
  }, [requestKey, enabled, admin, tier, sort, limit, offset]);

  const isCurrent = state?.key === requestKey;
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    habitations: isCurrent ? state.habitations : [],
    total: isCurrent ? state.total : 0,
    isLoading: enabled && !isCurrent,
    error: isCurrent ? state.error : null,
    refetch,
  };
}

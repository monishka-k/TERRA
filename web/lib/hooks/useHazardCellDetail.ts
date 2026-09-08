'use client';

import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { fetchHazardCellDetail } from '@/lib/api/hazard';
import type { HazardCellDetail, HazardType } from '@/lib/api/types';

export interface UseHazardCellDetailResult {
  detail: HazardCellDetail | null;
  isLoading: boolean;
  error: ApiError | null;
}

interface DetailState {
  /** The request this result belongs to, so a stale result is never shown for a new cell. */
  key: string;
  detail: HazardCellDetail | null;
  error: ApiError | null;
}

/**
 * Loads the dossier for the selected cell, cancelling in-flight requests on change.
 *
 * Results are stamped with the request key they came from and loading is derived by
 * comparing that key to the current selection. That keeps every `setState` inside an
 * async callback, so switching cells never has to clear state synchronously from an
 * effect and trigger a cascading render.
 */
export function useHazardCellDetail(
  h3: string | null,
  hazardType: HazardType = 'riverine_flood',
): UseHazardCellDetailResult {
  const [state, setState] = useState<DetailState | null>(null);
  const requestKey = `${hazardType}:${h3 ?? ''}`;

  useEffect(() => {
    if (!h3) return;

    const controller = new AbortController();

    fetchHazardCellDetail(h3, hazardType, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        setState({ key: requestKey, detail, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key: requestKey,
          detail: null,
          error:
            cause instanceof ApiError ? cause : new ApiError('Unexpected error loading the cell.', 0),
        });
      });

    return () => controller.abort();
  }, [h3, hazardType, requestKey]);

  const isCurrent = state?.key === requestKey;

  return {
    detail: isCurrent ? state.detail : null,
    error: isCurrent ? state.error : null,
    isLoading: h3 !== null && !isCurrent,
  };
}

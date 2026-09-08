'use client';

import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { fetchHazardLayers } from '@/lib/api/hazard';
import type { HazardLayerSummary } from '@/lib/api/types';

export interface UseHazardLayerListResult {
  layers: HazardLayerSummary[];
  isLoading: boolean;
  error: ApiError | null;
}

interface LayerListState {
  layers: HazardLayerSummary[];
  error: ApiError | null;
}

/** Loads the published layer catalogue that backs the hazard switcher. */
export function useHazardLayerList(): UseHazardLayerListResult {
  const [state, setState] = useState<LayerListState | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchHazardLayers(controller.signal)
      .then((layers) => {
        if (controller.signal.aborted) return;
        setState({ layers, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          layers: [],
          error: cause instanceof ApiError ? cause : new ApiError('Unexpected error.', 0),
        });
      });

    return () => controller.abort();
  }, []);

  return {
    layers: state?.layers ?? [],
    error: state?.error ?? null,
    isLoading: state === null,
  };
}

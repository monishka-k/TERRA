'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchHazardLayer, type FetchHazardLayerParams } from '@/lib/api/hazard';
import { ApiError } from '@/lib/api/client';
import type { HazardCell, HazardLayerResponse } from '@/lib/api/types';
import { rollupHazardCells, type RollupAggregation } from '@/lib/map/rollup';
import { SOURCE_RESOLUTION } from '@/lib/map/constants';

export interface UseHazardLayerOptions extends Omit<FetchHazardLayerParams, 'res'> {
  /** Display resolution. Anything below `SOURCE_RESOLUTION` is rolled up client-side. */
  resolution?: number;
  aggregation?: RollupAggregation;
  enabled?: boolean;
}

export interface UseHazardLayerResult {
  data: HazardLayerResponse | null;
  /** Cells at the requested display resolution (rolled up when coarser than source). */
  cells: HazardCell[];
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

interface LayerState {
  /** The request this result belongs to; compared against the current key to derive loading. */
  key: string;
  data: HazardLayerResponse | null;
  error: ApiError | null;
}

/**
 * Loads a hazard layer once and derives coarser resolutions in memory.
 *
 * The request always asks for resolution 8 — re-fetching per zoom level would re-transfer
 * identical data the client can aggregate itself, so `resolution` never invalidates it.
 */
export function useHazardLayer(options: UseHazardLayerOptions = {}): UseHazardLayerResult {
  const {
    hazardType = 'riverine_flood',
    resolution = SOURCE_RESOLUTION,
    aggregation = 'max',
    bbox,
    admin,
    minSusceptibility,
    limit = 30000,
    enabled = true,
  } = options;

  const [state, setState] = useState<LayerState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const bboxKey = bbox ? bbox.join(',') : '';
  const requestKey = [hazardType, bboxKey, admin ?? '', minSusceptibility ?? '', limit, reloadToken].join(
    '|',
  );

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    fetchHazardLayer(
      {
        hazardType,
        res: SOURCE_RESOLUTION,
        bbox,
        admin,
        minSusceptibility,
        limit,
      },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ key: requestKey, data, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key: requestKey,
          data: null,
          error:
            cause instanceof ApiError
              ? cause
              : new ApiError('Unexpected error loading the hazard layer.', 0),
        });
      });

    return () => controller.abort();
    // `bbox` is an array literal at most call sites; `bboxKey` is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, enabled, hazardType, bboxKey, admin, minSusceptibility, limit]);

  const isCurrent = state?.key === requestKey;
  const data = isCurrent ? state.data : null;
  const error = isCurrent ? state.error : null;

  const cells = useMemo(() => {
    if (!data) return [];
    if (resolution >= SOURCE_RESOLUTION) return data.cells;
    return rollupHazardCells(data.cells, {
      targetResolution: resolution,
      sourceResolution: data.res,
      aggregation,
    });
  }, [data, resolution, aggregation]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { data, cells, isLoading: enabled && !isCurrent, error, refetch };
}

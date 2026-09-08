'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { fetchCandidateSites, type FetchCandidateSitesParams } from '@/lib/api/relocation';
import type { CandidateSiteItem } from '@/lib/api/types';

export interface UseCandidateSitesOptions
  extends Omit<FetchCandidateSitesParams, 'includeScreening'> {
  /** Null while no habitation is selected; the request is skipped. */
  habitationId: number | null;
  enabled?: boolean;
}

export interface UseCandidateSitesResult {
  /** Every site in range, including those the policy screened out. */
  sites: CandidateSiteItem[];
  /** Sites the H7 policy accepted for allocation. */
  allocatable: CandidateSiteItem[];
  /** Screened out for eligibility, not distance. */
  excluded: CandidateSiteItem[];
  total: number;
  isLoading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

interface SitesState {
  key: string;
  sites: CandidateSiteItem[];
  total: number;
  error: ApiError | null;
}

/** Loads the ranked candidate destination sites for one habitation. */
export function useCandidateSites(options: UseCandidateSitesOptions): UseCandidateSitesResult {
  const { habitationId, radiusKm, minSuitability, limit = 50, enabled = true } = options;

  const [state, setState] = useState<SitesState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const active = enabled && habitationId !== null;
  const requestKey = [
    habitationId ?? '',
    radiusKm ?? '',
    minSuitability ?? '',
    limit,
    reloadToken,
  ].join('|');

  useEffect(() => {
    if (!active || habitationId === null) return;
    const controller = new AbortController();

    // Always ask for the screened-out sites too. Requesting only allocatable ones cannot
    // distinguish "nothing within range" from "plenty in range, none of it allocatable" — and
    // for screening-grade districts the second case is every district, which made the panel
    // report an empty radius while hundreds of parcels sat inside it.
    fetchCandidateSites(
      habitationId,
      { includeScreening: true, radiusKm, minSuitability, limit },
      controller.signal,
    )
      .then((page) => {
        if (controller.signal.aborted) return;
        setState({ key: requestKey, sites: page.items, total: page.total, error: null });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          key: requestKey,
          sites: [],
          total: 0,
          error:
            cause instanceof ApiError
              ? cause
              : new ApiError('Unexpected error loading candidate sites.', 0),
        });
      });

    return () => controller.abort();
  }, [requestKey, active, habitationId, radiusKm, minSuitability, limit]);

  const isCurrent = state?.key === requestKey;
  const sites = isCurrent ? state.sites : [];
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    sites,
    allocatable: sites.filter((site) => site.allocatable),
    excluded: sites.filter((site) => !site.allocatable),
    total: isCurrent ? state.total : 0,
    isLoading: active && !isCurrent,
    error: isCurrent ? state.error : null,
    refetch,
  };
}

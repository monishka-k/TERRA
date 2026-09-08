'use client';

import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { fetchHabitations } from '@/lib/api/relocation';
import type { HabitationListItem } from '@/lib/api/types';
import { deriveDistricts, type DistrictOption } from '@/components/features/relocation/DistrictSelect';

export interface UseDistrictsResult {
  districts: DistrictOption[];
  isLoading: boolean;
  error: ApiError | null;
}

/** The API caps a page at 200 records. */
const PAGE_SIZE = 200;
/** Bounds the walk so a growing dataset can never turn this into an unbounded request loop. */
const MAX_PAGES = 25;

/**
 * Every district that has habitations, regardless of how its habitations rank.
 *
 * Deriving this from the queue's own page is wrong: the queue is ranked by priority and paged, so
 * a district whose habitations all score low — as happens wherever the hazard peaks fall on
 * uninhabited land — never reaches the first page and silently disappears from the picker.
 *
 * Paging the full list is the honest workaround for there being no endpoint that enumerates
 * districts. Adding `GET /districts` would replace this walk with a single small request.
 */
export function useDistricts(): UseDistrictsResult {
  const [items, setItems] = useState<HabitationListItem[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const collected: HabitationListItem[] = [];
      try {
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const result = await fetchHabitations(
            { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
            controller.signal,
          );
          collected.push(...result.items);
          if (!result.has_more || result.items.length === 0) break;
        }
        if (!controller.signal.aborted) setItems(collected);
      } catch (cause) {
        if (controller.signal.aborted) return;
        // Districts already collected are still worth showing; a partial picker beats none.
        setItems(collected.length ? collected : []);
        setError(
          cause instanceof ApiError ? cause : new ApiError('Unexpected error loading districts.', 0),
        );
      }
    })();

    return () => controller.abort();
  }, []);

  const districts = useMemo(() => (items ? deriveDistricts(items) : []), [items]);
  return { districts, isLoading: items === null && error === null, error };
}

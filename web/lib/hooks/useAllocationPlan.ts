'use client';

import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { solveAllocationPlan } from '@/lib/api/relocation';
import type { AllocationPlanRequest, AllocationPlanResponse } from '@/lib/api/types';

export interface UseAllocationPlanResult {
  plan: AllocationPlanResponse | null;
  isSolving: boolean;
  error: ApiError | null;
  /** Runs the solver. Resolves to the plan, or null when the request failed. */
  solve: (request: AllocationPlanRequest) => Promise<AllocationPlanResponse | null>;
  reset: () => void;
}

/**
 * Runs the min-cost-flow allocation solver on demand.
 *
 * Deliberately imperative rather than an effect: each run writes a persisted, audited
 * `allocation_run` row, so it must happen only when an official explicitly asks for it —
 * never as a side effect of a slider moving.
 */
export function useAllocationPlan(): UseAllocationPlanResult {
  const [plan, setPlan] = useState<AllocationPlanResponse | null>(null);
  const [isSolving, setIsSolving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const solve = useCallback(async (request: AllocationPlanRequest) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setIsSolving(true);
    setError(null);

    try {
      const result = await solveAllocationPlan(request, controller.signal);
      if (controller.signal.aborted) return null;
      setPlan(result);
      return result;
    } catch (cause) {
      if (controller.signal.aborted) return null;
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError('Unexpected error running the allocation solver.', 0),
      );
      return null;
    } finally {
      if (!controller.signal.aborted) setIsSolving(false);
    }
  }, []);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    setPlan(null);
    setError(null);
    setIsSolving(false);
  }, []);

  return { plan, isSolving, error, solve, reset };
}

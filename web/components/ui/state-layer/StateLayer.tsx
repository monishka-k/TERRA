'use client';

import React from 'react';
import { useRipple } from './useRipple';

export interface StateLayerProps {
  /** Skip the ripple. The CSS hover/focus tint still applies. */
  disabled?: boolean;
  /** Peak ripple opacity. M3 pressed state is 12%. */
  opacity?: number;
  /** Ripple expansion duration, in seconds. */
  duration?: number;
  /** Extra classes on the clipping layer. */
  className?: string;
}

export interface StateLayerHandle {
  /** Spawn a ripple at the pointer position. */
  spawn: (event: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Material 3 state layer, rendered inside an interactive element.
 *
 * The host element supplies hover and focus tints via the `.m3-state-layer`
 * class; this component adds the pressed-state ripple. Mount it as the first
 * child of a `position: relative` host, and forward the host's `onPointerDown`
 * to the handle returned through `ref`.
 */
export const StateLayer = React.forwardRef<StateLayerHandle, StateLayerProps>(
  function StateLayer({ disabled = false, opacity, duration, className = '' }, ref) {
    const { layerRef, spawn } = useRipple({ disabled, opacity, duration });

    React.useImperativeHandle(ref, () => ({ spawn }), [spawn]);

    return <span ref={layerRef} aria-hidden className={`m3-ripple-layer ${className}`} />;
  }
);

'use client';

import React, { useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouteTransition } from './RouteTransitionContext';

export interface ContainerTransformLinkProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Link>, 'href' | 'onClick'> {
  /** Destination route. */
  href: string;
  children: React.ReactNode;
  /**
   * Element the surface grows out of. Defaults to the link itself; pass a ref
   * when the visual container is a parent (e.g. a whole tab pill).
   */
  originRef?: React.RefObject<HTMLElement | null>;
  /** Fall back to a plain link with no transform. */
  disableTransform?: boolean;
  /** Runs before the transition starts. Call `preventDefault` to cancel. */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

/** Modifier clicks and non-primary buttons must keep their native behaviour. */
function isPlainLeftClick(event: React.MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * A `next/link` that navigates through the Material 3 container transform.
 *
 * It stays a real anchor so Next still prefetches the route and so
 * middle-click, ctrl-click and "open in new tab" behave normally — only a plain
 * left click is intercepted.
 */
export const ContainerTransformLink = React.forwardRef<
  HTMLAnchorElement,
  ContainerTransformLinkProps
>(function ContainerTransformLink(
  { href, children, originRef, disableTransform = false, onClick, ...rest },
  forwardedRef
) {
  const { startTransition } = useRouteTransition();
  const localRef = useRef<HTMLAnchorElement>(null);

  const setRefs = useCallback(
    (node: HTMLAnchorElement | null) => {
      localRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || disableTransform || !isPlainLeftClick(event)) return;

      event.preventDefault();
      startTransition(originRef?.current ?? localRef.current, href);
    },
    [disableTransform, href, onClick, originRef, startTransition]
  );

  return (
    <Link ref={setRefs} href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
});

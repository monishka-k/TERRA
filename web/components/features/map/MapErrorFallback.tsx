'use client';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';

export interface MapErrorFallbackProps {
  message: string;
  code?: string | null;
  requestId?: string | null;
  onRetry?: () => void;
  className?: string;
}

/** Covers the canvas when the hazard layer cannot be loaded. */
export const MapErrorFallback = ({
  message,
  code,
  requestId,
  onRetry,
  className = '',
}: MapErrorFallbackProps) => (
  <div
    className={['absolute inset-0 z-20 flex items-center justify-center bg-surface-0/90 p-6', className]
      .filter(Boolean)
      .join(' ')}
  >
    <ErrorState
      title="Hazard layer unavailable"
      message={message}
      code={code}
      requestId={requestId}
      className="max-w-md"
      actionSlot={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} className="self-start">
            Retry
          </Button>
        ) : null
      }
    />
  </div>
);

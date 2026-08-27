import { useCallback, useRef, useState, type TouchEventHandler } from 'react';

const DEFAULT_THRESHOLD = 72;

export interface PullToRefreshOptions {
  enabled?: boolean;
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export interface PullToRefreshResult {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  onTouchCancel: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  onTouchMove: TouchEventHandler<HTMLElement>;
  onTouchStart: TouchEventHandler<HTMLElement>;
}

/**
 * Tracks a downward gesture only while the document is already at its top.
 * It never calls preventDefault, leaving native touch scrolling in control.
 */
export function usePullToRefresh({
  enabled = true,
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
}: PullToRefreshOptions): PullToRefreshResult {
  const startYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const resetGesture = useCallback(() => {
    startYRef.current = null;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, []);

  const onTouchStart = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      if (
        !enabled ||
        isRefreshing ||
        event.touches.length !== 1 ||
        window.scrollY > 4 ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }

      startYRef.current = event.touches[0]?.clientY ?? null;
    },
    [enabled, isRefreshing],
  );

  const onTouchMove = useCallback<TouchEventHandler<HTMLElement>>(
    (event) => {
      const startY = startYRef.current;
      const currentY = event.touches[0]?.clientY;
      if (startY === null || currentY === undefined) {
        return;
      }
      if (window.scrollY > 4) {
        resetGesture();
        return;
      }

      const delta = currentY - startY;
      if (delta <= 0) {
        resetGesture();
        return;
      }

      const distance = Math.min(delta * 0.45, threshold * 1.25);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    },
    [resetGesture, threshold],
  );

  const finishGesture = useCallback(
    (shouldRefresh: boolean) => {
      resetGesture();
      if (!shouldRefresh) {
        return;
      }

      setIsRefreshing(true);
      void onRefresh()
        .catch(() => undefined)
        .finally(() => setIsRefreshing(false));
    },
    [onRefresh, resetGesture],
  );

  const onTouchEnd = useCallback<TouchEventHandler<HTMLElement>>(() => {
    finishGesture(pullDistanceRef.current >= threshold);
  }, [finishGesture, threshold]);

  const onTouchCancel = useCallback<TouchEventHandler<HTMLElement>>(() => {
    finishGesture(false);
  }, [finishGesture]);

  return {
    isPulling: pullDistance > 0 && !isRefreshing,
    isRefreshing,
    pullDistance,
    onTouchCancel,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
  };
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    typeof Element !== 'undefined' &&
    target instanceof Element &&
    target.closest('a,button,input,select,textarea,[role="button"]') !== null
  );
}

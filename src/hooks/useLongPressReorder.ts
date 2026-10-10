/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

interface UseLongPressReorderOptions<T> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  longPressDelay?: number; // ms, default 300ms
  autoScrollThreshold?: number; // px from edge, default 70px
}

export function useLongPressReorder<T>({
  items,
  onReorder,
  containerRef,
  longPressDelay = 300,
  autoScrollThreshold = 70
}: UseLongPressReorderOptions<T>) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [draggedHeight, setDraggedHeight] = useState(48);

  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollSpeedRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  isDraggingRef.current = isDragging;

  const draggedIndexRef = useRef<number | null>(null);
  draggedIndexRef.current = draggedIndex;
  const overIndexRef = useRef<number | null>(null);
  overIndexRef.current = overIndex;

  const registerItemRef = useCallback((index: number, el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(index, el);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  // Continuous auto-scroll loop
  const autoScrollLoop = useCallback(() => {
    if (!isDraggingRef.current || !containerRef.current) return;

    if (scrollSpeedRef.current !== 0) {
      containerRef.current.scrollTop += scrollSpeedRef.current;

      // Recompute target index while scrolling
      const currentY = currentPosRef.current.y;
      const dIdx = draggedIndexRef.current;
      if (dIdx !== null) {
        let bestIndex = dIdx;
        let minDistance = Infinity;

        itemRefs.current.forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          let top = rect.top;
          if (idx === dIdx) {
            top -= dragOffsetY;
          }
          const midY = top + rect.height / 2;
          const dist = Math.abs(currentY - midY);
          if (dist < minDistance) {
            minDistance = dist;
            bestIndex = idx;
          }
        });

        if (bestIndex !== overIndexRef.current) {
          setOverIndex(bestIndex);
          triggerHaptic('selection');
        }
      }
    }

    rafIdRef.current = requestAnimationFrame(autoScrollLoop);
  }, [containerRef]);

  // Clean up timers & RAF on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handlePointerDown = useCallback(
    (index: number, e: React.PointerEvent | React.TouchEvent) => {
      // Don't trigger if already dragging
      if (isDraggingRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      startPosRef.current = { x: clientX, y: clientY };
      currentPosRef.current = { x: clientX, y: clientY };

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        // Long-press threshold reached (300ms) without movement!
        const el = itemRefs.current.get(index);
        if (el) {
          const rect = el.getBoundingClientRect();
          setDraggedHeight(rect.height || 48);
        }

        triggerHaptic('medium');
        setIsDragging(true);
        setDraggedIndex(index);
        setOverIndex(index);
        setDragOffsetY(0);

        // Lock window scroll
        document.body.style.userSelect = 'none';

        // Start auto-scroll RAF monitor
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(autoScrollLoop);
      }, longPressDelay);
    },
    [autoScrollLoop, longPressDelay]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent | React.TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      currentPosRef.current = { x: clientX, y: clientY };

      // If waiting for long-press delay and moved too much (> 8px), cancel timer
      if (!isDraggingRef.current) {
        const deltaX = clientX - startPosRef.current.x;
        const deltaY = clientY - startPosRef.current.y;
        if (Math.hypot(deltaX, deltaY) > 8) {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        }
        return;
      }

      // Drag is active! Prevent browser scroll gestures
      if ('cancelable' in e && e.cancelable) {
        e.preventDefault();
      }

      const deltaY = clientY - startPosRef.current.y;
      setDragOffsetY(deltaY);

      // Determine hovered / target slot
      const dIdx = draggedIndexRef.current;
      if (dIdx !== null) {
        let bestIndex = dIdx;
        let minDistance = Infinity;

        itemRefs.current.forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          let top = rect.top;
          if (idx === dIdx) {
            top -= dragOffsetY;
          }
          const midY = top + rect.height / 2;
          const dist = Math.abs(clientY - midY);
          if (dist < minDistance) {
            minDistance = dist;
            bestIndex = idx;
          }
        });

        if (bestIndex !== overIndexRef.current) {
          setOverIndex(bestIndex);
          triggerHaptic('selection');
        }
      }

      // Check auto-scroll bounds on container
      if (containerRef.current) {
        const cRect = containerRef.current.getBoundingClientRect();
        const topThreshold = cRect.top + autoScrollThreshold;
        const bottomThreshold = cRect.bottom - autoScrollThreshold;

        if (clientY < topThreshold) {
          const intensity = Math.min(1, (topThreshold - clientY) / autoScrollThreshold);
          scrollSpeedRef.current = -Math.round(4 + intensity * 14);
        } else if (clientY > bottomThreshold) {
          const intensity = Math.min(1, (clientY - bottomThreshold) / autoScrollThreshold);
          scrollSpeedRef.current = Math.round(4 + intensity * 14);
        } else {
          scrollSpeedRef.current = 0;
        }
      }
    },
    [containerRef, autoScrollThreshold]
  );

  const handlePointerUp = useCallback(() => {
    // Cancel any pending long press
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Stop auto-scroll loop
    scrollSpeedRef.current = 0;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (!isDraggingRef.current) return;

    // Restore body selection
    document.body.style.userSelect = '';

    const fromIdx = draggedIndexRef.current;
    const toIdx = overIndexRef.current;

    if (fromIdx !== null && toIdx !== null && fromIdx !== toIdx) {
      const updated = [...items];
      const [removed] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, removed);
      triggerHaptic('success');
      onReorder(updated);
    } else {
      triggerHaptic('light');
    }

    setIsDragging(false);
    setDraggedIndex(null);
    setOverIndex(null);
    setDragOffsetY(0);
  }, [items, onReorder]);

  // Global listeners while dragging to guarantee pointerup/touchmove work even if pointer leaves item
  useEffect(() => {
    if (!isDragging) return;

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        handlePointerMove({
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => e.preventDefault(),
          cancelable: e.cancelable
        } as any);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      handlePointerMove(e as any);
    };

    const onEnd = () => {
      handlePointerUp();
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Helper function to get row transform and visual styling
  const getItemStyle = useCallback(
    (index: number): React.CSSProperties => {
      if (!isDragging || draggedIndex === null || overIndex === null) {
        return {
          transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
        };
      }

      // Dragged Item
      if (index === draggedIndex) {
        return {
          transform: `translateY(${dragOffsetY}px) scale(1.03)`,
          zIndex: 50,
          position: 'relative',
          touchAction: 'none',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.8), 0 8px 10px -6px rgba(0, 0, 0, 0.8)',
          backgroundColor: '#2C2C2E',
          borderRadius: '14px',
          opacity: 0.95,
          transition: 'none' // Instant tracking while moving
        };
      }

      // Other items shifting out of the way
      let shiftY = 0;
      if (draggedIndex < overIndex) {
        // Dragging down: items between draggedIndex + 1 and overIndex shift UP
        if (index > draggedIndex && index <= overIndex) {
          shiftY = -draggedHeight;
        }
      } else if (draggedIndex > overIndex) {
        // Dragging up: items between overIndex and draggedIndex - 1 shift DOWN
        if (index >= overIndex && index < draggedIndex) {
          shiftY = draggedHeight;
        }
      }

      return {
        transform: shiftY !== 0 ? `translateY(${shiftY}px)` : 'translateY(0px)',
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        zIndex: 1,
        position: 'relative'
      };
    },
    [isDragging, draggedIndex, overIndex, dragOffsetY, draggedHeight]
  );

  return {
    isDragging,
    draggedIndex,
    overIndex,
    registerItemRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getItemStyle
  };
}

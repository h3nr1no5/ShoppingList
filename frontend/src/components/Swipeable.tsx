import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SwipeableProps {
  children: React.ReactNode;
  onSwipe: () => void;
  onSwipeRight?: () => void;
  className?: string;
}

const Swipeable: React.FC<SwipeableProps> = ({ children, onSwipe, onSwipeRight, className = '' }) => {
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const translateXRef = useRef(0);
  const hasUnmountedRef = useRef(false);
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isSwiped, setIsSwiped] = useState(false);

  const SWIPE_THRESHOLD = 80;

  // Track unmount to prevent state updates after component is unmounted
  useEffect(() => {
    hasUnmountedRef.current = false;
    return () => {
      hasUnmountedRef.current = true;
    };
  }, []);

  const resetSwipe = useCallback(() => {
    setTranslateX(0);
    translateXRef.current = 0;
    setIsSwiping(false);
    setIsSwiped(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startX.current = e.touches[0].clientX;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;

    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;

    // Allow both left swipe (negative diff) and right swipe (positive diff)
    // Limit the absolute value to 100px
    const clampedDiff = Math.min(Math.abs(diff), 100);
    if (diff > 0) {
      // Left swipe (negative translateX)
      setTranslateX(-clampedDiff);
      translateXRef.current = -clampedDiff;
      setIsSwiping(true);
    } else if (diff < 0) {
      // Right swipe (positive translateX)
      setTranslateX(clampedDiff);
      translateXRef.current = clampedDiff;
      setIsSwiping(true);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const currentTranslateX = translateXRef.current;

    if (currentTranslateX < -SWIPE_THRESHOLD) {
      // Swiped left beyond threshold - delete
      setTranslateX(-100);
      translateXRef.current = -100;
      setIsSwiped(true);
      setIsSwiping(false);
      onSwipe();
    } else if (currentTranslateX > SWIPE_THRESHOLD) {
      // Swiped right beyond threshold - edit
      setTranslateX(100);
      translateXRef.current = 100;
      setIsSwiped(true);
      setIsSwiping(false);
      onSwipeRight?.();
    } else {
      resetSwipe();
    }
  }, [resetSwipe, onSwipe, onSwipeRight]);

  // Close swipe when tapping elsewhere
  useEffect(() => {
    if (!isSwiped) return;

    const handleClickOutside = () => {
      if (!hasUnmountedRef.current) {
        resetSwipe();
      }
    };

    // Small delay to prevent immediate closing from the touchend
    const timer = setTimeout(() => {
      if (!hasUnmountedRef.current) {
        document.addEventListener('touchstart', handleClickOutside, { once: true });
        document.addEventListener('click', handleClickOutside, { once: true });
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      // Also remove any listeners that may have been added
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isSwiped, resetSwipe]);

  return (
    <div className={`swipeable-wrapper ${className}`}>
      <div className="swipeable-edit-bg" aria-hidden="true">✏️</div>
      <div className="swipeable-delete-bg" aria-hidden="true">🗑️</div>
      <div
        ref={contentRef}
        className={`swipeable-content ${isSwiping ? 'swiping' : ''}`}
        style={{ transform: translateX !== 0 ? `translateX(${translateX}px)` : undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default Swipeable;
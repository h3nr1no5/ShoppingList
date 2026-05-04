import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SwipeableProps {
  children: React.ReactNode;
  onSwipe: () => void;
  className?: string;
}

const Swipeable: React.FC<SwipeableProps> = ({ children, onSwipe, className = '' }) => {
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isSwiped, setIsSwiped] = useState(false);

  const SWIPE_THRESHOLD = 80;

  const resetSwipe = useCallback(() => {
    setTranslateX(0);
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

    // Only allow left swipe (positive diff), allow vertical scroll to pass
    if (diff > 0) {
      setTranslateX(-Math.min(diff, 100));
      setIsSwiping(true);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (-translateX >= SWIPE_THRESHOLD) {
      setTranslateX(-100);
      setIsSwiped(true);
      setIsSwiping(false);
      onSwipe();
    } else {
      resetSwipe();
    }
  }, [translateX, resetSwipe, onSwipe]);

  // Close swipe when tapping elsewhere
  useEffect(() => {
    if (!isSwiped) return;

    const handleClickOutside = () => {
      resetSwipe();
    };

    // Small delay to prevent immediate closing from the touchend
    const timer = setTimeout(() => {
      document.addEventListener('touchstart', handleClickOutside, { once: true });
      document.addEventListener('click', handleClickOutside, { once: true });
    }, 300);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isSwiped, resetSwipe]);

  return (
    <div className={`swipeable-wrapper ${className}`}>
      <div className="swipeable-delete-bg" aria-hidden="true">🗑️</div>
      <div
        ref={contentRef}
        className={`swipeable-content ${isSwiping ? 'swiping' : ''}`}
        style={{ transform: translateX < 0 ? `translateX(${translateX}px)` : undefined }}
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

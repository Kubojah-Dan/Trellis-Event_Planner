import React, { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  targetValue: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  targetValue,
  suffix = '',
  prefix = '',
  duration = 1600,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const [hasAnimated, setHasAnimated] = useState<boolean>(false);
  const elementRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          if (targetValue === 0) {
            setDisplayValue(0);
            return;
          }

          let startTime: number | null = null;
          const startValue = 0;

          const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic: fast start, soft gentle landing
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (targetValue - startValue) * easeOut);

            setDisplayValue(current);

            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              setDisplayValue(targetValue);
            }
          };

          requestAnimationFrame(step);
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -20px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [targetValue, duration, hasAnimated]);

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
};

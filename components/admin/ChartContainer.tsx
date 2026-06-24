'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  className?: string;
  children: ReactElement;
}

/** Avoids Recharts width/height -1 warnings during SSR or hidden layout. */
export default function ChartContainer({
  className = 'h-52 w-full min-w-0 md:h-80',
  children,
}: ChartContainerProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className={className}>
      {ready ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

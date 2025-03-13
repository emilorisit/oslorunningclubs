import { useEffect, useRef } from 'react';

interface AdUnitProps {
  className?: string;
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  responsive?: boolean;
  style?: React.CSSProperties;
}

/**
 * A component for displaying Google AdSense advertisements
 */
export function AdUnit({
  className = '',
  slot = '',
  format = 'auto',
  responsive = true,
  style,
}: AdUnitProps) {
  const adContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adContainerRef.current && typeof window !== 'undefined') {
      try {
        const adsbygoogle = window.adsbygoogle || [];
        adsbygoogle.push({});
      } catch (err) {
        console.error('AdSense error:', err);
      }
    }
  }, []);

  return (
    <div className={className} style={style} ref={adContainerRef}>
      <div 
        className={`adsbygoogle ${responsive ? 'adsbygoogle-responsive' : ''}`}
        style={{
          display: 'block',
          ...(responsive ? { width: '100%' } : {}),
        }}
        data-ad-client="ca-pub-1836205252410390"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      ></div>
    </div>
  );
}

// Add this to global.d.ts or similar file if needed
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}
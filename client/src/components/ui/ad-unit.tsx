import { useEffect, useRef, useState } from 'react';

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
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Create a unique ID for this ad unit to prevent duplicate initialization
    const adId = `ad-${slot}-${Math.random().toString(36).substring(2, 9)}`;

    if (adContainerRef.current && typeof window !== 'undefined' && !isInitialized) {
      try {
        // Add a unique ID to prevent duplicate initialization
        if (adContainerRef.current.firstChild) {
          (adContainerRef.current.firstChild as HTMLElement).setAttribute('id', adId);
        }

        // Only initialize if not already initialized
        if (!window.adsbygoogle) {
          window.adsbygoogle = [];
        }
        
        // Mark as initialized and push only once
        setIsInitialized(true);
        window.adsbygoogle.push({});
      } catch (err) {
        console.error('AdSense error:', err);
      }
    }

    // Cleanup function to handle component unmounting
    return () => {
      // AdSense doesn't provide a standard way to "destroy" ads
      // This is mainly for cleanup and to prevent memory leaks
      if (adContainerRef.current) {
        // Remove content to "clean up" the ad when component unmounts
        adContainerRef.current.innerHTML = '';
      }
    };
  }, [slot, isInitialized]);

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
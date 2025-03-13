import { useEffect, useRef, useState } from 'react';

interface AdUnitProps {
  className?: string;
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  responsive?: boolean;
  style?: React.CSSProperties;
}

// Keep track of initialized ad slots globally
const initializedSlots = new Set<string>();

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
  const [adId] = useState(`ad-${slot}-${Math.random().toString(36).substring(2, 9)}`);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize AdSense only once per component instance
    if (adContainerRef.current && typeof window !== 'undefined' && !isInitialized) {
      try {
        // Ensure we always have the adsbygoogle array
        if (!window.adsbygoogle) {
          window.adsbygoogle = [];
        }
        
        // Apply a unique ID to the ad element to prevent duplicates
        const adElement = adContainerRef.current.querySelector('.adsbygoogle');
        if (adElement) {
          adElement.setAttribute('id', adId);
          
          // Only push for initialization if this exact instance hasn't been initialized
          if (!initializedSlots.has(adId)) {
            initializedSlots.add(adId);
            setIsInitialized(true);
            
            // Delay pushing to adsbygoogle to avoid race conditions
            setTimeout(() => {
              try {
                window.adsbygoogle.push({});
              } catch (err) {
                console.error('AdSense delayed push error:', err);
              }
            }, 0);
          }
        }
      } catch (err) {
        console.error('AdSense initialization error:', err);
      }
    }

    // Cleanup function
    return () => {
      // Remove this slot from the initialized set
      initializedSlots.delete(adId);
      
      // Clear the element content when unmounting
      if (adContainerRef.current) {
        adContainerRef.current.innerHTML = '';
      }
    };
  }, [adId, isInitialized]);

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
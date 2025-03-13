import { useEffect, useRef, useState } from 'react';
import { checkConsentStatus } from './consent-banner';

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
 * that respects user consent settings
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
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);

  // Check for user consent
  useEffect(() => {
    const getConsentStatus = async () => {
      const consentGiven = await checkConsentStatus();
      setHasConsent(consentGiven);
    };

    getConsentStatus();
  }, []);

  useEffect(() => {
    // Initialize AdSense only if user has given consent
    if (hasConsent === null) {
      // Still waiting for consent check to complete
      return;
    }

    if (!hasConsent) {
      // User has not given consent, don't initialize ads
      return;
    }

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
          // Use a consistent ID based on the slot to prevent multiple initializations
          const uniqueId = `ad-${slot}`;
          adElement.setAttribute('id', uniqueId);
          
          // Only push for initialization if this slot hasn't been initialized
          if (!initializedSlots.has(uniqueId)) {
            initializedSlots.add(uniqueId);
            setIsInitialized(true);
            
            // Delay pushing to adsbygoogle to avoid race conditions
            setTimeout(() => {
              try {
                // Check if this element already has an ad in it
                if (!adElement.getAttribute('data-ad-status')) {
                  window.adsbygoogle.push({});
                }
              } catch (err) {
                console.error('AdSense delayed push error:', err);
              }
            }, 100);
          }
        }
      } catch (err) {
        console.error('AdSense initialization error:', err);
      }
    }

    // Cleanup function
    return () => {
      // Remove this slot from the initialized set
      const uniqueId = `ad-${slot}`;
      initializedSlots.delete(uniqueId);
      
      // Clear the element content when unmounting
      if (adContainerRef.current) {
        adContainerRef.current.innerHTML = '';
      }
    };
  }, [adId, isInitialized, hasConsent, slot]);

  // If consent status is still being determined or user declined consent, show nothing
  if (hasConsent === null || hasConsent === false) {
    return null;
  }

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
        data-adtest="on" // Remove this in production
      ></div>
    </div>
  );
}

// Add this to global.d.ts or similar file if needed
declare global {
  interface Window {
    adsbygoogle: any[];
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    __tcfapi: any;
  }
}
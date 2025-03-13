import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Alpha release banner component to notify users that the app is in early development
 */
export function AlphaBanner() {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="bg-amber-500 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-amber-800 mr-3">
              ALPHA
            </span>
            <p className="text-sm font-medium">
              Oslo Running Calendar is currently in alpha release. Features may change and data may be reset.
            </p>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="ml-2 flex-shrink-0 text-white hover:text-amber-100 focus:outline-none"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
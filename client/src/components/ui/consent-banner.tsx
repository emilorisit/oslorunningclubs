import React, { useEffect, useState } from "react";

/**
 * Google Consent Management Platform (CMP) implementation
 * This component initializes Google's current consent approach with three options:
 * 1. Consent
 * 2. Do not consent
 * 3. Manage options
 */
export function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  
  useEffect(() => {
    // Check if consent has already been given
    const consentAlreadyGiven = localStorage.getItem('cookieConsent');
    if (!consentAlreadyGiven) {
      setShowBanner(true);
    }
    
    // Add Google AdSense script with consent mode
    const adsenseScript = document.createElement("script");
    adsenseScript.async = true;
    adsenseScript.crossOrigin = "anonymous";
    adsenseScript.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1836205252410390";
    document.head.appendChild(adsenseScript);
    
    // Initialize Google's Consent API
    const consentScript = document.createElement("script");
    consentScript.text = `
      window.googletag = window.googletag || {cmd: []};
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      
      // Default consent to denied
      gtag('consent', 'default', {
        'ad_storage': 'denied',
        'analytics_storage': 'denied',
        'personalization_storage': 'denied',
        'functionality_storage': 'denied',
        'security_storage': 'granted', // Always granted as it's essential
        'wait_for_update': 500
      });
    `;
    document.head.appendChild(consentScript);
    
    // Clean up scripts on unmount
    return () => {
      if (adsenseScript.parentNode) {
        adsenseScript.parentNode.removeChild(adsenseScript);
      }
      if (consentScript.parentNode) {
        consentScript.parentNode.removeChild(consentScript);
      }
    };
  }, []);
  
  const acceptAll = () => {
    // Update Google consent API
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('consent', 'update', {
        'ad_storage': 'granted',
        'analytics_storage': 'granted',
        'personalization_storage': 'granted',
        'functionality_storage': 'granted'
      });
    }
    
    // Save consent in localStorage
    localStorage.setItem('cookieConsent', 'full');
    setShowBanner(false);
  };
  
  const rejectAll = () => {
    // Keep default consent (denied)
    // Save rejection in localStorage
    localStorage.setItem('cookieConsent', 'none');
    setShowBanner(false);
  };
  
  const openManageOptions = () => {
    // Show detailed consent options
    setShowDetailedOptions(true);
  };
  
  const [showDetailedOptions, setShowDetailedOptions] = useState(false);
  const [consentOptions, setConsentOptions] = useState({
    ads: false,
    analytics: false,
    personalization: false,
    functionality: false
  });
  
  const handleOptionChange = (option: keyof typeof consentOptions) => {
    setConsentOptions({
      ...consentOptions,
      [option]: !consentOptions[option]
    });
  };
  
  const savePreferences = () => {
    // Update Google consent API with selected options
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('consent', 'update', {
        'ad_storage': consentOptions.ads ? 'granted' : 'denied',
        'analytics_storage': consentOptions.analytics ? 'granted' : 'denied',
        'personalization_storage': consentOptions.personalization ? 'granted' : 'denied',
        'functionality_storage': consentOptions.functionality ? 'granted' : 'denied'
      });
    }
    
    // Save detailed preferences
    localStorage.setItem('cookieConsent', 'custom');
    localStorage.setItem('cookieConsentDetails', JSON.stringify(consentOptions));
    
    // Close the banner
    setShowDetailedOptions(false);
    setShowBanner(false);
  };
  
  if (!showBanner) {
    return null;
  }
  
  if (showDetailedOptions) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-md z-50 border-t-2 border-primary">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-lg font-bold mb-3">Manage Your Consent Preferences</h3>
          <p className="mb-4">Customize which cookies you want to accept. Some cookies are necessary for the website to function and cannot be disabled.</p>
          
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <strong>Essential Cookies</strong>
                <p className="text-sm text-gray-600">These cookies are necessary for the website to function and cannot be disabled.</p>
              </div>
              <div className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">Required</div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <strong>Advertising Cookies</strong>
                <p className="text-sm text-gray-600">These cookies are used to show you personalized ads.</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={consentOptions.ads}
                  onChange={() => handleOptionChange('ads')}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <strong>Analytics Cookies</strong>
                <p className="text-sm text-gray-600">These cookies help us understand how visitors interact with our website.</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={consentOptions.analytics}
                  onChange={() => handleOptionChange('analytics')}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <strong>Personalization Cookies</strong>
                <p className="text-sm text-gray-600">These cookies allow us to personalize your experience.</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={consentOptions.personalization}
                  onChange={() => handleOptionChange('personalization')}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <strong>Functionality Cookies</strong>
                <p className="text-sm text-gray-600">These cookies enable enhanced functionality and personalization.</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={consentOptions.functionality}
                  onChange={() => handleOptionChange('functionality')}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <button 
              onClick={() => setShowDetailedOptions(false)}
              className="px-4 py-2 bg-gray-200 rounded-md text-gray-800 hover:bg-gray-300"
            >
              Back
            </button>
            <button 
              onClick={savePreferences}
              className="px-4 py-2 bg-primary rounded-md text-white hover:bg-primary/90"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-md z-50 border-t-2 border-primary">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold">Cookie Consent</h3>
            <p>We use cookies to improve your experience and for advertising. You can manage your preferences or accept all cookies.</p>
            <a href="/privacy" className="text-primary hover:underline text-sm">Privacy Policy</a>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={rejectAll}
              className="px-4 py-2 bg-gray-200 rounded-md text-gray-800 hover:bg-gray-300"
            >
              Reject All
            </button>
            <button 
              onClick={openManageOptions}
              className="px-4 py-2 bg-gray-100 rounded-md text-gray-800 hover:bg-gray-200 border border-gray-300"
            >
              Manage Options
            </button>
            <button 
              onClick={acceptAll}
              className="px-4 py-2 bg-primary rounded-md text-white hover:bg-primary/90"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * This function checks for user consent status
 * @returns Promise that resolves to true if consent is given, false otherwise
 */
export function checkConsentStatus(): Promise<boolean> {
  return new Promise((resolve) => {
    // Check localStorage first for quick response
    const consentValue = localStorage.getItem('cookieConsent');
    
    if (consentValue === 'full') {
      resolve(true);
      return;
    }
    
    if (consentValue === 'none') {
      resolve(false);
      return;
    }
    
    if (consentValue === 'custom') {
      const detailedConsent = JSON.parse(localStorage.getItem('cookieConsentDetails') || '{}');
      // For ads, we specifically check the 'ads' consent
      resolve(!!detailedConsent.ads);
      return;
    }
    
    // If no consent has been given yet, default to false
    resolve(false);
  });
}
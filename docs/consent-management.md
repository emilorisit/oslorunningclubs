# Cookie Consent Implementation Guide

This document provides instructions on setting up and configuring the cookie consent banner for websites, particularly those serving users in the European Economic Area (EEA), the UK, and Switzerland.

## Table of Contents

1. [Overview](#overview)
2. [Regulatory Background](#regulatory-background)
3. [Implementation Details](#implementation-details)
4. [Configuration Options](#configuration-options)
5. [Checking Consent Status](#checking-consent-status)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

Our cookie consent implementation is designed to help websites comply with regulations like the GDPR while maintaining ad revenue. The implementation included in this project provides users with three options:

1. **Consent** - User accepts all cookies and tracking
2. **Do not consent** - User rejects all non-essential cookies and tracking
3. **Manage options** - User can select which specific purposes they consent to

## Regulatory Background

Websites that serve users in the EEA, UK, and Switzerland need to obtain explicit consent for non-essential cookies and tracking according to:

- General Data Protection Regulation (GDPR)
- ePrivacy Directive
- UK Data Protection Act
- Swiss Federal Act on Data Protection

## Implementation Details

### 1. Google AdSense Integration

The current implementation uses Google's updated consent approach, which directly ties into the Google AdSense script:

```typescript
// Add Google AdSense script with consent mode
const adsenseScript = document.createElement("script");
adsenseScript.async = true;
adsenseScript.crossOrigin = "anonymous";
adsenseScript.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1836205252410390";
document.head.appendChild(adsenseScript);
```

### 2. Consent Banner Setup

The consent banner component provides three main options:
- Accept All - Grants consent for all purposes
- Reject All - Denies consent for all non-essential purposes
- Manage Options - Opens a detailed view where users can select specific purposes

### 3. Consent Storage

User consent choices are stored in the browser's localStorage:

```typescript
// Save consent in localStorage
localStorage.setItem('cookieConsent', 'full'); // for Accept All
localStorage.setItem('cookieConsent', 'none'); // for Reject All
localStorage.setItem('cookieConsent', 'custom'); // for custom preferences
localStorage.setItem('cookieConsentDetails', JSON.stringify(consentOptions)); // detailed options
```

### 4. Google Consent Mode Integration

When a user makes a choice, we update Google's consent API:

```typescript
// Update Google consent API
if (typeof (window as any).gtag === 'function') {
  (window as any).gtag('consent', 'update', {
    'ad_storage': consentOptions.ads ? 'granted' : 'denied',
    'analytics_storage': consentOptions.analytics ? 'granted' : 'denied',
    'personalization_storage': consentOptions.personalization ? 'granted' : 'denied',
    'functionality_storage': consentOptions.functionality ? 'granted' : 'denied'
  });
}
```

### 5. Add the Banner to Your App

In your main App component:

```tsx
import { ConsentBanner } from "@/components/ui/consent-banner";

function App() {
  return (
    <>
      {/* Your app content */}
      <ConsentBanner />
    </>
  );
}
```

### 6. Update Ad Components to Respect Consent

Ensure your ad components check consent before displaying ads:

```tsx
import { checkConsentStatus } from '@/components/ui/consent-banner';

function AdComponent() {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  
  useEffect(() => {
    async function checkConsent() {
      const consent = await checkConsentStatus();
      setHasConsent(consent);
    }
    checkConsent();
  }, []);
  
  if (!hasConsent) return null;
  
  // Render ad if consent is given
  return <div>Ad content</div>;
}
```

## Configuration Options

### Consent Categories

The implementation currently supports the following consent categories:

1. **Essential Cookies** - Always enabled, necessary for website function
2. **Advertising Cookies** - For displaying personalized ads
3. **Analytics Cookies** - For tracking user interactions and website usage
4. **Personalization Cookies** - For customizing the user experience
5. **Functionality Cookies** - For enhanced features and functionality

### Visual Customization

The banner and detailed options view can be customized by modifying the CSS classes in the component. The implementation uses Tailwind CSS classes for styling.

## Checking Consent Status

The `checkConsentStatus()` function returns a Promise that resolves to `true` if the user has granted consent for personalized advertising, and `false` otherwise.

```typescript
import { checkConsentStatus } from '@/components/ui/consent-banner';

async function example() {
  const hasConsent = await checkConsentStatus();
  if (hasConsent) {
    // Load personalized content or ads
  } else {
    // Load non-personalized content or no ads
  }
}
```

## Best Practices

1. **Make the consent banner clear and easy to understand**
2. **Offer genuine choice** - all three options should be equally accessible
3. **Honor the user's choice** - never load tracking scripts or personalized ads without consent
4. **Keep records of consent** - consent signals are stored in localStorage
5. **Regular audits** - periodically check that your implementation respects user choices

## Troubleshooting

### Common Issues

1. **Banner not showing**:
   - Check console for JavaScript errors
   - Verify localStorage is accessible (not blocked by privacy settings)
   - Check for CSS conflicts that might hide the banner

2. **Consent status not saving**:
   - Check if localStorage is available and not full
   - Verify that the localStorage events are properly handled

3. **Ads showing despite no consent**:
   - Ensure ad components are properly checking consent status
   - Verify that the AdSense script respects the consent mode settings

4. **Styling issues**:
   - Check for CSS conflicts with your existing styles
   - Verify that Tailwind CSS classes are properly applied

For more help, refer to:
- [Google's Consent Mode documentation](https://developers.google.com/tag-platform/security/guides/consent)
- [GDPR compliance guidelines](https://gdpr.eu/cookies/)
import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdUnit } from '@/components/ui/ad-unit';

const AuthError = () => {
  const [location] = useLocation();
  const [errorReason, setErrorReason] = useState('Unknown error');

  useEffect(() => {
    // Extract error reason from URL if available
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    
    if (reason) {
      switch (reason) {
        case 'access_denied':
          setErrorReason('Access was denied to Strava. Please try again and allow the required permissions.');
          break;
        case 'missing_parameters':
          setErrorReason('Required parameters were missing during the authorization process.');
          break;
        case 'token_exchange_failed':
          setErrorReason('Failed to exchange authorization code for access token.');
          break;
        case 'redirect_uri_mismatch':
          setErrorReason('The redirect URL in the request did not match the URL configured in the Strava application settings.');
          break;
        case 'invalid_redirect':
          setErrorReason('The redirect URL was invalid or not properly configured.');
          break;
        case 'invalid_client':
          setErrorReason('The client credentials (ID or secret) were invalid or not properly configured.');
          break;
        default:
          // Check if it contains redirect_url error
          if (reason.toLowerCase().includes('redirect') || reason.toLowerCase().includes('url')) {
            setErrorReason('There was an issue with the redirect URL configuration. Please contact the administrator.');
          } else {
            setErrorReason(`Authentication failed: ${reason}`);
          }
      }
    }
  }, [location]);

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
      
      <h1 className="font-heading font-bold text-2xl text-secondary mb-2">
        Authentication Failed
      </h1>
      
      <p className="text-muted mb-8">
        We couldn't complete the Strava authentication. {errorReason}
      </p>
      
      <div className="flex flex-col space-y-4">
        <Button 
          variant="outline" 
          onClick={() => window.history.back()}
          className="mx-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
        
        <Link href="/">
          <span className="text-sm text-primary hover:underline cursor-pointer">
            Return to Home
          </span>
        </Link>
      </div>
      
      {/* Advertisement */}
      <div className="mt-10">
        <AdUnit 
          className="mx-auto max-w-4xl py-2 bg-gray-50 rounded-lg" 
          slot="4123456789"
          format="horizontal"
        />
      </div>
    </div>
  );
};

export default AuthError;
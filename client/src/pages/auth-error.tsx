import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        default:
          setErrorReason(`Authentication failed: ${reason}`);
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
        
        <Link href="/" className="text-sm text-primary hover:underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default AuthError;
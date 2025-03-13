import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AuthSuccess = () => {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect after countdown
  useEffect(() => {
    if (countdown <= 0) {
      setLocation('/clubs');
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, setLocation]);

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      
      <h1 className="font-heading font-bold text-2xl text-secondary mb-2">
        Successfully Connected with Strava
      </h1>
      
      <p className="text-muted mb-8">
        Your Strava account has been successfully connected to Oslo Running Calendar.
        You can now view and manage running club events from Strava.
      </p>
      
      <div className="flex flex-col space-y-4">
        <p className="text-sm text-muted">
          Redirecting to clubs page in {countdown} seconds...
        </p>
        
        <Button 
          variant="outline" 
          onClick={() => setLocation('/clubs')}
          className="mx-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to Clubs
        </Button>
      </div>
    </div>
  );
};

export default AuthSuccess;
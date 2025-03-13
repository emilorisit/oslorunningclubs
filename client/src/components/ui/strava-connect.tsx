import { useState, useEffect } from 'react';
import { StravaButton } from '@/components/ui/strava-button';
import { connectWithStrava, isStravaAuthenticated } from '@/lib/strava';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SiStrava } from 'react-icons/si';
import { CheckCircle, ExternalLink } from 'lucide-react';

interface StravaConnectProps {
  clubId?: number;
  showCard?: boolean;
  title?: string;
  description?: string;
}

export function StravaConnect({ 
  clubId, 
  showCard = true,
  title = "Connect with Strava",
  description = "Connect your Strava account to sync running events automatically."
}: StravaConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check if the user is already authenticated with Strava
  useEffect(() => {
    setIsAuthenticated(isStravaAuthenticated());
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWithStrava(clubId);
      // The connectWithStrava function will redirect the browser, 
      // so no need to handle success here
    } catch (error) {
      console.error('Failed to start Strava connection:', error);
      setIsConnecting(false);
    }
  };

  // Show minimal connected state without a card
  if (!showCard) {
    if (isAuthenticated) {
      return (
        <div className="flex items-center text-sm text-green-600">
          <CheckCircle className="h-4 w-4 mr-1" />
          <span>Connected to Strava</span>
        </div>
      );
    }
    return (
      <div>
        <StravaButton onClick={handleConnect} isLoading={isConnecting} />
      </div>
    );
  }

  // Show full card with connected state or connect button
  if (isAuthenticated) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Connected to Strava</CardTitle>
          <CardDescription>Your Strava account is connected and syncing events.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center p-4 bg-green-50 text-green-800 rounded-md">
            <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
            <div>
              <p className="font-medium">Successfully connected</p>
              <p className="text-sm text-green-700">Events from your Strava clubs will automatically be synced every night.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show connect card if not authenticated
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Connecting with Strava allows us to:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mb-4">
          <li>Access your club's events</li>
          <li>Automatically import running events to the calendar</li>
          <li>Keep your events up-to-date</li>
        </ul>
        <p className="text-sm text-muted-foreground mb-4">
          We will only access your public data and never post on your behalf.
        </p>
      </CardContent>
      <CardFooter>
        <StravaButton onClick={handleConnect} isLoading={isConnecting} />
      </CardFooter>
    </Card>
  );
}
import { useState } from 'react';
import { StravaButton } from '@/components/ui/strava-button';
import { connectWithStrava } from '@/lib/strava';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SiStrava } from 'react-icons/si';

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

  // Demo mode removed

  if (!showCard) {
    return (
      <div className="flex flex-col space-y-2">
        <StravaButton onClick={handleConnect} isLoading={isConnecting} />
      </div>
    );
  }

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
      <CardFooter className="flex flex-col space-y-2">
        <StravaButton onClick={handleConnect} isLoading={isConnecting} />
      </CardFooter>
    </Card>
  );
}
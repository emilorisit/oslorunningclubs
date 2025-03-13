import { Link, useLocation } from 'wouter';
import { CheckCircle, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AuthSuccess() {
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [location] = useLocation();
  
  // Check if we're in demo mode
  const isDemoMode = location.includes('demo=true');
  
  const handleSyncEvents = async () => {
    setSyncing(true);
    setError(null);
    
    if (isDemoMode) {
      // For demo mode, simulate a successful sync
      setTimeout(() => {
        setSyncResults({
          message: "Demo sync completed",
          results: [
            {
              clubName: "Oslo Running Club",
              action: "added",
              eventId: "demo-event-1"
            },
            {
              clubName: "Oslo Trail Runners",
              action: "added",
              eventId: "demo-event-2"
            }
          ]
        });
        setSyncDone(true);
        setSyncing(false);
      }, 1500);
      return;
    }
    
    try {
      const response = await axios.get('/api/strava/sync');
      setSyncResults(response.data);
      setSyncDone(true);
    } catch (err) {
      console.error('Failed to sync events', err);
      setError('Failed to sync events. Please try again later.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      
      <h1 className="font-heading font-bold text-2xl text-secondary mb-2">
        {isDemoMode ? "Demo Mode Activated" : "Successfully Connected with Strava"}
      </h1>
      
      <p className="text-muted mb-8">
        {isDemoMode 
          ? "You're now using the application in demo mode. You can explore the features without connecting to Strava."
          : "Your Strava account has been successfully connected. You can now sync your club's events."}
      </p>
      
      {isDemoMode && (
        <div className="bg-blue-50 border border-blue-100 rounded p-4 mb-8 text-sm text-blue-800">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium">Demo Mode</p>
              <p>This is a demonstration of how the Strava integration works. No actual data is fetched from Strava.</p>
            </div>
          </div>
        </div>
      )}
      
      {!syncDone ? (
        <div className="flex flex-col space-y-6">
          <Button 
            onClick={handleSyncEvents}
            disabled={syncing}
            className="mx-auto"
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {isDemoMode ? "Simulating Sync..." : "Syncing Events..."}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {isDemoMode ? "Simulate Event Sync" : "Sync Events Now"}
              </>
            )}
          </Button>
          
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg text-left mb-6">
          <h3 className="font-medium mb-2">
            {isDemoMode ? "Demo Sync Results:" : "Sync Results:"}
          </h3>
          {syncResults?.results?.length > 0 ? (
            <ul className="list-disc pl-5 text-sm">
              {syncResults.results.map((result: any, index: number) => (
                <li key={index} className="mb-1">
                  {result.clubName}: {result.action === 'added' ? 'Added new event' : result.error || 'No new events'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">No events were synced. Events may be up to date or clubs may not have any upcoming events.</p>
          )}
        </div>
      )}
      
      <div className="flex flex-col space-y-4 mt-6">
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
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { checkSyncStatus, triggerStravaSync } from '@/lib/strava';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useToast } from '@/hooks/use-toast';
import { LucideRefreshCw, LucideAlertCircle, LucideCheckCircle2 } from 'lucide-react';
import { connectWithStrava } from '@/lib/strava';

interface SyncStatusProps {
  className?: string;
  showControls?: boolean;
}

export function SyncStatusIndicator({ className, showControls = false }: SyncStatusProps) {
  const [syncInProgress, setSyncInProgress] = useState(false);
  const { toast } = useToast();

  // Fetch sync status
  const { 
    data: syncStatus, 
    isLoading, 
    isError, 
    refetch,
    error 
  } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: checkSyncStatus,
    refetchInterval: 60000, // Check every minute
    retry: 1
  });

  // Handle manual sync trigger
  const handleSyncTrigger = async () => {
    try {
      setSyncInProgress(true);
      const result = await triggerStravaSync();
      toast({
        title: "Sync Triggered",
        description: "Events are being synchronized in the background",
      });
      // Refetch the status after a short delay
      setTimeout(() => {
        refetch();
        setSyncInProgress(false);
      }, 2000);
    } catch (error) {
      console.error("Sync failed:", error);
      setSyncInProgress(false);
      toast({
        title: "Sync Failed",
        description: "Unable to synchronize events. Please try again later.",
        variant: "destructive"
      });
    }
  };

  // Handle Strava reconnection when token is expired
  const handleReconnectStrava = () => {
    connectWithStrava();
  };

  // Determine status display
  const getStatusDisplay = () => {
    if (isLoading) {
      return {
        icon: <LucideRefreshCw className="animate-spin h-4 w-4" />,
        text: "Checking sync status...",
        color: "text-yellow-500",
        needsAttention: false
      };
    }

    if (isError || !syncStatus) {
      return {
        icon: <LucideAlertCircle className="h-4 w-4" />,
        text: "Unable to check sync status",
        color: "text-red-500",
        needsAttention: true
      };
    }

    // Check if token is valid and present
    const hasToken = syncStatus.tokenStatus?.hasAccessToken && syncStatus.tokenStatus?.hasRefreshToken;
    const tokenValid = syncStatus.tokenStatus?.tokenValid;

    if (!hasToken || !tokenValid) {
      // Check if we're operating in limited functionality mode
      const processedWithoutStrava = syncStatus.syncStats?.processedWithoutStrava;
      
      if (processedWithoutStrava) {
        return {
          icon: <LucideAlertCircle className="h-4 w-4" />,
          text: "Limited sync (no Strava token)",
          color: "text-yellow-500",
          needsAttention: false,
          needsReconnect: false
        };
      }
      
      return {
        icon: <LucideAlertCircle className="h-4 w-4" />,
        text: "Strava connection needed",
        color: "text-red-500",
        needsAttention: true,
        needsReconnect: true
      };
    }

    if (syncStatus.syncServiceActive) {
      return {
        icon: <LucideCheckCircle2 className="h-4 w-4" />,
        text: "Auto-sync active",
        color: "text-green-500",
        needsAttention: false
      };
    }

    return {
      icon: <LucideAlertCircle className="h-4 w-4" />,
      text: "Sync service not running",
      color: "text-yellow-500",
      needsAttention: true
    };
  };

  const status = getStatusDisplay();

  // Show toast notification when token needs refresh
  useEffect(() => {
    if (status.needsReconnect) {
      toast({
        title: "Strava Connection Required",
        description: "Your Strava connection needs to be refreshed for automatic event updates.",
        variant: "destructive",
        duration: 10000
      });
    }
  }, [syncStatus?.tokenStatus?.tokenValid]);

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <div className={`flex items-center gap-2 ${status.color}`}>
        {status.icon}
        <span className="text-sm">{status.text}</span>
      </div>

      {showControls && (
        <div className="flex flex-wrap gap-2">
          {status.needsReconnect ? (
            <Button 
              size="sm" 
              onClick={handleReconnectStrava}
              className="text-xs"
            >
              Reconnect Strava
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleSyncTrigger} 
              disabled={syncInProgress || isLoading}
              className="text-xs"
            >
              {syncInProgress ? (
                <>
                  <LucideRefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <LucideRefreshCw className="mr-1 h-3 w-3" />
                  Sync Now
                </>
              )}
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => refetch()} 
            disabled={isLoading}
            className="text-xs"
          >
            Check Status
          </Button>
        </div>
      )}
    </div>
  );
}
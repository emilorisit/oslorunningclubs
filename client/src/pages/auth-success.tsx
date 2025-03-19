import { Link, useLocation } from 'wouter';
import { CheckCircle, ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { saveStravaToken } from '@/lib/strava';
import { AdUnit } from '@/components/ui/ad-unit';

// Define a type for Strava Club
interface StravaClub {
  id: number;
  name: string;
  profile_medium: string;
  url: string;
  member_count: number;
  selected?: boolean;
}

// Define a type for add club results
interface AddClubResult {
  id: number;
  name: string;
  status: 'added' | 'existing' | 'error';
  message: string;
}

export default function AuthSuccess() {
  const [error, setError] = useState<string | null>(null);
  const [location] = useLocation();
  
  // State for club selection
  const [isLoadingClubs, setIsLoadingClubs] = useState(false);
  const [availableClubs, setAvailableClubs] = useState<StravaClub[]>([]);
  const [isAddingClubs, setIsAddingClubs] = useState(false);
  const [addClubResults, setAddClubResults] = useState<AddClubResult[]>([]);
  const [showClubsSection, setShowClubsSection] = useState(true);
  
  // Extract token from URL and save to local storage
  useEffect(() => {
    const url = new URL(window.location.href);
    const accessToken = url.searchParams.get('access_token');
    const expiresAt = url.searchParams.get('expires_at');
    
    if (accessToken && expiresAt) {
      // Save token to local storage
      saveStravaToken(accessToken, expiresAt);
      console.log('Strava token saved to local storage');
      
      // Clean up URL by removing tokens
      const cleanUrl = '/auth-success';
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);
  
  // Function to load user's Strava clubs
  useEffect(() => {
    const loadClubs = async () => {
      if (!showClubsSection) return;
      
      setIsLoadingClubs(true);
      setError(null);
      
      try {
        const response = await axios.get('/api/strava/user-clubs');
        setAvailableClubs(response.data.map((club: StravaClub) => ({
          ...club,
          selected: false
        })));
      } catch (err) {
        console.error('Failed to load clubs', err);
        setError('Failed to load your Strava clubs. Please try again later.');
      } finally {
        setIsLoadingClubs(false);
      }
    };
    
    loadClubs();
  }, [showClubsSection]);
  
  // Handle club selection toggle
  const toggleClubSelection = (clubId: number) => {
    setAvailableClubs(clubs => 
      clubs.map(club => 
        club.id === clubId ? { ...club, selected: !club.selected } : club
      )
    );
  };
  
  // Handle adding selected clubs
  const handleAddSelectedClubs = async () => {
    const clubs = availableClubs.filter(club => club.selected);
    if (clubs.length === 0) {
      setError('Please select at least one club to add.');
      return;
    }
    
    setIsAddingClubs(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/strava/add-clubs', { clubs });
      setAddClubResults(response.data.results);
      setShowClubsSection(false);
    } catch (err) {
      console.error('Failed to add clubs', err);
      setError('Failed to add selected clubs. Please try again.');
    } finally {
      setIsAddingClubs(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
      <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
      
      <h1 className="font-heading font-bold text-2xl text-secondary mb-2">
        Successfully Connected with Strava
      </h1>
      
      <p className="text-muted mb-8">
        Your Strava account has been successfully connected.
      </p>
      
      {/* Club Selection Section */}
      {showClubsSection ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Select Your Running Clubs</h2>
          <p className="text-muted mb-4">
            Choose which of your Strava clubs you'd like to add to Oslo Running Calendar.
            Events from selected clubs will be synced immediately and updated automatically every night.
          </p>
          
          {isLoadingClubs ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading your clubs...</span>
            </div>
          ) : availableClubs.length > 0 ? (
            <>
              <div className="grid gap-4 mb-6">
                {availableClubs.map(club => (
                  <Card key={club.id} className={`transition-all ${club.selected ? 'border-primary' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <Checkbox 
                          id={`club-${club.id}`}
                          checked={club.selected}
                          onCheckedChange={() => toggleClubSelection(club.id)}
                          className="mr-4"
                        />
                        <Avatar className="mr-4 h-10 w-10">
                          <AvatarImage 
                            src={club.profile_medium || `/club-avatar-${club.id % 5}.png`} 
                            alt={club.name} 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = `/club-avatar-${club.id % 5}.png`;
                            }}
                          />
                          <AvatarFallback>{club.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{club.name}</div>
                          <div className="text-sm text-muted-foreground">
                            <Badge variant="outline" className="mr-2">
                              {club.member_count} members
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Button 
                onClick={handleAddSelectedClubs}
                disabled={isAddingClubs || availableClubs.filter(club => club.selected).length === 0}
                className="w-full"
              >
                {isAddingClubs ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding Clubs...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Selected Clubs
                  </>
                )}
              </Button>
              
              {error && (
                <p className="text-red-500 text-sm mt-2">{error}</p>
              )}
            </>
          ) : (
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-center text-muted">
                No clubs found in your Strava account. You need to be a member of at least one club on Strava to add it to the calendar.
              </p>
            </div>
          )}
        </div>
      ) : addClubResults.length > 0 ? (
        <div className="bg-gray-50 p-4 rounded-lg text-left mb-8">
          <h3 className="font-medium mb-2">Club Addition Results:</h3>
          <ul className="list-disc pl-5 text-sm">
            {addClubResults.map((result, index) => (
              <li key={index} className="mb-1">
                <strong>{result.name}:</strong> {result.message}
              </li>
            ))}
          </ul>
          
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Your clubs have been added and events have been synced. The system will automatically update events from these clubs every night.
            </p>
          </div>
        </div>
      ) : null}
      
      <div className="flex flex-col space-y-4 mt-6">
        <Link href="/calendar">
          <Button 
            variant="outline" 
            className="mx-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Calendar
          </Button>
        </Link>
        
        <Link href="/">
          <span className="text-sm text-primary hover:underline cursor-pointer">
            View Club Directory
          </span>
        </Link>
      </div>
      
      {/* Advertisement */}
      <div className="mt-10">
        <AdUnit 
          className="mx-auto max-w-4xl py-2 bg-gray-50 rounded-lg" 
          slot="5123456789"
          format="horizontal"
        />
      </div>
    </div>
  );
}
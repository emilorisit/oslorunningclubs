import { useState } from 'react';
import { Club } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { 
  getPaceCategoryLabel, 
  getDistanceRangeLabel, 
  getMeetingFrequencyLabel, 
  fetchClubs,
  formatLastEventDate,
  formatAvgParticipants
} from '@/lib/strava';
import { ExternalLink, Users, Calendar, Award, ArrowUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StravaConnect } from '@/components/ui/strava-connect';

const Clubs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByRanking, setSortByRanking] = useState(true);
  
  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['/api/clubs', sortByRanking ? 'score' : 'default'],
    queryFn: async () => {
      return fetchClubs(sortByRanking);
    }
  });
  
  // Filter clubs based on search term
  const filteredClubs = clubs.filter(club => 
    club.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSorting = () => {
    setSortByRanking(!sortByRanking);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="font-heading font-bold text-3xl text-secondary mb-4">Running Club Directory</h1>
        <p className="text-muted max-w-2xl mx-auto">
          Discover running clubs in Oslo that organize group runs. 
          Join their events through the Oslo Running Calendar.
        </p>
      </div>
      
      {/* Search and Sort Controls */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-auto sm:flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block w-full pl-10 p-2.5"
              placeholder="Search clubs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Button 
            variant="outline" 
            onClick={toggleSorting}
            className="w-full sm:w-auto"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Sort by {sortByRanking ? 'Name' : 'Activity Ranking'}
          </Button>
        </div>
      </div>
      
      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Clubs grid */}
          {filteredClubs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClubs.map((club, index) => (
                <div key={club.id} className="bg-white rounded-lg shadow overflow-hidden border border-gray-100 hover:border-primary transition-colors duration-200">
                  <div className="p-5">
                    {/* Ranking badge (only when sorting by score) */}
                    {sortByRanking && (
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="default" className="bg-primary text-primary-foreground">
                          Rank #{index + 1}
                        </Badge>
                        {club.clubScore !== undefined && club.clubScore > 0 && (
                          <div className="flex items-center">
                            <Award className="h-4 w-4 mr-1 text-amber-500" />
                            <span className="text-sm font-medium">{club.clubScore} pts</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <h2 className="font-heading font-bold text-xl text-secondary mb-2">{club.name}</h2>
                    
                    {/* Pace Categories */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {club.paceCategories.map(category => (
                        <span 
                          key={category} 
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white bg-${category}`}
                        >
                          {getPaceCategoryLabel(category)}
                        </span>
                      ))}
                    </div>
                    
                    {/* Activity Statistics */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-xs text-gray-700">
                          Last Event: {formatLastEventDate(club.lastEventDate)}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2 text-gray-500" />
                        <span className="text-xs text-gray-700">
                          {formatAvgParticipants(club.avgParticipants)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Club Details */}
                    <div className="space-y-2 text-sm text-muted">
                      <div>
                        <span className="font-medium">Distances:</span>{' '}
                        {club.distanceRanges.map(range => getDistanceRangeLabel(range)).join(', ')}
                      </div>
                      <div>
                        <span className="font-medium">Frequency:</span>{' '}
                        {getMeetingFrequencyLabel(club.meetingFrequency)}
                      </div>
                    </div>
                    
                    {/* Links */}
                    <div className="mt-4 flex gap-2">
                      <a 
                        href={club.stravaClubUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                      >
                        View on Strava
                        <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </a>
                      
                      {club.website && (
                        <a 
                          href={club.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm font-medium text-secondary hover:underline"
                        >
                          Website
                          <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                      )}
                    </div>
                    
                    {/* Strava Connect Button */}
                    <div className="mt-4">
                      <StravaConnect 
                        clubId={club.id} 
                        showCard={false} 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <svg className="h-16 w-16 text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 14h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-heading font-bold text-secondary mb-2">No clubs found</h2>
              <p className="text-muted">No running clubs match your search criteria.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Clubs;

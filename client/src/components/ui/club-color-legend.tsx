import React from 'react';
import { Club } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { getPaceCategoryLabel, getPaceCategoryColor, getPaceCategoryTextColor, isStravaAuthenticated } from '@/lib/strava';

// Set of predefined colors for clubs - must match those in big-calendar.tsx
const clubColors = [
  '#E53935', // Red
  '#8E24AA', // Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#00ACC1', // Cyan
  '#43A047', // Green
  '#FFB300', // Amber
  '#F4511E', // Deep Orange
  '#6D4C41', // Brown
  '#546E7A', // Blue Grey
  '#EC407A', // Pink
  '#7CB342', // Light Green
  '#039BE5', // Light Blue
  '#00897B', // Teal
  '#5E35B1', // Deep Purple
];

// Pace categories
const paceCategories = ['beginner', 'intermediate', 'advanced'];

interface ClubColorLegendProps {
  isAuthenticated?: boolean;
}

const ClubColorLegend: React.FC<ClubColorLegendProps> = ({ isAuthenticated: isAuthProp }) => {
  // Check if user is authenticated with Strava
  const isAuthenticated = isAuthProp !== undefined ? isAuthProp : isStravaAuthenticated();
  
  // Fetch clubs to build the legend
  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['/api/clubs'],
    queryFn: async () => {
      const response = await axios.get('/api/clubs');
      return response.data;
    }
  });

  if (isLoading || clubs.length === 0 || !isAuthenticated) {
    return null;
  }

  return (
    <div className="p-3 bg-white rounded-lg shadow mb-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Club colors */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Club Colors</h3>
          <div className="flex flex-wrap gap-2">
            {clubs.map((club: Club, index: number) => (
              <div key={club.id} className="flex items-center gap-1.5 mr-3 mb-1.5">
                <div 
                  className="w-4 h-4 flex-shrink-0 rounded-sm" 
                  style={{ backgroundColor: clubColors[index % clubColors.length] }}
                ></div>
                <span className="text-xs whitespace-nowrap">{club.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Pace categories */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Pace Level</h3>
          <div className="flex flex-wrap gap-2">
            {paceCategories.map((category) => (
              <div key={category} className="flex items-center gap-1.5 mr-3 mb-1.5">
                <div 
                  className={`w-4 h-4 flex-shrink-0 rounded-sm ${getPaceCategoryColor(category)} bg-opacity-20`}
                ></div>
                <span className={`text-xs whitespace-nowrap ${getPaceCategoryTextColor(category)}`}>
                  {getPaceCategoryLabel(category)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend explanation */}
      <div className="mt-2 text-xs text-gray-500">
        <p>Color legend: Clubs are shown with border color and pace level with background color on events</p>
      </div>
    </div>
  );
};

export default ClubColorLegend;
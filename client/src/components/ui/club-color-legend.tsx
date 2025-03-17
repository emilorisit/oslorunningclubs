import React from 'react';
import { Club } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

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

const ClubColorLegend: React.FC = () => {
  // Fetch clubs to build the legend
  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['/api/clubs'],
    queryFn: async () => {
      const response = await axios.get('/api/clubs');
      return response.data;
    }
  });

  if (isLoading || clubs.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-white rounded-lg shadow mb-3">
      <h3 className="text-sm font-semibold mb-2">Klubbfarger</h3>
      <div className="flex flex-wrap gap-3">
        {clubs.map((club: Club, index: number) => (
          <div key={club.id} className="flex items-center gap-1.5 mr-3">
            <div 
              className="w-3 h-3 flex-shrink-0 rounded-sm" 
              style={{ backgroundColor: clubColors[index % clubColors.length] }}
            ></div>
            <span className="text-xs whitespace-nowrap">{club.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClubColorLegend;
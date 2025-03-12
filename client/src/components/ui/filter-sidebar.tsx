import { useEffect, useState } from 'react';
import { EventFilters, Club } from '@/lib/types';
import { 
  getPaceCategoryLabel, 
  getDistanceRangeLabel 
} from '@/lib/strava';

interface FilterSidebarProps {
  filters: EventFilters;
  clubs: Club[];
  onChange: (filters: EventFilters) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ 
  filters, 
  clubs, 
  onChange 
}) => {
  const [localFilters, setLocalFilters] = useState<EventFilters>(filters);
  const [showAllClubs, setShowAllClubs] = useState(false);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handlePaceCategoryChange = (category: string, checked: boolean) => {
    const updatedCategories = checked
      ? [...(localFilters.paceCategories || []), category]
      : (localFilters.paceCategories || []).filter(c => c !== category);
    
    setLocalFilters(prev => ({
      ...prev,
      paceCategories: updatedCategories
    }));
  };

  const handleDistanceRangeChange = (range: string, checked: boolean) => {
    const updatedRanges = checked
      ? [...(localFilters.distanceRanges || []), range]
      : (localFilters.distanceRanges || []).filter(r => r !== range);
    
    setLocalFilters(prev => ({
      ...prev,
      distanceRanges: updatedRanges
    }));
  };

  const handleClubChange = (clubId: number, checked: boolean) => {
    const updatedClubs = checked
      ? [...(localFilters.clubIds || []), clubId]
      : (localFilters.clubIds || []).filter(id => id !== clubId);
    
    setLocalFilters(prev => ({
      ...prev,
      clubIds: updatedClubs
    }));
  };

  const handleBeginnerFriendlyChange = (checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      beginnerFriendly: checked
    }));
  };

  const applyFilters = () => {
    onChange(localFilters);
  };

  // Club list display logic
  const displayedClubs = showAllClubs ? clubs : clubs.slice(0, 4);

  return (
    <div className="lg:w-64 flex-shrink-0 mb-6 lg:mb-0 lg:mr-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-heading font-semibold text-lg text-secondary mb-4">Filters</h3>
        
        {/* Pace Category Filter */}
        <div className="mb-4">
          <h4 className="font-medium text-secondary mb-2">Pace Category</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                className="rounded text-beginner focus:ring-beginner" 
                checked={localFilters.paceCategories?.includes('beginner')}
                onChange={(e) => handlePaceCategoryChange('beginner', e.target.checked)}
              />
              <span className="ml-2 inline-flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-beginner mr-1"></span>
                {getPaceCategoryLabel('beginner')}
              </span>
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                className="rounded text-intermediate focus:ring-intermediate" 
                checked={localFilters.paceCategories?.includes('intermediate')}
                onChange={(e) => handlePaceCategoryChange('intermediate', e.target.checked)}
              />
              <span className="ml-2 inline-flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-intermediate mr-1"></span>
                {getPaceCategoryLabel('intermediate')}
              </span>
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                className="rounded text-advanced focus:ring-advanced" 
                checked={localFilters.paceCategories?.includes('advanced')}
                onChange={(e) => handlePaceCategoryChange('advanced', e.target.checked)}
              />
              <span className="ml-2 inline-flex items-center">
                <span className="inline-block w-3 h-3 rounded-full bg-advanced mr-1"></span>
                {getPaceCategoryLabel('advanced')}
              </span>
            </label>
          </div>
        </div>
        
        {/* Distance Range Filter */}
        <div className="mb-4">
          <h4 className="font-medium text-secondary mb-2">Distance</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                className="rounded text-primary focus:ring-primary" 
                checked={localFilters.distanceRanges?.includes('short')}
                onChange={(e) => handleDistanceRangeChange('short', e.target.checked)}
              />
              <span className="ml-2">{getDistanceRangeLabel('short')}</span>
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                className="rounded text-primary focus:ring-primary" 
                checked={localFilters.distanceRanges?.includes('medium')}
                onChange={(e) => handleDistanceRangeChange('medium', e.target.checked)}
              />
              <span className="ml-2">{getDistanceRangeLabel('medium')}</span>
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                className="rounded text-primary focus:ring-primary" 
                checked={localFilters.distanceRanges?.includes('long')}
                onChange={(e) => handleDistanceRangeChange('long', e.target.checked)}
              />
              <span className="ml-2">{getDistanceRangeLabel('long')}</span>
            </label>
          </div>
        </div>
        
        {/* Clubs Filter */}
        <div className="mb-4">
          <h4 className="font-medium text-secondary mb-2">Clubs</h4>
          <div className="space-y-2">
            {displayedClubs.map(club => (
              <label key={club.id} className="flex items-center">
                <input 
                  type="checkbox" 
                  className="rounded text-primary focus:ring-primary" 
                  checked={localFilters.clubIds?.includes(club.id)}
                  onChange={(e) => handleClubChange(club.id, e.target.checked)}
                />
                <span className="ml-2">{club.name}</span>
              </label>
            ))}
          </div>
          {clubs.length > 4 && (
            <button 
              onClick={() => setShowAllClubs(!showAllClubs)}
              className="text-primary text-sm font-medium hover:underline mt-2 inline-block"
            >
              {showAllClubs ? 'Show less' : 'Show all clubs'}
            </button>
          )}
        </div>
        
        {/* Beginner Friendly Filter */}
        <div className="mb-4">
          <label className="flex items-center">
            <input 
              type="checkbox" 
              className="rounded text-beginner focus:ring-beginner"
              checked={localFilters.beginnerFriendly}
              onChange={(e) => handleBeginnerFriendlyChange(e.target.checked)}
            />
            <span className="ml-2 font-medium">Beginner friendly only</span>
          </label>
        </div>
        
        <button 
          className="w-full bg-primary hover:bg-opacity-90 text-white font-medium py-2 px-4 rounded"
          onClick={applyFilters}
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterSidebar;

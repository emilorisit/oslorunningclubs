import { useEffect, useState } from 'react';
import { EventFilters, Club } from '@/lib/types';
import { 
  getPaceCategoryLabel, 
  getDistanceRangeLabel,
  isStravaAuthenticated
} from '@/lib/strava';
import { ChevronDown, ChevronUp, Filter, AlertCircle } from 'lucide-react';
import { SiStrava } from 'react-icons/si';

interface FilterSidebarProps {
  filters: EventFilters;
  clubs: Club[];
  onUpdateFilters: (filters: EventFilters) => void;
  onClearFilters: () => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ 
  filters, 
  clubs, 
  onUpdateFilters,
  onClearFilters
}) => {
  const [localFilters, setLocalFilters] = useState<EventFilters>(filters);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handlePaceCategoryChange = (category: string, checked: boolean) => {
    const updatedCategories = checked
      ? [...(localFilters.paceCategories || []), category as any]
      : (localFilters.paceCategories || []).filter(c => c !== category);
    
    setLocalFilters(prev => ({
      ...prev,
      paceCategories: updatedCategories as any
    }));
  };

  const handleDistanceRangeChange = (range: string, checked: boolean) => {
    const updatedRanges = checked
      ? [...(localFilters.distanceRanges || []), range as any]
      : (localFilters.distanceRanges || []).filter(r => r !== range);
    
    setLocalFilters(prev => ({
      ...prev,
      distanceRanges: updatedRanges as any
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

  const handleIntervalTrainingChange = (checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      isIntervalTraining: checked
    }));
  };

  const applyFilters = () => {
    onUpdateFilters(localFilters);
  };
  
  const resetFilters = () => {
    onClearFilters();
  };

  // Club list display logic
  const displayedClubs = showAllClubs ? clubs : clubs.slice(0, 4);
  
  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localFilters.paceCategories && localFilters.paceCategories.length > 0 && 
        localFilters.paceCategories.length < 3) {
      count += localFilters.paceCategories.length;
    }
    if (localFilters.distanceRanges && localFilters.distanceRanges.length > 0 && 
        localFilters.distanceRanges.length < 3) {
      count += localFilters.distanceRanges.length;
    }
    if (localFilters.clubIds && localFilters.clubIds.length > 0) {
      count += localFilters.clubIds.length;
    }
    if (localFilters.beginnerFriendly) {
      count += 1;
    }
    if (localFilters.isIntervalTraining) {
      count += 1;
    }
    return count;
  };

  const activeFilterCount = countActiveFilters();

  return (
    <div className="lg:w-64 flex-shrink-0 mb-6 lg:mb-0 lg:mr-6">
      {/* Filter Toggle Button */}
      <button 
        id="filters-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-white rounded-lg shadow p-4 flex justify-between items-center mb-2"
      >
        <div className="flex items-center">
          <Filter className="h-5 w-5 mr-2 text-secondary" />
          <span className="font-heading font-semibold text-lg text-secondary">Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs font-medium rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-secondary" />
        ) : (
          <ChevronDown className="h-5 w-5 text-secondary" />
        )}
      </button>
      
      {/* Filter Panel - Hidden by Default */}
      {isExpanded && (
        <div className="bg-white rounded-lg shadow p-4">
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
            <h4 className="font-medium text-secondary mb-2">Running Clubs</h4>
            
            {/* Show authentication notice if not connected to Strava */}
            {!isStravaAuthenticated() && (
              <div className="bg-amber-50 p-2 rounded-md text-amber-800 text-sm mb-3 flex items-start">
                <SiStrava className="text-[#FC4C02] h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0" />
                <span>
                  Due to Strava API regulations, events from clubs you select will only be visible if you connect your Strava account and are a member of those clubs.
                </span>
              </div>
            )}
            
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
          
          <div className="flex flex-col space-y-2">
            <button 
              className="w-full bg-primary hover:bg-opacity-90 text-white font-medium py-2 px-4 rounded"
              onClick={applyFilters}
            >
              Apply Filters
            </button>
            
            {activeFilterCount > 0 && (
              <button 
                className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded"
                onClick={resetFilters}
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSidebar;

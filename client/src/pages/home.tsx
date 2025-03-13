import CalendarView from '@/components/ui/calendar-view';
import { AdUnit } from '@/components/ui/ad-unit';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover and join Oslo's running community. Connect with Strava to find events or add your club to our directory.
        </p>
      </div>
      
      {/* Top advertisement */}
      <div className="mb-8">
        <AdUnit 
          className="mx-auto max-w-4xl py-2 bg-gray-50 rounded-lg" 
          slot="8123456789"
          format="horizontal"
        />
      </div>
      
      <CalendarView />
      
      {/* Bottom advertisement */}
      <div className="mt-10">
        <AdUnit 
          className="mx-auto max-w-4xl py-2 bg-gray-50 rounded-lg" 
          slot="7123456789"
          format="horizontal"
        />
      </div>
    </div>
  );
};

export default Home;

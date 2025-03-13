import CalendarView from '@/components/ui/calendar-view';
import { AdUnit } from '@/components/ui/ad-unit';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Users } from 'lucide-react';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Oslo Running Calendar</h1>
        <div className="inline-flex items-center justify-center mb-4">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500 text-white mr-2">ALPHA VERSION</span>
          <span className="text-sm text-muted">Under active development - features and data may change</span>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          Discover and join Oslo's running community. View the calendar to find events or visit our club directory.
        </p>
        
        {/* Club Directory Button */}
        <div className="max-w-md mx-auto mb-8">
          <Link href="/clubs">
            <Button variant="outline" className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Browse Running Clubs
            </Button>
          </Link>
        </div>
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

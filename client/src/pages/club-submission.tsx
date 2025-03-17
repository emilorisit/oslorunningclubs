import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { StravaConnect } from '@/components/ui/strava-connect';
import { AdUnit } from '@/components/ui/ad-unit';

const ClubSubmission = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/calendar">
          <span className="inline-flex items-center text-primary hover:text-primary-dark cursor-pointer">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Calendar
          </span>
        </Link>
      </div>
      
      <div className="text-center mb-8">
        <h1 className="font-heading font-bold text-3xl text-secondary mb-4">Add Your Club to the Directory</h1>
        <p className="text-muted max-w-2xl mx-auto">
          To add your running club to our directory, visit the calendar page and connect with Strava.
          Your club will be added to our directory and events will be automatically synced nightly.
        </p>
      </div>
      
      <div className="flex justify-center">
        <Link href="/calendar">
          <span className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-md hover:bg-primary-dark transition-colors cursor-pointer">
            Go to Calendar
            <ArrowLeft className="h-4 w-4 ml-2 transform rotate-180" />
          </span>
        </Link>
      </div>
      
      <div className="mt-8 max-w-2xl mx-auto">
        <h2 className="font-heading font-semibold text-xl text-secondary mb-4">How It Works</h2>
        <ol className="list-decimal pl-5 space-y-2 text-muted">
          <li>Visit the calendar page and connect your Strava account using the button in the top-right corner</li>
          <li>Select which of your Strava clubs you'd like to add to our directory</li>
          <li>Events from your selected clubs will automatically appear in the calendar</li>
          <li>Our system syncs with Strava every night to keep events up-to-date</li>
          <li>All users can see your club in the directory, even if they're not connected to Strava</li>
        </ol>
      </div>
      
      {/* Advertisement */}
      <div className="mt-16 max-w-3xl mx-auto">
        <AdUnit 
          className="mx-auto py-2 bg-gray-50 rounded-lg" 
          slot="7123456789"
          format="horizontal"
        />
      </div>
    </div>
  );
};

export default ClubSubmission;

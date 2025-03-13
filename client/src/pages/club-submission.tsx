import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { StravaConnect } from '@/components/ui/strava-connect';

const ClubSubmission = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/">
          <a className="inline-flex items-center text-primary hover:text-primary-dark">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Calendar
          </a>
        </Link>
      </div>
      
      <div className="text-center mb-8">
        <h1 className="font-heading font-bold text-3xl text-secondary mb-4">Connect with Strava</h1>
        <p className="text-muted max-w-2xl mx-auto">
          Connect your Strava account to access your running clubs and view their events in the calendar.
          You can add new clubs or sync existing ones with just a few clicks.
        </p>
      </div>
      
      <div className="max-w-md mx-auto">
        <StravaConnect 
          showCard={true}
          title="Connect with Strava"
          description="Get started by connecting your Strava account to Oslo Running Calendar."
        />
      </div>
      
      <div className="mt-8 max-w-2xl mx-auto">
        <h2 className="font-heading font-semibold text-xl text-secondary mb-4">How It Works</h2>
        <ol className="list-decimal pl-5 space-y-2 text-muted">
          <li>Connect your Strava account using the button above</li>
          <li>If you're a new user, you'll be asked to select which of your Strava clubs you'd like to add</li>
          <li>If you've connected before, you'll see your clubs and can add new ones</li>
          <li>Events from your selected clubs will automatically appear in the calendar</li>
          <li>Synchronization happens automatically to keep events up-to-date</li>
        </ol>
      </div>
    </div>
  );
};

export default ClubSubmission;

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
        <h1 className="font-heading font-bold text-3xl text-secondary mb-4">Add Your Club</h1>
        <p className="text-muted max-w-2xl mx-auto">
          Help grow the Oslo running community by adding your club to our calendar. 
          Once approved, your club's events will be visible to runners looking for group runs.
        </p>
      </div>
      
      <div className="max-w-md mx-auto">
        <StravaConnect 
          showCard={true}
          title="Connect with Strava"
          description="Connect your Strava account to add your running clubs to Oslo Running Calendar."
        />
      </div>
      
      <div className="mt-8 max-w-2xl mx-auto">
        <h2 className="font-heading font-semibold text-xl text-secondary mb-4">How It Works</h2>
        <ol className="list-decimal pl-5 space-y-2 text-muted">
          <li>Connect your Strava account using the button above</li>
          <li>Select which of your Strava clubs you'd like to add</li>
          <li>Our system will automatically import and sync your club's events</li>
          <li>Your club events will appear in the calendar immediately</li>
        </ol>
      </div>
    </div>
  );
};

export default ClubSubmission;

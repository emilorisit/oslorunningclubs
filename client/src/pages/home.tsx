import CalendarView from '@/components/ui/calendar-view';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Oslo Running Clubs</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Connect your Strava to easily plan your week of various running clubs events. 
          Adding your club will also add it to the overview of active running clubs in Oslo, 
          found on the page Clubs.
        </p>
      </div>
      <CalendarView />
    </div>
  );
};

export default Home;

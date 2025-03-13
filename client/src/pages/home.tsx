import CalendarView from '@/components/ui/calendar-view';

const Home = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover and join Oslo's running community. Connect with Strava to find events or add your club to our directory.
        </p>
      </div>
      <CalendarView />
    </div>
  );
};

export default Home;

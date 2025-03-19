import { Link } from 'wouter';
import { AdUnit } from '@/components/ui/ad-unit';

const Footer = () => {
  return (
    <>
      {/* Footer Ad */}
      <div className="bg-gray-100 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AdUnit 
            className="mx-auto py-2 rounded-lg" 
            slot="4123456789"
            format="horizontal"
          />
        </div>
      </div>
      
      <footer className="bg-gray-800 text-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-heading font-semibold text-lg mb-4 text-white">Oslo Running Clubs</h3>
              <p className="text-gray-200 text-sm">
                A community platform aggregating running events from Strava clubs in Oslo, making it easier for runners to discover and join group runs.
              </p>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg mb-4 text-white">Quick Links</h3>
              <ul className="space-y-2 text-gray-200 text-sm">
                <li><Link href="/calendar"><span className="hover:text-white cursor-pointer">Calendar</span></Link></li>
                <li><Link href="/"><span className="hover:text-white cursor-pointer">Club Directory</span></Link></li>
                <li><Link href="/club-submission"><span className="hover:text-white cursor-pointer">Add Your Club</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-white cursor-pointer">Privacy Policy</span></Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg mb-4 text-white">About</h3>
              <p className="text-sm text-gray-200">
                &copy; {new Date().getFullYear()} Oslo Running Clubs<br/>
                Powered by the Strava API<br/>
                <span className="inline-flex items-center mt-1">
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white mr-1">ALPHA</span>
                  <span>This site is in alpha release</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;

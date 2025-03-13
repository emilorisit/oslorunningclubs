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
      
      <footer className="bg-secondary text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-heading font-semibold text-lg mb-4">Oslo Running Calendar</h3>
              <p className="text-gray-300 text-sm">
                A community platform aggregating running events from Strava clubs in Oslo, making it easier for runners to discover and join group runs.
              </p>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li><Link href="/"><span className="hover:text-white cursor-pointer">Calendar</span></Link></li>
                <li><Link href="/clubs"><span className="hover:text-white cursor-pointer">Club Directory</span></Link></li>
                <li><Link href="/submit-club"><span className="hover:text-white cursor-pointer">Submit Your Club</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-white cursor-pointer">Privacy Policy</span></Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg mb-4">Connect</h3>
              <div className="flex space-x-4 mb-4">
                <a href="#" className="text-gray-300 hover:text-white">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.163 6.839 9.489.5.09.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.578.688.48A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25zM12 7a5 5 0 0 1 5.5 5.78 8.5 8.5 0 0 1-8.4 6.22c-2.5 0-4.6-1.14-5.1-2.72A5 5 0 0 1 12 7zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
                  </svg>
                </a>
                <a href="#" className="text-gray-300 hover:text-white">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm13 2h-2.5A3.5 3.5 0 0 0 12 8.5V11h-2v3h2v7h3v-7h3v-3h-3V9a1 1 0 0 1 1-1h2V5z"/>
                  </svg>
                </a>
              </div>
              <p className="text-sm text-gray-300">
                &copy; {new Date().getFullYear()} Oslo Running Calendar<br/>
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

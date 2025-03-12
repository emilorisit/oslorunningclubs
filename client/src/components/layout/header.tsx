import { useState } from 'react';
import { Link } from 'wouter';
import { Menu, X } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center">
        <div className="flex items-center mb-4 sm:mb-0">
          <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.6569 16.6569C16.7202 17.5935 15.4995 18.2022 14.1547 18.3974C12.8099 18.5926 11.4351 18.3648 10.2318 17.7474C9.02836 17.1301 8.05296 16.1547 7.43559 14.9513C6.81822 13.748 6.59044 12.3732 6.78558 11.0284C6.98071 9.68366 7.58939 8.46295 8.52601 7.52633C9.46264 6.58971 10.6834 5.98103 12.0281 5.78589C13.3729 5.59075 14.7477 5.81854 15.9511 6.43591C17.1544 7.05328 18.1298 8.02868 18.7472 9.23204" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M17.5 11.5L19.5 9.5L21.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 7V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <Link href="/">
            <a className="ml-2 font-heading font-bold text-2xl text-secondary">Oslo Running Calendar</a>
          </Link>
        </div>
        
        {/* Mobile menu button */}
        <div className="sm:hidden">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-secondary focus:outline-none"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        
        {/* Desktop navigation */}
        <nav className="hidden sm:flex space-x-4">
          <Link href="/">
            <a className="px-3 py-2 text-secondary hover:text-primary font-medium rounded-md">Calendar</a>
          </Link>
          <Link href="/clubs">
            <a className="px-3 py-2 text-secondary hover:text-primary font-medium rounded-md">Clubs</a>
          </Link>
          <Link href="/submit-club">
            <a className="px-3 py-2 bg-primary text-white font-medium rounded-md">Submit Club</a>
          </Link>
        </nav>
        
        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="sm:hidden w-full">
            <div className="flex flex-col space-y-2 mt-4">
              <Link href="/">
                <a className="px-3 py-2 text-secondary hover:text-primary font-medium rounded-md">Calendar</a>
              </Link>
              <Link href="/clubs">
                <a className="px-3 py-2 text-secondary hover:text-primary font-medium rounded-md">Clubs</a>
              </Link>
              <Link href="/submit-club">
                <a className="px-3 py-2 bg-primary text-white font-medium rounded-md text-center">Submit Club</a>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

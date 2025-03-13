import { Link } from 'wouter';

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 mb-8">
        <h1 className="font-heading font-bold text-3xl text-secondary mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-muted-foreground">
          <p>
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Introduction</h2>
            <p>
              Oslo Running Calendar ("we", "our", or "us") respects your privacy and is committed to protecting your personal data. 
              This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights.
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Information We Collect</h2>
            <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Identity Data: includes username, name as provided in your Strava profile.</li>
              <li>Contact Data: includes email address if provided during club submission.</li>
              <li>Technical Data: includes internet protocol (IP) address, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access our website.</li>
              <li>Usage Data: includes information about how you use our website.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Analytics</h2>
            <p>
              We use Google Analytics to help us understand how our users use the site. Google Analytics uses cookies and other tracking technologies to collect and store information such as the pages visited, the time spent on the site, and the clicked links.
            </p>
            <p className="mt-2">
              For more information on how Google uses your data when you use our site, please visit: 
              <a 
                href="https://policies.google.com/technologies/partner-sites" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Google Partner Sites
              </a>
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Advertising</h2>
            <p>
              We use Google AdSense to display advertisements on our website. Google AdSense may use cookies and web beacons to collect data about your visit to our website and other websites, such as the pages you visited, content you accessed, and the searches you conducted.
            </p>
            <p className="mt-2">
              The data is used to serve you with interest-based advertising that is relevant to you. For more information on Google AdSense, please visit: 
              <a 
                href="https://support.google.com/adsense/answer/1348695" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                Google AdSense Overview
              </a>
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Strava API</h2>
            <p>
              Our service integrates with Strava through their API. When you connect your Strava account, we may collect certain information from your Strava profile such as your username, profile picture, club memberships, and club events. We use this information to provide our core service of aggregating and displaying running events.
            </p>
            <p className="mt-2">
              We do not store your Strava login credentials. Authentication is handled securely through Strava's OAuth 2.0 process.
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Cookie Policy</h2>
            <p>
              Our website uses cookies to distinguish you from other users of our website. This helps us to provide you with a good experience when you browse our website and also allows us to improve our site.
            </p>
            <p className="mt-2">
              You can set your browser to refuse all or some browser cookies, or to alert you when websites set or access cookies. If you disable or refuse cookies, please note that some parts of this website may become inaccessible or not function properly.
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Your Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal data, including:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>The right to access your personal data</li>
              <li>The right to rectification of your personal data</li>
              <li>The right to erasure of your personal data</li>
              <li>The right to restrict processing of your personal data</li>
              <li>The right to data portability</li>
              <li>The right to object to processing of your personal data</li>
            </ul>
            <p className="mt-2">
              If you wish to exercise any of these rights, please contact us using the information provided below.
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Changes to This Privacy Policy</h2>
            <p>
              We may update our privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date at the top of this policy.
            </p>
            <p className="mt-2">
              You are advised to review this privacy policy periodically for any changes. Changes to this privacy policy are effective when they are posted on this page.
            </p>
          </section>
          
          <section>
            <h2 className="font-heading font-semibold text-xl text-secondary mb-3">Contact Us</h2>
            <p>
              If you have any questions about this privacy policy, please contact us at:
            </p>
            <p className="mt-2 font-medium">Email: support@oslorunningcalendar.com</p>
          </section>
        </div>
        
        <div className="mt-8">
          <Link href="/">
            <span className="inline-flex items-center text-primary hover:underline cursor-pointer">
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Home
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
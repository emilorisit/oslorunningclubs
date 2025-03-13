import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ClubSubmission from "@/pages/club-submission";
import Clubs from "@/pages/clubs";
import AuthSuccess from "@/pages/auth-success";
import AuthError from "@/pages/auth-error";
import Privacy from "@/pages/privacy";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

function Router() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/clubs" component={Clubs} />
          <Route path="/submit-club" component={ClubSubmission} />
          <Route path="/auth-success" component={AuthSuccess} />
          <Route path="/auth-error" component={AuthError} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/club-verification-success">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="bg-white p-8 rounded-lg shadow">
                <h1 className="text-2xl font-heading font-bold text-green-600 mb-4">Verification Successful!</h1>
                <p className="mb-4">Thank you for verifying your club. Your submission will be reviewed by our administrators and added to the calendar soon.</p>
                <a href="/" className="inline-block bg-primary text-white font-medium py-2 px-4 rounded">Return to Home</a>
              </div>
            </div>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}

export default App;

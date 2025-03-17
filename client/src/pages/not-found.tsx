import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { AdUnit } from '@/components/ui/ad-unit';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center">
      <Card className="w-full max-w-md mx-4 mb-8">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 mb-4 text-sm text-gray-600">
            Sorry, we couldn't find the page you were looking for. It might have been moved or deleted.
          </p>
          
          <div className="flex gap-4 mt-6">
            <Link href="/">
              <span className="text-primary hover:underline cursor-pointer">Go to Home</span>
            </Link>
            <Link href="/calendar">
              <span className="text-primary hover:underline cursor-pointer">View Calendar</span>
            </Link>
          </div>
        </CardContent>
      </Card>
      
      {/* Advertisement */}
      <div className="w-full max-w-md">
        <AdUnit 
          className="mx-auto py-2 bg-gray-50 rounded-lg" 
          slot="6123456789"
          format="rectangle"
        />
      </div>
    </div>
  );
}

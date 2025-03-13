import { Button } from '@/components/ui/button';
import { SiStrava } from 'react-icons/si';

interface StravaButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

export function StravaButton({ onClick, isLoading }: StravaButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={isLoading}
      className="w-full bg-[#FC4C02] hover:bg-[#FC4C02]/90 text-white"
    >
      <SiStrava className="mr-2 h-4 w-4" />
      {isLoading ? 'Connecting...' : 'Connect with Strava'}
    </Button>
  );
}
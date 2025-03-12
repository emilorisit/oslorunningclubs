import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Club submission form schema
const clubFormSchema = z.object({
  name: z.string().min(2, { message: 'Club name must be at least 2 characters' }),
  stravaClubUrl: z.string()
    .url({ message: 'Must be a valid URL' })
    .includes('strava.com/clubs/', { message: 'Must be a valid Strava club URL' }),
  adminEmail: z.string().email({ message: 'Must be a valid email address' }),
  website: z.string().url({ message: 'Must be a valid URL' }).optional().or(z.literal('')),
  paceCategories: z.array(z.string()).min(1, { message: 'Select at least one pace category' }),
  distanceRanges: z.array(z.string()).min(1, { message: 'Select at least one distance range' }),
  meetingFrequency: z.string({ required_error: 'Please select a meeting frequency' })
});

type ClubFormValues = z.infer<typeof clubFormSchema>;

const ClubForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<ClubFormValues>({
    resolver: zodResolver(clubFormSchema),
    defaultValues: {
      name: '',
      stravaClubUrl: '',
      adminEmail: '',
      website: '',
      paceCategories: [],
      distanceRanges: [],
      meetingFrequency: 'weekly'
    }
  });

  const onSubmit = async (data: ClubFormValues) => {
    setIsSubmitting(true);
    try {
      await apiRequest('POST', '/api/clubs', data);
      
      setSubmitSuccess(true);
      toast({
        title: 'Club submitted successfully',
        description: 'Please check your email to verify your submission.',
        variant: 'default'
      });
      
      form.reset();
    } catch (error) {
      console.error('Error submitting club:', error);
      toast({
        title: 'Error submitting club',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
      {submitSuccess ? (
        <div className="text-center py-8">
          <svg className="h-16 w-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-heading font-bold text-secondary mb-2">Submission Received</h2>
          <p className="mb-6 text-muted">
            Thank you for submitting your club! Please check your email for a verification link to complete the process.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setSubmitSuccess(false)}
          >
            Submit Another Club
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="font-heading font-bold text-2xl text-secondary">Submit Your Club</h2>
            <p className="text-muted">Add your Strava club to the Oslo Running Calendar</p>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Club Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Club Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Oslo Runners" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Strava Club URL */}
              <FormField
                control={form.control}
                name="stravaClubUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strava Club URL *</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.strava.com/clubs/..." {...field} />
                    </FormControl>
                    <p className="text-xs text-muted mt-1">Ensure your club is public on Strava</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Admin Contact Email */}
              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Contact Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@example.com" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted mt-1">We'll send a verification email to this address</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Website URL */}
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://www.yourclubsite.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Pace Category */}
              <FormField
                control={form.control}
                name="paceCategories"
                render={() => (
                  <FormItem>
                    <div className="mb-2">
                      <FormLabel>Pace Category *</FormLabel>
                    </div>
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="paceCategories"
                        render={({ field }) => {
                          return (
                            <>
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('beginner')}
                                    onCheckedChange={(checked) => {
                                      const current = [...field.value];
                                      if (checked) {
                                        field.onChange([...current, 'beginner']);
                                      } else {
                                        field.onChange(current.filter(val => val !== 'beginner'));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  <span className="inline-block w-3 h-3 rounded-full bg-beginner mr-1"></span>
                                  Beginner (&gt;6:00/km)
                                </FormLabel>
                              </FormItem>
                              
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('intermediate')}
                                    onCheckedChange={(checked) => {
                                      const current = [...field.value];
                                      if (checked) {
                                        field.onChange([...current, 'intermediate']);
                                      } else {
                                        field.onChange(current.filter(val => val !== 'intermediate'));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  <span className="inline-block w-3 h-3 rounded-full bg-intermediate mr-1"></span>
                                  Intermediate (5:00-6:00/km)
                                </FormLabel>
                              </FormItem>
                              
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('advanced')}
                                    onCheckedChange={(checked) => {
                                      const current = [...field.value];
                                      if (checked) {
                                        field.onChange([...current, 'advanced']);
                                      } else {
                                        field.onChange(current.filter(val => val !== 'advanced'));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  <span className="inline-block w-3 h-3 rounded-full bg-advanced mr-1"></span>
                                  Advanced (&lt;5:00/km)
                                </FormLabel>
                              </FormItem>
                            </>
                          );
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Typical Running Distances */}
              <FormField
                control={form.control}
                name="distanceRanges"
                render={() => (
                  <FormItem>
                    <div className="mb-2">
                      <FormLabel>Typical Running Distances *</FormLabel>
                    </div>
                    <div className="space-y-2">
                      <FormField
                        control={form.control}
                        name="distanceRanges"
                        render={({ field }) => {
                          return (
                            <>
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('short')}
                                    onCheckedChange={(checked) => {
                                      const current = [...field.value];
                                      if (checked) {
                                        field.onChange([...current, 'short']);
                                      } else {
                                        field.onChange(current.filter(val => val !== 'short'));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  Short (&lt; 5km)
                                </FormLabel>
                              </FormItem>
                              
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('medium')}
                                    onCheckedChange={(checked) => {
                                      const current = [...field.value];
                                      if (checked) {
                                        field.onChange([...current, 'medium']);
                                      } else {
                                        field.onChange(current.filter(val => val !== 'medium'));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  Medium (5-10km)
                                </FormLabel>
                              </FormItem>
                              
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes('long')}
                                    onCheckedChange={(checked) => {
                                      const current = [...field.value];
                                      if (checked) {
                                        field.onChange([...current, 'long']);
                                      } else {
                                        field.onChange(current.filter(val => val !== 'long'));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  Long (&gt; 10km)
                                </FormLabel>
                              </FormItem>
                            </>
                          );
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Meeting Frequency */}
              <FormField
                control={form.control}
                name="meetingFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Frequency *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="twice_a_week">Twice a week</SelectItem>
                        <SelectItem value="multiple_times_per_week">Multiple times per week</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="irregular">Irregular schedule</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Club for Review'}
                </Button>
                <p className="text-xs text-center text-muted mt-2">
                  By submitting, you confirm that you are authorized to add this club and agree to our terms.
                </p>
              </div>
            </form>
          </Form>
        </>
      )}
    </div>
  );
};

export default ClubForm;

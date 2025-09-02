"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card } from "~/presentation/components/ui";
import { CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/presentation/components/ui";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Form, FormField, FormSlider, FormInput, FormSubmit } from "~/presentation/components/forms";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { 
  User, 
  Settings, 
  AlertCircle, 
  Save,
  Clock,
  DollarSign,
  Home,
  MapPin,
  Calendar,
  Info,
  Building2,
  Footprints,
  Target
} from "lucide-react";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Get user preferences
  const { data: userPreferences, isLoading } = api.user.getPreferences.useQuery(
    undefined,
    { 
      enabled: status === 'authenticated',
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  // State for preference weights
  const [preferences, setPreferences] = useState({
    commuteTimeWeight: 25,
    priceWeight: 25,
    sizeWeight: 20,
    ageWeight: 10,
    floorWeight: 10,
    walkTimeWeight: 10,
  });
  
  // State for target values
  const [targetValues, setTargetValues] = useState({
    targetPrice: 100000,
    targetSize: 40,
    targetCommute: 30,
    targetAge: 10,
    targetFloor: 3,
    targetWalkTime: 5,
  });

  // Initialize preferences from user data when loaded
  React.useEffect(() => {
    if (userPreferences?.scoreWeights) {
      const weights = userPreferences.scoreWeights as any;
      setPreferences({
        commuteTimeWeight: weights.commuteTimeWeight || 25,
        priceWeight: weights.priceWeight || 25,
        sizeWeight: weights.sizeWeight || 20,
        ageWeight: weights.ageWeight || 10,
        floorWeight: weights.floorWeight || 10,
        walkTimeWeight: weights.walkTimeWeight || 10,
      });
    }
    if (userPreferences?.targetValues) {
      const targets = userPreferences.targetValues as any;
      setTargetValues({
        targetPrice: targets.targetPrice || 100000,
        targetSize: targets.targetSize || 40,
        targetCommute: targets.targetCommute || 30,
        targetAge: targets.targetAge || 10,
        targetFloor: targets.targetFloor || 3,
        targetWalkTime: targets.targetWalkTime || 5,
      });
    }
  }, [userPreferences]);

  // Ensure weights always add up to 100
  const adjustWeights = (changedKey: keyof typeof preferences, newValue: number) => {
    const oldValue = preferences[changedKey];
    const difference = newValue - oldValue;
    const otherKeys = Object.keys(preferences).filter(key => key !== changedKey) as Array<keyof typeof preferences>;
    
    // Calculate how much to adjust each other weight
    const totalOtherWeights = otherKeys.reduce((sum, key) => sum + preferences[key], 0);
    
    if (totalOtherWeights === 0) {
      // If all other weights are 0, distribute evenly
      const adjustment = -difference / otherKeys.length;
      const newPrefs = { ...preferences, [changedKey]: newValue };
      otherKeys.forEach(key => {
        newPrefs[key] = Math.max(0, Math.min(100, adjustment));
      });
      setPreferences(newPrefs);
    } else {
      // Distribute the difference proportionally
      const newPrefs = { ...preferences, [changedKey]: newValue };
      otherKeys.forEach(key => {
        const proportion = preferences[key] / totalOtherWeights;
        newPrefs[key] = Math.round(Math.max(0, Math.min(100, preferences[key] - (difference * proportion))));
      });
      
      // Ensure total is exactly 100
      const total = Object.values(newPrefs).reduce((sum, val) => sum + val, 0);
      if (total !== 100) {
        const adjustment = 100 - total;
        const largestKey = otherKeys.reduce((max, key) => 
          newPrefs[key] > newPrefs[max] ? key : max
        );
        newPrefs[largestKey] += adjustment;
      }
      
      setPreferences(newPrefs);
    }
  };

  // Update preferences mutation
  const updatePreferencesMutation = api.user.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferences saved successfully!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save preferences");
    },
  });

  const handleSavePreferences = () => {
    updatePreferencesMutation.mutate({
      scoreWeights: preferences,
      targetValues: targetValues,
    });
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="container px-4 py-8">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to access your settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and account settings</p>
      </div>

      <Tabs defaultValue="preferences" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preferences">
            <Settings className="mr-2 h-4 w-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="account">
            <User className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Apartment Scoring Preferences</CardTitle>
              <CardDescription>
                Adjust how important each factor is when we suggest apartments for you.
                The weights must add up to 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  These preferences will be used to calculate a personalized score for each apartment,
                  helping you find the best matches based on what matters most to you.
                </AlertDescription>
              </Alert>

              {/* Commute Time Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormSlider
                    label={
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Commute Time
                      </span>
                    }
                    defaultValue={[preferences.commuteTimeWeight]}
                    onValueChange={(value) => adjustWeights('commuteTimeWeight', value[0] ?? 0)}
                    max={100}
                    step={5}
                    description="How much shorter commute times matter to you"
                  />
                  <Badge variant="secondary" className="ml-2">{Math.round(preferences.commuteTimeWeight)}%</Badge>
                </div>
              </div>

              {/* Price Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormSlider
                    label={
                      <span className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Price
                      </span>
                    }
                    defaultValue={[preferences.priceWeight]}
                    onValueChange={(value) => adjustWeights('priceWeight', value[0] ?? 0)}
                    max={100}
                    step={5}
                    description="How much lower prices matter to you"
                  />
                  <Badge variant="secondary" className="ml-2">{Math.round(preferences.priceWeight)}%</Badge>
                </div>
              </div>

              {/* Size Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormSlider
                    label={
                      <span className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Size
                      </span>
                    }
                    defaultValue={[preferences.sizeWeight]}
                    onValueChange={(value) => adjustWeights('sizeWeight', value[0] ?? 0)}
                    max={100}
                    step={5}
                    description="How much larger apartments matter to you"
                  />
                  <Badge variant="secondary" className="ml-2">{Math.round(preferences.sizeWeight)}%</Badge>
                </div>
              </div>

              {/* Building Age Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormSlider
                    label={
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Building Age
                      </span>
                    }
                    defaultValue={[preferences.ageWeight]}
                    onValueChange={(value) => adjustWeights('ageWeight', value[0] ?? 0)}
                    max={100}
                    step={5}
                    description="How much newer buildings matter to you"
                  />
                  <Badge variant="secondary" className="ml-2">{Math.round(preferences.ageWeight)}%</Badge>
                </div>
              </div>

              {/* Floor Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormSlider
                    label={
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Floor Level
                      </span>
                    }
                    defaultValue={[preferences.floorWeight]}
                    onValueChange={(value) => adjustWeights('floorWeight', value[0] ?? 0)}
                    max={100}
                    step={5}
                    description="How much the floor level matters to you"
                  />
                  <Badge variant="secondary" className="ml-2">{Math.round(preferences.floorWeight)}%</Badge>
                </div>
              </div>

              {/* Walking Time Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormSlider
                    label={
                      <span className="flex items-center gap-2">
                        <Footprints className="h-4 w-4" />
                        Station Walk Time
                      </span>
                    }
                    defaultValue={[preferences.walkTimeWeight]}
                    onValueChange={(value) => adjustWeights('walkTimeWeight', value[0] ?? 0)}
                    max={100}
                    step={5}
                    description="How much walking distance to station matters to you"
                  />
                  <Badge variant="secondary" className="ml-2">{Math.round(preferences.walkTimeWeight)}%</Badge>
                </div>
              </div>

              {/* Total Check */}
              <div className="rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Weight</span>
                  <Badge variant={
                    Math.round(Object.values(preferences).reduce((sum, val) => sum + val, 0)) === 100
                      ? "success"
                      : "destructive"
                  }>
                    {Math.round(Object.values(preferences).reduce((sum, val) => sum + val, 0))}%
                  </Badge>
                </div>
              </div>

              <Button
                onClick={handleSavePreferences}
                disabled={updatePreferencesMutation.isPending}
                className="w-full"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Preferences
              </Button>
            </CardContent>
          </Card>

          {/* Target Values Card */}
          <Card>
            <CardHeader>
              <CardTitle>Target Values for Scoring</CardTitle>
              <CardDescription>
                Set your ideal values for each apartment feature. Apartments will be scored based on how close they are to these targets.
                Only negative deviations (worse than target) will reduce the score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  For example: If your target price is ¥100,000, apartments cheaper than this won't be penalized.
                  Only apartments more expensive will have their score reduced.
                </AlertDescription>
              </Alert>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Target Price */}
                <FormInput
                  label="Target Monthly Rent"
                  icon={DollarSign}
                  type="number"
                  value={targetValues.targetPrice}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetValues({ ...targetValues, targetPrice: parseInt(e.target.value) || 0 })}
                  min={0}
                  step={5000}
                  description="Your ideal monthly rent"
                />

                {/* Target Size */}
                <FormInput
                  label="Target Size"
                  icon={Home}
                  type="number"
                  value={targetValues.targetSize}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetValues({ ...targetValues, targetSize: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={5}
                  description="Your ideal apartment size (m²)"
                />

                {/* Target Commute */}
                <FormInput
                  label="Target Commute Time"
                  icon={Clock}
                  type="number"
                  value={targetValues.targetCommute}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetValues({ ...targetValues, targetCommute: parseInt(e.target.value) || 0 })}
                  min={0}
                  step={5}
                  description="Your ideal commute time (minutes)"
                />

                {/* Target Age */}
                <FormInput
                  label="Target Building Age"
                  icon={Calendar}
                  type="number"
                  value={targetValues.targetAge}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetValues({ ...targetValues, targetAge: parseInt(e.target.value) || 0 })}
                  min={0}
                  step={1}
                  description="Maximum acceptable building age (years)"
                />

                {/* Target Floor */}
                <FormInput
                  label="Target Floor"
                  icon={Building2}
                  type="number"
                  value={targetValues.targetFloor}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetValues({ ...targetValues, targetFloor: parseInt(e.target.value) || 0 })}
                  min={1}
                  step={1}
                  description="Your preferred floor level"
                />

                {/* Target Walk Time */}
                <FormInput
                  label="Target Walk Time"
                  icon={Footprints}
                  type="number"
                  value={targetValues.targetWalkTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetValues({ ...targetValues, targetWalkTime: parseInt(e.target.value) || 0 })}
                  min={0}
                  step={1}
                  description="Maximum walking time to station (minutes)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Preferred Stations Card */}
          <Card>
            <CardHeader>
              <CardTitle>Preferred Stations</CardTitle>
              <CardDescription>
                Add stations you frequently commute to for personalized suggestions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Coming soon: Set your preferred stations for better apartment recommendations
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Name</Label>
                <p className="font-medium">{session?.user?.name || "Not set"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Email</Label>
                <p className="font-medium">{session?.user?.email || "Not set"}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-muted-foreground">Account Type</Label>
                <Badge variant="outline">
                  {session?.user?.role === 'ADMIN' ? 'Administrator' : 'User'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>
                Manage your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full">
                Change Password
              </Button>
              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
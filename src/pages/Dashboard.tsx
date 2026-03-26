import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { WeatherCard } from '@/components/WeatherCard';
import { AITaskList } from '@/components/AITaskList';
import { AIChatbot } from '@/components/AIChatbot';
import { KisanVoiceBot } from '@/components/KisanVoiceBot';
import { FieldMap } from '@/components/FieldMap';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import { MarketPricesTable } from '@/components/MarketPricesTable';
import { SoilDataCard } from '@/components/SoilDataCard';
import { Onboarding } from '@/components/Onboarding';
import { CropHealthMonitor } from '@/components/CropHealthMonitor';
import { CropHealthVideoAnalysis } from '@/components/CropHealthVideoAnalysis';
import { IrrigationScheduler } from '@/components/IrrigationScheduler';
import { TasksTab } from '@/components/TasksTab';
import { HarvestPredictor } from '@/components/HarvestPredictor';
import { WeatherAlerts } from '@/components/WeatherAlerts';
import { getUserData, initializeUserData, saveUserData, UserData, Field, FinancialRecord, FarmerTask } from '@/lib/storage';
import { getWeather, getSoilData, getMarketPrices, WeatherData, getForecast, ForecastData } from '@/lib/apis';
import { getAITaskRecommendations, predictYield } from '@/lib/gemini';
import { Sprout, LogOut, TrendingUp, Scan, History, BarChart3, Image as ImageIcon, X, WifiOff, Loader2, Bot, ShieldCheck, Home, Map as MapIcon, Store, Wallet, Plus, Droplets, Mic } from 'lucide-react';
import { RemediationAgent } from '@/components/agents/RemediationAgent';
import { SalesAgent } from '@/components/agents/SalesAgent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { DigitalLedger } from '@/components/DigitalLedger';
import { ImageUploadComponent } from '@/components/disease-detection/ImageUploadComponent';
import { DetectionResultCard } from '@/components/disease-detection/DetectionResultCard';
import { DetectionImageWithBoundingBoxes } from '@/components/disease-detection/DetectionImageWithBoundingBoxes';
import { DetectionHistoryList } from '@/components/disease-detection/DetectionHistoryList';
import { AnalyticsDashboard } from '@/components/disease-detection/AnalyticsDashboard';
import {
  saveDetection,
  getDetectionHistory,
  deleteDetection,
  clearAllDetections
} from '@/lib/disease-detection/storage';
import { DetectionResult } from '@/lib/disease-detection/types';
import { detectDiseases } from '@/lib/disease-detection/api';
import { getDiseaseTreatment } from '@/lib/gemini';
import { translateText } from '@/lib/bhashini';
import { getCurrentLocation } from '@/lib/geolocation';

type DiseaseTabValue = 'detect' | 'results' | 'history' | 'analytics';

// Integrated Disease Detection Component
export function DiseaseDetectionIntegrated({ onDetection }: { onDetection?: (result: DetectionResult) => void }) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<DiseaseTabValue>('detect');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'uploading' | 'analyzing' | 'rendering'>('uploading');
  const [showEstimatedTime, setShowEstimatedTime] = useState(false);
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [highlightedPrediction, setHighlightedPrediction] = useState<number | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<DetectionResult[]>([]);
  const [treatmentRecommendations, setTreatmentRecommendations] = useState<string | null>(null);
  const [isLoadingTreatment, setIsLoadingTreatment] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  // Store latest detection for agent integration
  const latestDetectionRef = useRef<DetectionResult | null>(null);
  const [originalTreatmentRecommendations, setOriginalTreatmentRecommendations] = useState<string | null>(null);

  const detectionCache = useMemo(() => new Map<string, DetectionResult>(), []);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('diseaseDetectionActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const savedTab = sessionStorage.getItem('diseaseDetectionActiveTab') as DiseaseTabValue;
    if (savedTab && ['detect', 'results', 'history', 'analytics'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    const retranslateTreatment = async () => {
      if (!originalTreatmentRecommendations) return;
      if (language === 'en') {
        setTreatmentRecommendations(originalTreatmentRecommendations);
        return;
      }
      try {
        const translated = await translateText(originalTreatmentRecommendations, 'en', language);
        setTreatmentRecommendations(translated);
      } catch (error) {
        console.error('Failed to re-translate treatment recommendations:', error);
        setTreatmentRecommendations(originalTreatmentRecommendations);
      }
    };
    retranslateTreatment();
  }, [language, originalTreatmentRecommendations]);

  const loadHistory = () => {
    const history = getDetectionHistory();
    setDetectionHistory(history);
  };

  const handleImageSelect = async (file: File) => {
    setCurrentDetection(null);
    await handleAnalyze(file);
  };

  const handleAnalyze = async (file: File) => {
    if (!isOnline) {
      const titleText = language !== 'en'
        ? await translateText('No Internet Connection', 'en', language).catch(() => 'No Internet Connection')
        : 'No Internet Connection';
      const descText = language !== 'en'
        ? await translateText('Disease detection requires an internet connection. Please check your connection and try again.', 'en', language).catch(() => 'Disease detection requires an internet connection. Please check your connection and try again.')
        : 'Disease detection requires an internet connection. Please check your connection and try again.';
      toast({ title: titleText, description: descText, variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setProcessingStep('uploading');
    setShowEstimatedTime(false);

    const estimatedTimeTimer = setTimeout(() => setShowEstimatedTime(true), 5000);

    try {
      const location = await getCurrentLocation();
      setProcessingStep('analyzing');
      const result = await detectDiseases(file, location || undefined);
      setProcessingStep('rendering');

      saveDetection(result);

      const reader = new FileReader();
      reader.onload = () => {
        const imageHash = btoa(reader.result as string).substring(0, 50);
        detectionCache.set(imageHash, result);
      };
      reader.readAsDataURL(file);

      setCurrentDetection(result);
      if (onDetection) onDetection(result);
      loadHistory();
      setActiveTab('results');

      const titleText = language !== 'en'
        ? await translateText('Analysis Complete', 'en', language).catch(() => 'Analysis Complete')
        : 'Analysis Complete';
      const descriptionBase = result.count > 0
        ? `Detected ${result.count} disease${result.count > 1 ? 's' : ''} in the image.`
        : 'No diseases detected. Your crops appear healthy!';
      const descText = language !== 'en'
        ? await translateText(descriptionBase, 'en', language).catch(() => descriptionBase)
        : descriptionBase;

      toast({ title: titleText, description: descText });
    } catch (error) {
      console.error('Detection failed:', error);
      const titleText = language !== 'en'
        ? await translateText('Analysis Failed', 'en', language).catch(() => 'Analysis Failed')
        : 'Analysis Failed';
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unable to analyze image. Please check your connection and try again.';
      const descText = language !== 'en'
        ? await translateText(errorMessage, 'en', language).catch(() => errorMessage)
        : errorMessage;
      toast({ title: titleText, description: descText, variant: 'destructive' });
    } finally {
      clearTimeout(estimatedTimeTimer);
      setIsProcessing(false);
      setShowEstimatedTime(false);
    }
  };

  const handleSelectDetection = (detection: DetectionResult) => {
    setCurrentDetection(detection);
    setHighlightedPrediction(null);
    setTreatmentRecommendations(null);
    setActiveTab('results');
  };

  const handleDeleteDetection = async (id: string) => {
    deleteDetection(id);
    loadHistory();
    if (currentDetection?.id === id) {
      setCurrentDetection(null);
    }
    const titleText = language !== 'en'
      ? await translateText('Detection Deleted', 'en', language).catch(() => 'Detection Deleted')
      : 'Detection Deleted';
    const descText = language !== 'en'
      ? await translateText('The detection has been removed from your history.', 'en', language).catch(() => 'The detection has been removed from your history.')
      : 'The detection has been removed from your history.';
    toast({ title: titleText, description: descText });
  };

  const handleClearAllHistory = async () => {
    clearAllDetections();
    loadHistory();
    setCurrentDetection(null);
    const titleText = language !== 'en'
      ? await translateText('History Cleared', 'en', language).catch(() => 'History Cleared')
      : 'History Cleared';
    const descText = language !== 'en'
      ? await translateText('All detection history has been removed.', 'en', language).catch(() => 'All detection history has been removed.')
      : 'All detection history has been removed.';
    toast({ title: titleText, description: descText });
  };

  const handleRequestTreatment = async () => {
    if (!currentDetection || currentDetection.count === 0) return;

    setIsLoadingTreatment(true);
    try {
      const diseases = currentDetection.predictions.map(pred => pred.class_name);
      const confidences = currentDetection.predictions.map(pred => pred.confidence);
      const cropType = 'General Crop';

      const recommendations = await getDiseaseTreatment(diseases, confidences, cropType, currentDetection.location);
      setOriginalTreatmentRecommendations(recommendations);

      let translatedRecommendations = recommendations;
      if (language !== 'en') {
        try {
          translatedRecommendations = await translateText(recommendations, 'en', language);
        } catch (error) {
          console.error('Translation failed, using English:', error);
          translatedRecommendations = recommendations;
        }
      }

      setTreatmentRecommendations(translatedRecommendations);

      const titleText = language !== 'en'
        ? await translateText('Treatment Recommendations Ready', 'en', language).catch(() => 'Treatment Recommendations Ready')
        : 'Treatment Recommendations Ready';
      const descText = language !== 'en'
        ? await translateText('Organic treatment advice has been generated for the detected diseases.', 'en', language).catch(() => 'Organic treatment advice has been generated for the detected diseases.')
        : 'Organic treatment advice has been generated for the detected diseases.';
      toast({ title: titleText, description: descText });
    } catch (error) {
      console.error('Failed to get treatment recommendations:', error);
      const fallbackTreatments = currentDetection.predictions.map(pred => {
        return `**${pred.class_name}**:\n- Apply neem oil spray (30ml neem oil + 10ml liquid soap in 1 liter water)\n- Spray early morning or evening, covering both sides of leaves\n- Repeat every 7-10 days\n- Remove and destroy severely infected plant parts\n- Improve air circulation around plants`;
      }).join('\n\n');
      const fallbackMessage = `Here are some general organic treatment recommendations:\n\n${fallbackTreatments}\n\n**General Prevention**:\n- Apply organic compost to strengthen plant immunity\n- Use Trichoderma-enriched compost for disease suppression\n- Maintain proper spacing for air circulation\n- Avoid overhead watering to reduce leaf wetness\n- Practice crop rotation\n\nPlease consult with a local agricultural expert for specific guidance.`;

      setOriginalTreatmentRecommendations(fallbackMessage);
      let translatedFallback = fallbackMessage;
      if (language !== 'en') {
        try {
          translatedFallback = await translateText(fallbackMessage, 'en', language);
        } catch {
          console.error('Fallback translation failed, using English');
          translatedFallback = fallbackMessage;
        }
      }
      setTreatmentRecommendations(translatedFallback);

      const titleText = language !== 'en'
        ? await translateText('Using Fallback Recommendations', 'en', language).catch(() => 'Using Fallback Recommendations')
        : 'Using Fallback Recommendations';
      const descText = language !== 'en'
        ? await translateText('Unable to connect to AI service. Showing general organic treatment advice.', 'en', language).catch(() => 'Unable to connect to AI service. Showing general organic treatment advice.')
        : 'Unable to connect to AI service. Showing general organic treatment advice.';
      toast({ title: titleText, description: descText, variant: 'default' });
    } finally {
      setIsLoadingTreatment(false);
    }
  };

  const handleNewDetection = () => {
    setCurrentDetection(null);
    setHighlightedPrediction(null);
    setTreatmentRecommendations(null);
    setShowChatbot(false);
    setActiveTab('detect');
  };

  const handleAskChatbot = () => setShowChatbot(true);
  const handleCloseChatbot = () => setShowChatbot(false);

  return (
    <>
      {!isOnline && (
        <Alert variant="destructive" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>
            <TranslatedText text="No Internet Connection" targetLanguage={language} />
          </AlertTitle>
          <AlertDescription>
            <TranslatedText
              text="You are currently offline. Disease detection requires an internet connection. You can still view your cached history."
              targetLanguage={language}
            />
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl sm:text-3xl flex items-center gap-2">
            <Scan className="h-7 w-7 text-primary" />
            <TranslatedText text="AI Disease Detection" targetLanguage={language} />
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            <TranslatedText
              text="Upload crop images to detect diseases using AI-powered analysis"
              targetLanguage={language}
            />
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DiseaseTabValue)}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="detect" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">
                  <TranslatedText text="Detect" targetLanguage={language} />
                </span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2" disabled={!currentDetection}>
                <Scan className="h-4 w-4" />
                <span className="hidden sm:inline">
                  <TranslatedText text="Results" targetLanguage={language} />
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">
                  <TranslatedText text="History" targetLanguage={language} />
                </span>
                {detectionHistory.length > 0 && (
                  <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {detectionHistory.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  <TranslatedText text="Analytics" targetLanguage={language} />
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="detect" className="space-y-6">
              <ImageUploadComponent
                onImageSelect={handleImageSelect}
                isProcessing={isProcessing || !isOnline}
              />

              {isProcessing && (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="relative inline-block">
                      <Loader2 className="h-16 w-16 animate-spin text-primary" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-semibold">
                        {processingStep === 'uploading' && <TranslatedText text="Uploading Image..." targetLanguage={language} />}
                        {processingStep === 'analyzing' && <TranslatedText text="Analyzing Image..." targetLanguage={language} />}
                        {processingStep === 'rendering' && <TranslatedText text="Preparing Results..." targetLanguage={language} />}
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {processingStep === 'uploading' && <TranslatedText text="Sending image to AI service" targetLanguage={language} />}
                          {processingStep === 'analyzing' && <TranslatedText text="AI is detecting diseases in your crop" targetLanguage={language} />}
                          {processingStep === 'rendering' && <TranslatedText text="Finalizing detection results" targetLanguage={language} />}
                        </p>
                        {showEstimatedTime && (
                          <p className="text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <TranslatedText text="This is taking longer than usual. Estimated time: 10-15 seconds" targetLanguage={language} />
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${processingStep === 'uploading' ? 'bg-primary animate-pulse' : 'bg-primary'
                        }`} />
                      <div className={`h-1 w-8 rounded-full transition-colors duration-300 ${processingStep === 'analyzing' || processingStep === 'rendering' ? 'bg-primary' : 'bg-muted'
                        }`} />
                      <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${processingStep === 'analyzing' ? 'bg-primary animate-pulse' : processingStep === 'rendering' ? 'bg-primary' : 'bg-muted'
                        }`} />
                      <div className={`h-1 w-8 rounded-full transition-colors duration-300 ${processingStep === 'rendering' ? 'bg-primary' : 'bg-muted'
                        }`} />
                      <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${processingStep === 'rendering' ? 'bg-primary animate-pulse' : 'bg-muted'
                        }`} />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              {currentDetection ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        <TranslatedText text="Analyzed Image" targetLanguage={language} />
                      </h3>
                      <Button variant="outline" size="sm" onClick={handleNewDetection}>
                        <TranslatedText text="New Detection" targetLanguage={language} />
                      </Button>
                    </div>
                    <DetectionImageWithBoundingBoxes
                      imageUrl={currentDetection.imageUrl}
                      predictions={currentDetection.predictions}
                      highlightedIndex={highlightedPrediction}
                      onPredictionHover={setHighlightedPrediction}
                    />
                  </div>
                  <DetectionResultCard
                    result={currentDetection}
                    onRequestTreatment={handleRequestTreatment}
                    onAskChatbot={handleAskChatbot}
                    showLocation={true}
                    treatmentRecommendations={treatmentRecommendations}
                    isLoadingTreatment={isLoadingTreatment}
                    language={language}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Scan className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    <TranslatedText text="No Detection Results" targetLanguage={language} />
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mb-4">
                    <TranslatedText
                      text="Upload an image in the Detect tab to see analysis results here."
                      targetLanguage={language}
                    />
                  </p>
                  <Button onClick={() => setActiveTab('detect')}>
                    <TranslatedText text="Go to Detect" targetLanguage={language} />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <DetectionHistoryList
                detections={detectionHistory}
                onSelectDetection={handleSelectDetection}
                onDeleteDetection={handleDeleteDetection}
                onClearAll={handleClearAllHistory}
                language={language}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsDashboard detections={detectionHistory} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {showChatbot && currentDetection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">
                  <TranslatedText text="Ask About Detected Diseases" targetLanguage={language} />
                </h3>
                <p className="text-sm text-muted-foreground">
                  <TranslatedText
                    text={`Discussing: ${currentDetection.predictions.map(p => p.class_name).join(', ')}`}
                    targetLanguage={language}
                  />
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseChatbot}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIChatbot
                diseaseContext={{
                  diseases: currentDetection.predictions.map(p => p.class_name),
                  confidences: currentDetection.predictions.map(p => p.confidence),
                  location: currentDetection.location,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const Dashboard = () => {
  const { user, logout, isLoading: authLoading } = useAuth0();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [soilData, setSoilData] = useState<any>(null);
  const [aiTasks, setAiTasks] = useState<any[]>([]);
  const [farmerTasks, setFarmerTasks] = useState<FarmerTask[]>([]);
  const [marketPrices, setMarketPrices] = useState<any[]>([]);
  const [isLoadingMarket, setIsLoadingMarket] = useState(true);
  const [projectedYield, setProjectedYield] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [latestDetection, setLatestDetection] = useState<DetectionResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      let data = getUserData(user.sub!);

      if (!data) {
        data = initializeUserData(user.sub!, user.name || 'Farmer', language);
      }

      // Check if onboarding is needed - ONLY show if user has no fields at all
      if (data.fields.length === 0) {
        setShowOnboarding(true);
        setUserData(data);
        return;
      }

      setUserData(data);
      setFarmerTasks(data.tasks || []);

      // Fetch weather and soil data based on field location or user location
      if (data.fields.length > 0) {
        const field = data.fields[0];
        const centerLat = field.coordinates.reduce((sum, coord) => sum + coord[0], 0) / field.coordinates.length;
        const centerLon = field.coordinates.reduce((sum, coord) => sum + coord[1], 0) / field.coordinates.length;

        const weatherData = await getWeather(centerLat, centerLon);
        setWeather(weatherData);

        const [soilDataResult, forecastData] = await Promise.all([
          getSoilData(centerLat, centerLon),
          getForecast(centerLat, centerLon),
        ]);
        setSoilData(soilDataResult);
        setForecast(forecastData);

        // Get AI recommendations with enhanced context
        const tasks = await getAITaskRecommendations(data, soilDataResult, weatherData, undefined, forecastData);
        setAiTasks(tasks);

        setIsLoadingData(false);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          const weatherData = await getWeather(position.coords.latitude, position.coords.longitude);
          setWeather(weatherData);

          const [soilDataResult, forecastData] = await Promise.all([
            getSoilData(position.coords.latitude, position.coords.longitude),
            getForecast(position.coords.latitude, position.coords.longitude),
          ]);
          setSoilData(soilDataResult);
          setForecast(forecastData);

          // No field, so no ndviData available from user data
          const tasks = await getAITaskRecommendations(data, soilDataResult, weatherData, undefined, forecastData);
          setAiTasks(tasks);

          setIsLoadingData(false);
        }, () => {
          setIsLoadingData(false);
        });
      } else {
        setIsLoadingData(false);
      }

      // Get market prices
      setIsLoadingMarket(true);
      const cropName = data.fields.length > 0 ? data.fields[0].crop : 'Wheat';
      const prices = await getMarketPrices(cropName);
      setMarketPrices(prices);
      setIsLoadingMarket(false);

      // Calculate projected yield
      if (data.fields.length > 0) {
        const yield_ = await predictYield(data.fields[0], {});
        setProjectedYield(yield_);
      }
    };

    loadUserData();
  }, [user, language]);

  const handleFieldAdd = async (field: Field) => {
    if (!userData) return;

    const updatedData = { ...userData, fields: [...userData.fields, field] };
    saveUserData(updatedData);
    setUserData(updatedData);

    // Fetch soil data for the new field
    const centerLat = field.coordinates.reduce((sum, coord) => sum + coord[0], 0) / field.coordinates.length;
    const centerLon = field.coordinates.reduce((sum, coord) => sum + coord[1], 0) / field.coordinates.length;

    const soilDataResult = await getSoilData(centerLat, centerLon);
    setSoilData(soilDataResult);

    toast({
      title: 'Field Added',
      description: `${field.name} has been added successfully`
    });
  };

  const handleOnboardingComplete = async (fieldData: Field) => {
    if (!user) return;

    const data = getUserData(user.sub!);
    if (!data) return;

    const updatedData = { ...data, fields: [...data.fields, fieldData] };
    saveUserData(updatedData);
    setUserData(updatedData);

    setShowOnboarding(false);

    // Fetch data for the new field
    const centerLat = fieldData.coordinates.reduce((sum, coord) => sum + coord[0], 0) / fieldData.coordinates.length;
    const centerLon = fieldData.coordinates.reduce((sum, coord) => sum + coord[1], 0) / fieldData.coordinates.length;

    const weatherData = await getWeather(centerLat, centerLon);
    setWeather(weatherData);

    const [soilDataResult, forecastData] = await Promise.all([
      getSoilData(centerLat, centerLon),
      getForecast(centerLat, centerLon),
    ]);
    setSoilData(soilDataResult);
    setForecast(forecastData);

    const tasks = await getAITaskRecommendations(updatedData, soilDataResult, weatherData, undefined, forecastData);
    setAiTasks(tasks);

    setIsLoadingData(false);
  };

  const handleFinancialRecordAdd = (record: Omit<FinancialRecord, 'id'>) => {
    if (!userData) return;

    const newRecord = { ...record, id: Date.now().toString() };
    const updatedData = {
      ...userData,
      financialRecords: [...userData.financialRecords, newRecord]
    };
    saveUserData(updatedData);
    setUserData(updatedData);

    toast({
      title: 'Record Added',
      description: 'Financial record has been saved'
    });
  };

  const handleAddTask = (task: Omit<FarmerTask, 'id' | 'createdAt'>) => {
    if (!userData) return;
    const newTask: FarmerTask = { ...task, id: Date.now().toString(), createdAt: new Date().toISOString() };
    const updated = { ...userData, tasks: [...(userData.tasks || []), newTask] };
    saveUserData(updated);
    setUserData(updated);
    setFarmerTasks(updated.tasks);
    toast({ title: 'Task added', description: newTask.title });
  };

  const handleToggleTask = (id: string) => {
    if (!userData) return;
    const updated = { ...userData, tasks: (userData.tasks || []).map(t => t.id === id ? { ...t, done: !t.done } : t) };
    saveUserData(updated);
    setUserData(updated);
    setFarmerTasks(updated.tasks);
  };

  const handleDeleteTask = (id: string) => {
    if (!userData) return;
    const updated = { ...userData, tasks: (userData.tasks || []).filter(t => t.id !== id) };
    saveUserData(updated);
    setUserData(updated);
    setFarmerTasks(updated.tasks);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <TranslatedText text="Loading..." targetLanguage={language} />
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <TranslatedText text="Loading..." targetLanguage={language} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background overflow-x-hidden">
      {/* Header aligned with Stitch Premium Design */}
      <header className="sticky top-0 z-50 w-full bg-green-800/80 dark:bg-stone-900/80 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(32,98,35,0.08)]">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full border-2 border-white/20 overflow-hidden shadow-inner bg-white/10 flex items-center justify-center">
              {user.picture ? (
                <img alt="Profile" className="w-full h-full object-cover" src={user.picture} />
              ) : (
                <Sprout className="w-5 h-5 md:w-6 md:h-6 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-lg md:text-2xl tracking-tight text-green-50 truncate">
                <TranslatedText text="KisanMitra" targetLanguage={language} />
              </h1>
              <p className="text-[10px] md:text-xs text-green-100/80 font-medium truncate">
                <TranslatedText text="Welcome" targetLanguage={language} />, {user.name?.split(' ')[0]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="w-[100px] md:w-auto">
              <LanguageSelector />
            </div>
            <button
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center text-green-50 hover:bg-white/10 transition-colors active:scale-95 duration-200"
              title="Logout"
            >
              <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border-t border-border/10 flex justify-around p-2 pb-safe md:relative md:bg-transparent md:border-t-0 md:p-1 md:grid md:grid-cols-5 md:w-full md:max-w-4xl md:mx-auto md:gap-2 h-20 md:h-auto rounded-t-3xl md:rounded-none shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] md:shadow-none">
            
            <TabsTrigger value="overview" className="flex flex-col items-center gap-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#206223] dark:data-[state=active]:text-[#acf4a4] text-muted-foreground md:data-[state=active]:bg-primary md:data-[state=active]:text-primary-foreground md:rounded-full md:rounded-2xl md:p-2">
              <Home className="w-6 h-6 md:w-4 md:h-4 md:mr-1" />
              <span className="text-[10px] md:text-sm font-medium"><TranslatedText text="Home" targetLanguage={language} /></span>
            </TabsTrigger>
            
            <TabsTrigger value="fields" className="flex flex-col items-center gap-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#206223] dark:data-[state=active]:text-[#acf4a4] text-muted-foreground md:data-[state=active]:bg-primary md:data-[state=active]:text-primary-foreground md:rounded-full md:rounded-2xl md:p-2">
              <MapIcon className="w-6 h-6 md:w-4 md:h-4 md:mr-1" />
              <span className="text-[10px] md:text-sm font-medium"><TranslatedText text="Fields" targetLanguage={language} /></span>
            </TabsTrigger>
            
            <TabsTrigger value="disease" className="relative flex flex-col items-center gap-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#206223] dark:data-[state=active]:text-[#acf4a4] text-muted-foreground md:data-[state=active]:bg-primary md:data-[state=active]:text-primary-foreground md:rounded-full md:rounded-2xl md:p-2 group">
              <div className="md:hidden absolute -top-8 bg-[#206223] dark:bg-[#acf4a4] p-4 rounded-full shadow-[0_10px_20px_-5px_rgba(32,98,35,0.4)] group-data-[state=active]:scale-110 transition-transform">
                <Scan className="w-7 h-7 text-white dark:text-[#206223]" />
              </div>
              <Scan className="hidden md:block w-4 h-4 mr-1" />
              <span className="text-[10px] md:text-sm font-medium mt-8 md:mt-0"><TranslatedText text="Scan" targetLanguage={language} /></span>
            </TabsTrigger>
            
            <TabsTrigger value="market" className="flex flex-col items-center gap-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#206223] dark:data-[state=active]:text-[#acf4a4] text-muted-foreground md:data-[state=active]:bg-primary md:data-[state=active]:text-primary-foreground md:rounded-full md:rounded-2xl md:p-2">
              <Store className="w-6 h-6 md:w-4 md:h-4 md:mr-1" />
              <span className="text-[10px] md:text-sm font-medium"><TranslatedText text="Market" targetLanguage={language} /></span>
            </TabsTrigger>

            <TabsTrigger value="ledger" className="flex flex-col items-center gap-1 bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#206223] dark:data-[state=active]:text-[#acf4a4] text-muted-foreground md:data-[state=active]:bg-primary md:data-[state=active]:text-primary-foreground md:rounded-full md:rounded-2xl md:p-2">
              <Wallet className="w-6 h-6 md:w-4 md:h-4 md:mr-1" />
              <span className="text-[10px] md:text-sm font-medium"><TranslatedText text="Finance" targetLanguage={language} /></span>
            </TabsTrigger>

            {/* Hidden triggers for programmatic navigation */}
            <TabsTrigger value="irrigation" className="hidden" />
            <TabsTrigger value="finance" className="hidden" />
            <TabsTrigger value="ai" className="hidden" />
            <TabsTrigger value="sales" className="hidden" />
          </TabsList>

          {/* Overview Tab (Stitch Redesign layout) */}
          <TabsContent value="overview" className="space-y-8 mt-6">
            
            {/* Quick Actions Homescreen row */}
            <section>
              <h3 className="font-heading text-lg font-bold px-2 mb-4 text-foreground">
                <TranslatedText text="Quick Actions" targetLanguage={language} />
              </h3>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3 px-1 md:px-2">
                <button 
                  onClick={() => setActiveTab('finance')}
                  className="flex flex-col items-center gap-1 md:gap-2 p-2 md:p-3 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-border/10 active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Plus className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-semibold text-center leading-tight">Add Expense</span>
                </button>
                <button 
                  onClick={() => setActiveTab('disease')}
                  className="flex flex-col items-center gap-1 md:gap-2 p-2 md:p-3 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-border/10 active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400">
                    <Scan className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-semibold text-center leading-tight">Scan Crop</span>
                </button>
                <button 
                  onClick={() => setActiveTab('irrigation')}
                  className="flex flex-col items-center gap-1 md:gap-2 p-2 md:p-3 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-border/10 active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <Droplets className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-semibold text-center leading-tight">Tasks</span>
                </button>
                <button 
                  onClick={() => setActiveTab('ai')}
                  className="flex flex-col items-center gap-1 md:gap-2 p-2 md:p-3 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-border/10 active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Mic className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-semibold text-center leading-tight">Ask AI</span>
                </button>
              </div>
            </section>
            
            {/* Weather & Soil Main Stack */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Weather Card with 5-day forecast */}
              <div className="relative overflow-hidden rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(32,98,35,0.12)] bg-gradient-to-br from-[#87CEEB] to-[#FFFACD] p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-sans text-[#206223] font-bold uppercase tracking-widest text-xs mb-1">
                      <TranslatedText text="Live Weather" targetLanguage={language} />
                    </p>
                    <h2 className="font-heading text-5xl font-extrabold text-[#1a1c1c]">
                      {weather ? `${Math.round(weather.main?.temp || 0)}°C` : '--'}
                    </h2>
                    <p className="text-[#40493d] font-medium mt-1 capitalize">
                      {weather ? weather.weather[0]?.description : ''}
                    </p>
                  </div>
                  <div className="bg-white/40 backdrop-blur-md p-4 rounded-2xl shadow-inner">
                    <img 
                      src={weather ? `https://openweathermap.org/img/wn/${weather.weather[0]?.icon}@2x.png` : ''} 
                      alt="weather"
                      className="w-12 h-12"
                    />
                  </div>
                </div>
                <div className="flex gap-6">
                  <span className="text-sm font-semibold text-[#1a1c1c]">
                    {weather?.main?.humidity}% <TranslatedText text="Humidity" targetLanguage={language} />
                  </span>
                  <span className="text-sm font-semibold text-[#1a1c1c]">
                    {weather?.wind?.speed} m/s <TranslatedText text="Wind" targetLanguage={language} />
                  </span>
                </div>
                {/* 5-day forecast strip */}
                {forecast?.daily && forecast.daily.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {forecast.daily.map((day) => (
                      <div key={day.date} className="flex flex-col items-center min-w-[52px] bg-white/40 backdrop-blur-sm rounded-xl p-2 gap-1">
                        <span className="text-[10px] font-bold text-[#206223]">
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                        </span>
                        <img
                          src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                          alt={day.description}
                          className="w-8 h-8"
                        />
                        <span className="text-[10px] font-semibold text-[#1a1c1c]">{day.tempMax}°</span>
                        <span className="text-[10px] text-[#40493d]">{day.tempMin}°</span>
                        {day.rainMm > 0 && (
                          <span className="text-[9px] text-blue-600 font-medium">{day.rainMm}mm</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
                  <Sprout className="w-48 h-48 text-[#206223]" />
                </div>
              </div>

              {/* Yield Prediction styled like Stitch cards */}
              <div className="relative overflow-hidden rounded-[2rem] h-64 shadow-[0_20px_50px_-12px_rgba(32,98,35,0.12)] bg-[#206223] p-8 flex flex-col justify-between text-white">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                <div className="flex justify-between items-start z-10">
                  <div>
                    <p className="font-sans text-[#acf4a4] font-bold uppercase tracking-widest text-xs mb-1">
                      <TranslatedText text="Projected Yield" targetLanguage={language} />
                    </p>
                    <h2 className="font-heading text-5xl font-extrabold text-white">
                      {projectedYield.toFixed(1)} <span className="text-2xl">tons</span>
                    </h2>
                    <p className="text-[#acf4a4] font-medium mt-1">
                      <TranslatedText text="For current season" targetLanguage={language} />
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl">
                    <TrendingUp className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="z-10 mt-auto">
                    <button className="w-full py-3 bg-white text-[#206223] font-bold rounded-full text-sm shadow-xl hover:scale-[1.02] active:scale-95 transition-transform">
                        <TranslatedText text="View Finance Details" targetLanguage={language} />
                    </button>
                </div>
              </div>
            </div>

            {/* Bento Grid: AI Tasks & Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Alerts & Tasks */}
              <div className="space-y-8">
                {weather && <WeatherAlerts weather={weather} />}
                
                <section className="space-y-4">
                  <div className="flex justify-between items-end">
                    <h3 className="font-heading text-xl font-bold px-2 text-foreground">
                      <TranslatedText text="Next AI Tasks" targetLanguage={language} />
                    </h3>
                  </div>
                  <div className="bg-[#ffffff] dark:bg-stone-900 rounded-[2rem] p-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-border/10">
                    <AITaskList tasks={aiTasks} isLoading={isLoadingData} onAddTask={handleAddTask} />
                  </div>
                </section>
              </div>

              {/* Right Column: AI Disease Scanner Prominent Block */}
              <section className="flex flex-col h-full space-y-8">
                  <div className="bg-[#ffffff] dark:bg-stone-900 rounded-[2rem] p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] border border-border/10">
                      <h3 className="text-lg font-heading font-bold mb-4 text-foreground px-2">
                        <TranslatedText text="Quick Stats" targetLanguage={language} />
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center py-4 px-2 bg-[#f4f3f2] dark:bg-stone-800 rounded-2xl">
                          <p className="text-3xl font-heading font-extrabold text-[#206223] dark:text-[#acf4a4] mb-1">{userData.fields.length}</p>
                          <p className="text-[10px] text-[#40493d] dark:text-gray-400 font-bold uppercase tracking-wider">
                            <TranslatedText text="Fields" targetLanguage={language} />
                          </p>
                        </div>
                        <div className="text-center py-4 px-2 bg-[#f4f3f2] dark:bg-stone-800 rounded-2xl">
                          <p className="text-3xl font-heading font-extrabold text-[#206223] dark:text-[#acf4a4] mb-1">
                            {userData.fields.reduce((sum, f) => sum + f.area, 0).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-[#40493d] dark:text-gray-400 font-bold uppercase tracking-wider">
                            <TranslatedText text="Acres" targetLanguage={language} />
                          </p>
                        </div>
                        <div className="text-center py-4 px-2 bg-[#f4f3f2] dark:bg-stone-800 rounded-2xl">
                          <p className="text-3xl font-heading font-extrabold text-[#206223] dark:text-[#acf4a4] mb-1">{aiTasks.length}</p>
                          <p className="text-[10px] text-[#40493d] dark:text-gray-400 font-bold uppercase tracking-wider">
                            <TranslatedText text="Tasks" targetLanguage={language} />
                          </p>
                        </div>
                        <div className="text-center py-4 px-2 bg-[#f4f3f2] dark:bg-stone-800 rounded-2xl">
                          <p className="text-3xl font-heading font-extrabold text-[#206223] dark:text-[#acf4a4] mb-1">{userData.financialRecords.length}</p>
                          <p className="text-[10px] text-[#40493d] dark:text-gray-400 font-bold uppercase tracking-wider">
                            <TranslatedText text="Tx" targetLanguage={language} />
                          </p>
                        </div>
                      </div>
                  </div>

                  {/* AI Crop Scanner Box (Extracted from Stitch Design) */}
                  <div className="bg-[#206223] overflow-hidden relative rounded-[2rem] flex-1 flex flex-col justify-center items-center text-center p-8 shadow-[0_20px_50px_-12px_rgba(32,98,35,0.2)]">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    <div className="relative z-10 space-y-6">
                      <div className="w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center mx-auto">
                        <Scan className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h3 className="font-heading text-2xl font-extrabold text-white">
                            <TranslatedText text="AI Crop Scanner" targetLanguage={language} />
                        </h3>
                        <p className="text-[#acf4a4] text-xs max-w-[240px] mx-auto mt-2">
                            <TranslatedText text="Scan your plant leaves to detect diseases instantly using advanced models." targetLanguage={language} />
                        </p>
                      </div>
                      <button className="w-full py-4 bg-white text-[#206223] font-bold rounded-full shadow-xl hover:scale-[1.02] active:scale-95 transition-transform" onClick={() => document.querySelector<HTMLButtonElement>('[value="disease"]')?.click()}>
                        <TranslatedText text="Scan Plant Now" targetLanguage={language} />
                      </button>
                    </div>
                  </div>
              </section>
            </div>
            
            <div className="mb-4">
              <SoilDataCard soilData={soilData} isLoading={isLoadingData} />
            </div>
          </TabsContent>

          {/* Crop Health Tab */}
          {/* Digital Ledger Tab */}
          <TabsContent value="ledger">
            <DigitalLedger />
          </TabsContent>

          {/* Disease Detection Tab */}
          <TabsContent value="disease" className="space-y-6">
            <DiseaseDetectionIntegrated onDetection={setLatestDetection} />
          </TabsContent>

          {/* Tasks Tab (replaces Irrigation) */}
          <TabsContent value="irrigation" className="space-y-6">
            <TasksTab
              tasks={farmerTasks}
              onToggle={handleToggleTask}
              onDelete={handleDeleteTask}
              onAdd={handleAddTask}
              fields={userData.fields}
              weather={weather}
              forecast={forecast}
            />
          </TabsContent>

          {/* Fields Tab */}
          <TabsContent value="fields" className="space-y-6">
            <FieldMap fields={userData.fields} onFieldAdd={handleFieldAdd} />
          </TabsContent>

          {/* Market Tab */}
          <TabsContent value="market" className="space-y-6">
            <MarketPricesTable prices={marketPrices} isLoading={isLoadingMarket} />
            
            <div className="mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-100 dark:border-green-900/50 p-4 md:p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xl font-heading font-bold flex items-center gap-2 text-green-800 dark:text-green-400">
                  <Bot className="w-6 h-6" />
                  <TranslatedText text="AI Sales Agent" targetLanguage={language} />
                </h3>
                <p className="text-sm text-green-700/80 dark:text-green-300/80 mt-1">
                  <TranslatedText text="Let our AI negotiate the best prices for your crop on ONDC." targetLanguage={language} />
                </p>
              </div>
              <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-border/10">
                <SalesAgent
                  defaultCrop={userData.fields.length > 0 ? userData.fields[0].crop : ''}
                  marketPrices={marketPrices}
                  location={userData.fields.length > 0 ? {
                    lat: userData.fields[0].coordinates[0][0],
                    lng: userData.fields[0].coordinates[0][1],
                  } : undefined}
                />
              </div>
            </div>
          </TabsContent>

          {/* Finance Tab */}
          <TabsContent value="finance">
            <FinancialDashboard
              records={userData.financialRecords}
              onAddRecord={handleFinancialRecordAdd}
              projectedYield={projectedYield}
              marketPrice={marketPrices.length > 0 ? marketPrices.reduce((sum, p) => sum + p.modalPrice, 0) / marketPrices.length : 2700}
              fieldArea={userData.fields.reduce((sum, f) => sum + f.area, 0)}
            />
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai">
            <KisanVoiceBot />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;

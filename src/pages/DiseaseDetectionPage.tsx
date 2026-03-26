import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ImageUploadComponent } from '@/components/disease-detection/ImageUploadComponent';
import { DetectionResultCard } from '@/components/disease-detection/DetectionResultCard';
import { DetectionImageWithBoundingBoxes } from '@/components/disease-detection/DetectionImageWithBoundingBoxes';
import { DetectionHistoryList } from '@/components/disease-detection/DetectionHistoryList';
import { AIChatbot } from '@/components/AIChatbot';
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
import { useLanguage } from '@/contexts/LanguageContext';
import { TranslatedText } from '@/components/TranslatedText';
import { Loader2, Scan, History, BarChart3, Image as ImageIcon, X, WifiOff } from 'lucide-react';

type TabValue = 'detect' | 'results' | 'history' | 'analytics';

export default function DiseaseDetectionPage() {
  // State management
  const [activeTab, setActiveTab] = useState<TabValue>('detect');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'uploading' | 'analyzing' | 'rendering'>('uploading');
  const [showEstimatedTime, setShowEstimatedTime] = useState(false);
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [highlightedPrediction, setHighlightedPrediction] = useState<number | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<DetectionResult[]>([]);
  const [treatmentRecommendations, setTreatmentRecommendations] = useState<string | null>(null);
  const [isLoadingTreatment, setIsLoadingTreatment] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const isOnline = useOnlineStatus();

  // Cache for detection results (keyed by image data URL hash)
  const detectionCache = useMemo(() => new Map<string, DetectionResult>(), []);

  // Request location permissions on component mount (only when needed)
  useEffect(() => {
    // Location will be requested when user uploads an image
    // This respects privacy by not requesting permissions upfront
  }, []);

  // Load detection history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Persist active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('diseaseDetectionActiveTab', activeTab);
  }, [activeTab]);

  // Restore active tab from sessionStorage on mount
  useEffect(() => {
    const savedTab = sessionStorage.getItem('diseaseDetectionActiveTab') as TabValue;
    if (savedTab && ['detect', 'results', 'history', 'analytics'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Load detection history from localStorage
  const loadHistory = () => {
    const history = getDetectionHistory();
    setDetectionHistory(history);
  };

  // Handle image selection
  const handleImageSelect = async (file: File) => {
    setCurrentDetection(null);
    
    // Auto-analyze the image
    await handleAnalyze(file);
  };

  // Handle disease detection analysis
  const handleAnalyze = async (file: File) => {
    // Check if offline
    if (!isOnline) {
      const titleText = language !== 'en'
        ? await translateText('No Internet Connection', 'en', language).catch(() => 'No Internet Connection')
        : 'No Internet Connection';
      const descText = language !== 'en'
        ? await translateText('Disease detection requires an internet connection. Please check your connection and try again.', 'en', language).catch(() => 'Disease detection requires an internet connection. Please check your connection and try again.')
        : 'Disease detection requires an internet connection. Please check your connection and try again.';
      
      toast({
        title: titleText,
        description: descText,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep('uploading');
    setShowEstimatedTime(false);
    
    // Show estimated time after 5 seconds
    const estimatedTimeTimer = setTimeout(() => {
      setShowEstimatedTime(true);
    }, 5000);
    
    try {
      // Get current location if available (request permission only when needed)
      const location = await getCurrentLocation();

      // Update to analyzing step
      setProcessingStep('analyzing');

      // Call detection API
      const result = await detectDiseases(file, location || undefined);
      
      // Update to rendering step
      setProcessingStep('rendering');
      
      // Save to history
      saveDetection(result);
      
      // Cache the result
      const reader = new FileReader();
      reader.onload = () => {
        const imageHash = btoa(reader.result as string).substring(0, 50);
        detectionCache.set(imageHash, result);
      };
      reader.readAsDataURL(file);
      
      // Update state
      setCurrentDetection(result);
      loadHistory();
      
      // Switch to results tab
      setActiveTab('results');
      
      // Translate success toast messages
      const titleText = language !== 'en'
        ? await translateText('Analysis Complete', 'en', language).catch(() => 'Analysis Complete')
        : 'Analysis Complete';
      
      const descriptionBase = result.count > 0 
        ? `Detected ${result.count} disease${result.count > 1 ? 's' : ''} in the image.`
        : 'No diseases detected. Your crops appear healthy!';
      
      const descText = language !== 'en'
        ? await translateText(descriptionBase, 'en', language).catch(() => descriptionBase)
        : descriptionBase;
      
      // Show success toast
      toast({
        title: titleText,
        description: descText,
      });
    } catch (error) {
      console.error('Detection failed:', error);
      
      // Translate error toast messages
      const titleText = language !== 'en'
        ? await translateText('Analysis Failed', 'en', language).catch(() => 'Analysis Failed')
        : 'Analysis Failed';
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unable to analyze image. Please check your connection and try again.';
      
      const descText = language !== 'en'
        ? await translateText(errorMessage, 'en', language).catch(() => errorMessage)
        : errorMessage;
      
      toast({
        title: titleText,
        description: descText,
        variant: 'destructive',
      });
    } finally {
      clearTimeout(estimatedTimeTimer);
      setIsProcessing(false);
      setShowEstimatedTime(false);
    }
  };

  // Handle selecting a detection from history
  const handleSelectDetection = (detection: DetectionResult) => {
    setCurrentDetection(detection);
    setHighlightedPrediction(null);
    setTreatmentRecommendations(null);
    setActiveTab('results');
  };

  // Handle deleting a detection from history
  const handleDeleteDetection = async (id: string) => {
    deleteDetection(id);
    loadHistory();
    
    // If the deleted detection was currently displayed, clear it
    if (currentDetection?.id === id) {
      setCurrentDetection(null);
    }
    
    // Translate toast messages
    const titleText = language !== 'en'
      ? await translateText('Detection Deleted', 'en', language).catch(() => 'Detection Deleted')
      : 'Detection Deleted';
    const descText = language !== 'en'
      ? await translateText('The detection has been removed from your history.', 'en', language).catch(() => 'The detection has been removed from your history.')
      : 'The detection has been removed from your history.';
    
    toast({
      title: titleText,
      description: descText,
    });
  };

  // Handle clearing all history
  const handleClearAllHistory = async () => {
    clearAllDetections();
    loadHistory();
    setCurrentDetection(null);
    
    // Translate toast messages
    const titleText = language !== 'en'
      ? await translateText('History Cleared', 'en', language).catch(() => 'History Cleared')
      : 'History Cleared';
    const descText = language !== 'en'
      ? await translateText('All detection history has been removed.', 'en', language).catch(() => 'All detection history has been removed.')
      : 'All detection history has been removed.';
    
    toast({
      title: titleText,
      description: descText,
    });
  };

  // Store original (English) treatment recommendations for re-translation
  const [originalTreatmentRecommendations, setOriginalTreatmentRecommendations] = useState<string | null>(null);

  // Re-translate treatment recommendations when language changes
  useEffect(() => {
    const retranslateTreatment = async () => {
      if (!originalTreatmentRecommendations) {
        return;
      }

      if (language === 'en') {
        setTreatmentRecommendations(originalTreatmentRecommendations);
        return;
      }

      try {
        const translated = await translateText(originalTreatmentRecommendations, 'en', language);
        setTreatmentRecommendations(translated);
      } catch (error) {
        console.error('Failed to re-translate treatment recommendations:', error);
        // Fallback to English on translation failure
        setTreatmentRecommendations(originalTreatmentRecommendations);
      }
    };

    retranslateTreatment();
  }, [language, originalTreatmentRecommendations]);

  // Handle requesting treatment recommendations
  const handleRequestTreatment = async () => {
    if (!currentDetection || currentDetection.count === 0) {
      return;
    }

    setIsLoadingTreatment(true);
    
    try {
      // Extract disease names and confidence scores
      const diseases = currentDetection.predictions.map(pred => pred.class_name);
      const confidences = currentDetection.predictions.map(pred => pred.confidence);
      
      // Get crop type from user data if available (placeholder for now)
      const cropType = 'General Crop'; // TODO: Get from user context
      
      // Call Gemini AI for treatment recommendations
      const recommendations = await getDiseaseTreatment(
        diseases,
        confidences,
        cropType,
        currentDetection.location
      );
      
      // Store original English recommendations for re-translation
      setOriginalTreatmentRecommendations(recommendations);
      
      // Translate recommendations to user's language if not English
      let translatedRecommendations = recommendations;
      if (language !== 'en') {
        try {
          translatedRecommendations = await translateText(recommendations, 'en', language);
        } catch (error) {
          console.error('Translation failed, using English:', error);
          // Fallback to English on translation failure
          translatedRecommendations = recommendations;
        }
      }
      
      setTreatmentRecommendations(translatedRecommendations);
      
      // Translate toast messages
      const titleText = language !== 'en' 
        ? await translateText('Treatment Recommendations Ready', 'en', language).catch(() => 'Treatment Recommendations Ready')
        : 'Treatment Recommendations Ready';
      const descText = language !== 'en'
        ? await translateText('Organic treatment advice has been generated for the detected diseases.', 'en', language).catch(() => 'Organic treatment advice has been generated for the detected diseases.')
        : 'Organic treatment advice has been generated for the detected diseases.';
      
      toast({
        title: titleText,
        description: descText,
      });
    } catch (error) {
      console.error('Failed to get treatment recommendations:', error);
      
      // Fallback organic treatment suggestions
      const fallbackTreatments = currentDetection.predictions.map(pred => {
        return `**${pred.class_name}**:\n- Apply neem oil spray (30ml neem oil + 10ml liquid soap in 1 liter water)\n- Spray early morning or evening, covering both sides of leaves\n- Repeat every 7-10 days\n- Remove and destroy severely infected plant parts\n- Improve air circulation around plants`;
      }).join('\n\n');
      
      const fallbackMessage = `Here are some general organic treatment recommendations:\n\n${fallbackTreatments}\n\n**General Prevention**:\n- Apply organic compost to strengthen plant immunity\n- Use Trichoderma-enriched compost for disease suppression\n- Maintain proper spacing for air circulation\n- Avoid overhead watering to reduce leaf wetness\n- Practice crop rotation\n\nPlease consult with a local agricultural expert for specific guidance.`;
      
      // Store original English fallback for re-translation
      setOriginalTreatmentRecommendations(fallbackMessage);
      
      // Translate fallback message if needed
      let translatedFallback = fallbackMessage;
      if (language !== 'en') {
        try {
          translatedFallback = await translateText(fallbackMessage, 'en', language);
        } catch {
          // If translation fails, use English fallback
          console.error('Fallback translation failed, using English');
          translatedFallback = fallbackMessage;
        }
      }
      
      setTreatmentRecommendations(translatedFallback);
      
      // Translate error toast messages
      const titleText = language !== 'en'
        ? await translateText('Using Fallback Recommendations', 'en', language).catch(() => 'Using Fallback Recommendations')
        : 'Using Fallback Recommendations';
      const descText = language !== 'en'
        ? await translateText('Unable to connect to AI service. Showing general organic treatment advice.', 'en', language).catch(() => 'Unable to connect to AI service. Showing general organic treatment advice.')
        : 'Unable to connect to AI service. Showing general organic treatment advice.';
      
      toast({
        title: titleText,
        description: descText,
        variant: 'default',
      });
    } finally {
      setIsLoadingTreatment(false);
    }
  };

  // Handle starting a new detection
  const handleNewDetection = () => {
    setCurrentDetection(null);
    setHighlightedPrediction(null);
    setTreatmentRecommendations(null);
    setShowChatbot(false);
    setActiveTab('detect');
  };

  // Handle opening chatbot with disease context
  const handleAskChatbot = () => {
    setShowChatbot(true);
  };

  // Handle closing chatbot
  const handleCloseChatbot = () => {
    setShowChatbot(false);
  };

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 max-w-7xl">
      {/* Offline Alert */}
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
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)}>
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

            {/* Detect Tab */}
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
                        {processingStep === 'uploading' && (
                          <TranslatedText text="Uploading Image..." targetLanguage={language} />
                        )}
                        {processingStep === 'analyzing' && (
                          <TranslatedText text="Analyzing Image..." targetLanguage={language} />
                        )}
                        {processingStep === 'rendering' && (
                          <TranslatedText text="Preparing Results..." targetLanguage={language} />
                        )}
                      </p>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {processingStep === 'uploading' && (
                            <TranslatedText text="Sending image to AI service" targetLanguage={language} />
                          )}
                          {processingStep === 'analyzing' && (
                            <TranslatedText text="AI is detecting diseases in your crop" targetLanguage={language} />
                          )}
                          {processingStep === 'rendering' && (
                            <TranslatedText text="Finalizing detection results" targetLanguage={language} />
                          )}
                        </p>
                        {showEstimatedTime && (
                          <p className="text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <TranslatedText text="This is taking longer than usual. Estimated time: 10-15 seconds" targetLanguage={language} />
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Progress steps indicator */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                        processingStep === 'uploading' ? 'bg-primary animate-pulse' : 'bg-primary'
                      }`} />
                      <div className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                        processingStep === 'analyzing' || processingStep === 'rendering' ? 'bg-primary' : 'bg-muted'
                      }`} />
                      <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                        processingStep === 'analyzing' ? 'bg-primary animate-pulse' : processingStep === 'rendering' ? 'bg-primary' : 'bg-muted'
                      }`} />
                      <div className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                        processingStep === 'rendering' ? 'bg-primary' : 'bg-muted'
                      }`} />
                      <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                        processingStep === 'rendering' ? 'bg-primary animate-pulse' : 'bg-muted'
                      }`} />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-6">
              {currentDetection ? (
                <>
                  {/* Image with Bounding Boxes */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        <TranslatedText text="Analyzed Image" targetLanguage={language} />
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNewDetection}
                      >
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

                  {/* Detection Results Card */}
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

            {/* History Tab */}
            <TabsContent value="history">
              <DetectionHistoryList
                detections={detectionHistory}
                onSelectDetection={handleSelectDetection}
                onDeleteDetection={handleDeleteDetection}
                onClearAll={handleClearAllHistory}
                language={language}
              />
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <AnalyticsDashboard detections={detectionHistory} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Chatbot Overlay */}
      {showChatbot && currentDetection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseChatbot}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Chatbot Content */}
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
    </div>
  );
}

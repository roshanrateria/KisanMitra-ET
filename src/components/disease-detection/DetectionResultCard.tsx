import { DetectionResult } from '@/lib/disease-detection/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, AlertTriangle, Leaf, CheckCircle, Loader2, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TranslatedText } from '@/components/TranslatedText';
import { translateText } from '@/lib/bhashini';
import { RemediationAgent } from '@/components/agents/RemediationAgent';

interface DetectionResultCardProps {
  result: DetectionResult;
  onRequestTreatment?: () => void;
  onAskChatbot?: () => void;
  showLocation?: boolean;
  treatmentRecommendations?: string | null;
  isLoadingTreatment?: boolean;
  language?: string;
}

/**
 * Get severity level based on confidence score
 * High: >= 80%, Medium: 50-79%, Low: < 50%
 */
const getSeverity = (confidence: number): 'high' | 'medium' | 'low' => {
  const percentage = confidence * 100;
  if (percentage >= 80) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
};

/**
 * Get badge variant based on severity
 */
const getSeverityVariant = (severity: 'high' | 'medium' | 'low') => {
  switch (severity) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
  }
};

/**
 * Format confidence score as percentage with one decimal place
 */
const formatConfidence = (confidence: number): string => {
  return `${(Math.round(confidence * 1000) / 10).toFixed(1)}%`;
};

/**
 * Format timestamp to readable date and time
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function DetectionResultCard({
  result,
  onRequestTreatment,
  onAskChatbot,
  showLocation = true,
  treatmentRecommendations = null,
  isLoadingTreatment = false,
  language = 'en',
}: DetectionResultCardProps) {
  // Handle empty detection results (no diseases detected)
  const hasDetections = result.count > 0 && result.predictions.length > 0;

  // State for expandable treatment section
  const [isTreatmentExpanded, setIsTreatmentExpanded] = useState(false);

  // State for translated disease names
  const [translatedDiseases, setTranslatedDiseases] = useState<Map<string, string>>(new Map());

  // Translate disease names when language changes
  useEffect(() => {
    const translateDiseases = async () => {
      if (language === 'en' || !hasDetections) {
        setTranslatedDiseases(new Map());
        return;
      }

      const translations = new Map<string, string>();
      for (const prediction of result.predictions) {
        try {
          const translated = await translateText(prediction.class_name, 'en', language);
          translations.set(prediction.class_name, translated);
        } catch (error) {
          console.error(`Failed to translate ${prediction.class_name}:`, error);
          translations.set(prediction.class_name, prediction.class_name);
        }
      }
      setTranslatedDiseases(translations);
    };

    translateDiseases();
  }, [language, result.predictions, hasDetections]);

  // Get translated disease name or fallback to original
  const getDiseaseName = (originalName: string): string => {
    return translatedDiseases.get(originalName) || originalName;
  };

  return (
    <Card className="w-full bg-surface-lowest rounded-3xl shadow-intense border-0 transition-shadow duration-400 overflow-hidden relative">
      <CardHeader className="pb-4 border-b border-outline-variant/10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-heading font-bold flex items-center gap-3">
              {hasDetections ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <TranslatedText text="Detection Results" targetLanguage={language} />
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <TranslatedText text="Healthy Crops" targetLanguage={language} />
                </>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatTimestamp(result.timestamp)}
              </span>
              {showLocation && result.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {result.location.lat.toFixed(4)}, {result.location.lng.toFixed(4)}
                </span>
              )}
            </CardDescription>
          </div>
          <Badge
            variant={hasDetections ? "outline" : "default"}
            className={`text-base font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider ${!hasDetections ? 'bg-primary-container text-on-primary-container border-0' : 'border-outline-variant/30 text-foreground'}`}
          >
            {hasDetections ? (
              <TranslatedText
                text={`${result.count} ${result.count === 1 ? 'Disease' : 'Diseases'}`}
                targetLanguage={language}
              />
            ) : (
              <TranslatedText text="No Diseases" targetLanguage={language} />
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasDetections ? (
          <>
            {/* Predictions List */}
            <div className="space-y-3">
              {result.predictions.map((prediction, index) => {
                const severity = getSeverity(prediction.confidence);
                const confidencePercentage = prediction.confidence * 100;

                return (
                  <div
                    key={index}
                    className="p-5 rounded-2xl border border-outline-variant/10 bg-surface-container-low hover:bg-surface-high hover:shadow-soft transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-heading font-bold text-lg mb-2 text-foreground">
                          {getDiseaseName(prediction.class_name)}
                        </h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityVariant(severity)} className="text-xs">
                            <TranslatedText
                              text={`${severity.charAt(0).toUpperCase() + severity.slice(1)} Confidence`}
                              targetLanguage={language}
                            />
                          </Badge>
                          <span className="text-sm font-medium text-muted-foreground">
                            {formatConfidence(prediction.confidence)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Confidence Progress Bar */}
                    <div className="space-y-1.5">
                      <Progress
                        value={confidencePercentage}
                        className="h-2"
                      />
                      <p className="text-xs text-muted-foreground">
                        <TranslatedText text="Detection confidence level" targetLanguage={language} />
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Remediation Agent Integration for Treatment & ONDC */}
            <div className="pt-4 border-t border-border mt-4">
              <RemediationAgent
                diseases={result.predictions}
                location={result.location}
                imageUrl={result.imageUrl}
              />
            </div>

            {/* Ask Chatbot Button */}
            {onAskChatbot && (
              <div className="mt-3 pt-3 border-t border-border">
                <Button
                  onClick={onAskChatbot}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  <TranslatedText text="Ask Follow-up Questions" targetLanguage={language} />
                </Button>
              </div>
            )}
          </>
        ) : (
          /* No Diseases Detected - Positive Feedback */
          <div className="flex items-start gap-4 p-8 bg-primary/10 rounded-2xl border-0 shadow-inner">
            <div className="p-3 bg-white dark:bg-surface-high rounded-full shadow-sm text-primary">
              <CheckCircle className="h-8 w-8 text-primary flex-shrink-0" />
            </div>
            <div className="flex-1 space-y-2 pt-1">
              <p className="text-xl font-heading font-bold text-primary-fixed-variant dark:text-primary-fixed">
                <TranslatedText text="No Diseases Detected" targetLanguage={language} />
              </p>
              <p className="text-sm font-medium leading-relaxed text-secondary-fixed-variant dark:text-secondary-fixed">
                <TranslatedText
                  text="Great news! Your crops appear to be healthy. No disease symptoms were identified in this image. Continue monitoring your crops regularly for early detection of any potential issues."
                  targetLanguage={language}
                />
              </p>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-primary/10">
                <Leaf className="h-5 w-5 text-primary" />
                <p className="text-sm text-primary font-bold uppercase tracking-wider">
                  <TranslatedText
                    text="Keep up the good work with your crop management!"
                    targetLanguage={language}
                  />
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card >
  );
}

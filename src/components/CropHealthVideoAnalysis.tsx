import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Video, Upload, Loader2, AlertTriangle, CheckCircle, Camera, FileVideo } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { analyzeCropHealthFromVideo } from '@/lib/gemini';

interface VideoAnalysisResult {
  overallHealth: number;
  healthStatus: string;
  diseases: Array<{
    name: string;
    severity: 'Low' | 'Medium' | 'High';
    confidence: number;
    symptoms: string[];
    organicTreatment: string;
  }>;
  pests: Array<{
    name: string;
    severity: 'Low' | 'Medium' | 'High';
    confidence: number;
    organicControl: string;
  }>;
  nutrientDeficiencies: Array<{
    nutrient: string;
    symptoms: string;
    organicSolution: string;
  }>;
  recommendations: string[];
  detailedAnalysis: string;
}

interface CropHealthVideoAnalysisProps {
  cropType: string;
  fieldName: string;
}

export const CropHealthVideoAnalysis = ({ cropType, fieldName }: CropHealthVideoAnalysisProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select a video file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Please select a video smaller than 20MB',
        variant: 'destructive'
      });
      return;
    }

    setVideoFile(file);
    const preview = URL.createObjectURL(file);
    setVideoPreview(preview);
  };
  const analyzeVideo = async () => {
    if (!videoFile) {
      console.log('No video file selected');
      return;
    }

    console.log('Starting video analysis...', {
      fileName: videoFile.name,
      fileSize: videoFile.size,
      fileType: videoFile.type
    });

    setAnalyzing(true);
    
    toast({
      title: 'Analyzing Video',
      description: 'Please wait while we analyze your crop video...'
    });

    try {
      console.log('Calling analyzeCropHealthFromVideo...');
      const result = await analyzeCropHealthFromVideo(videoFile, cropType, fieldName);
      console.log('Analysis result:', result);
      
      setAnalysisResult(result);
      
      toast({
        title: 'Analysis Complete',
        description: 'Video analysis completed successfully'
      });
    } catch (error) {
      console.error('Video analysis failed:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze video. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-600';
    if (health >= 60) return 'text-yellow-600';
    if (health >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Video className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                <TranslatedText text="AI Video Analysis" targetLanguage={language} />
              </h3>
              <p className="text-sm text-muted-foreground">
                <TranslatedText 
                  text="Upload a video of your crops for detailed health analysis" 
                  targetLanguage={language} 
                />
              </p>
            </div>
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
            <Camera className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong><TranslatedText text="Tips for best results:" targetLanguage={language} /></strong>
              <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                <li><TranslatedText text="Record in good lighting (morning or evening)" targetLanguage={language} /></li>
                <li><TranslatedText text="Show close-ups of leaves, stems, and fruits" targetLanguage={language} /></li>
                <li><TranslatedText text="Include any discoloration or damage" targetLanguage={language} /></li>
                <li><TranslatedText text="Keep video under 20MB (30-60 seconds)" targetLanguage={language} /></li>
                <li><TranslatedText text="Pan slowly across the field" targetLanguage={language} /></li>
              </ul>
            </AlertDescription>
          </Alert>

          {!videoPreview ? (
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileVideo className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold">
                    <TranslatedText text="Click to upload" targetLanguage={language} />
                  </span>{' '}
                  <TranslatedText text="or drag and drop" targetLanguage={language} />
                </p>
                <p className="text-xs text-muted-foreground">
                  <TranslatedText text="MP4, MOV, AVI (MAX. 20MB)" targetLanguage={language} />
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept="video/*"
                onChange={handleVideoSelect}
              />
            </label>
          ) : (
            <div className="space-y-4">
              <video
                src={videoPreview}
                controls
                className="w-full rounded-lg border max-h-96"
              />
              <div className="flex gap-2">
                <Button
                  onClick={analyzeVideo}
                  disabled={analyzing}
                  className="flex-1"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <TranslatedText text="Analyzing..." targetLanguage={language} />
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      <TranslatedText text="Analyze Video" targetLanguage={language} />
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setVideoFile(null);
                    setVideoPreview(null);
                    setAnalysisResult(null);
                  }}
                >
                  <TranslatedText text="Clear" targetLanguage={language} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Overall Health Score */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">
                  <TranslatedText text="Overall Health Assessment" targetLanguage={language} />
                </h3>
                <p className="text-sm text-muted-foreground">{cropType} - {fieldName}</p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${getHealthColor(analysisResult.overallHealth)}`}>
                  {analysisResult.overallHealth}%
                </p>
                <p className="text-sm text-muted-foreground">
                  <TranslatedText text={analysisResult.healthStatus} targetLanguage={language} />
                </p>
              </div>
            </div>
            <Progress value={analysisResult.overallHealth} className="h-3" />
          </Card>

          {/* Diseases Detected */}
          {analysisResult.diseases.length > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <TranslatedText text="Diseases Detected" targetLanguage={language} />
              </h4>
              <div className="space-y-4">
                {analysisResult.diseases.map((disease, idx) => (
                  <Alert key={idx} className="bg-orange-50 dark:bg-orange-950 border-orange-200">
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-lg">{disease.name}</span>
                          <div className="flex gap-2">
                            <Badge variant={getSeverityColor(disease.severity)}>
                              {disease.severity}
                            </Badge>
                            <Badge variant="outline">
                              {disease.confidence}% confident
                            </Badge>
                          </div>
                        </div>
                        
                        {disease.symptoms.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">
                              <TranslatedText text="Symptoms:" targetLanguage={language} />
                            </p>
                            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                              {disease.symptoms.map((symptom, i) => (
                                <li key={i}>
                                  <TranslatedText text={symptom} targetLanguage={language} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200">
                          <p className="text-sm font-medium mb-1 text-green-800 dark:text-green-200">
                            <TranslatedText text="Organic Treatment:" targetLanguage={language} />
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            <TranslatedText text={disease.organicTreatment} targetLanguage={language} />
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </Card>
          )}

          {/* Pests Detected */}
          {analysisResult.pests.length > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <TranslatedText text="Pest Infestation" targetLanguage={language} />
              </h4>
              <div className="space-y-4">
                {analysisResult.pests.map((pest, idx) => (
                  <Alert key={idx} className="bg-red-50 dark:bg-red-950 border-red-200">
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-lg">{pest.name}</span>
                          <div className="flex gap-2">
                            <Badge variant={getSeverityColor(pest.severity)}>
                              {pest.severity}
                            </Badge>
                            <Badge variant="outline">
                              {pest.confidence}% confident
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200">
                          <p className="text-sm font-medium mb-1 text-green-800 dark:text-green-200">
                            <TranslatedText text="Organic Control:" targetLanguage={language} />
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            <TranslatedText text={pest.organicControl} targetLanguage={language} />
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </Card>
          )}

          {/* Nutrient Deficiencies */}
          {analysisResult.nutrientDeficiencies.length > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <TranslatedText text="Nutrient Deficiencies" targetLanguage={language} />
              </h4>
              <div className="space-y-4">
                {analysisResult.nutrientDeficiencies.map((deficiency, idx) => (
                  <Alert key={idx} className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200">
                    <AlertDescription>
                      <div className="space-y-2">
                        <span className="font-medium text-lg">{deficiency.nutrient}</span>
                        <p className="text-sm text-muted-foreground">
                          <TranslatedText text={deficiency.symptoms} targetLanguage={language} />
                        </p>
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200">
                          <p className="text-sm font-medium mb-1 text-green-800 dark:text-green-200">
                            <TranslatedText text="Organic Solution:" targetLanguage={language} />
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            <TranslatedText text={deficiency.organicSolution} targetLanguage={language} />
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </Card>
          )}

          {/* Recommendations */}
          {analysisResult.recommendations.length > 0 && (
            <Card className="p-6">
              <h4 className="font-semibold flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <TranslatedText text="Recommendations" targetLanguage={language} />
              </h4>
              <ul className="space-y-2">
                {analysisResult.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span className="text-sm">
                      <TranslatedText text={rec} targetLanguage={language} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Detailed Analysis */}
          {analysisResult.detailedAnalysis && (
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
              <h4 className="font-semibold mb-3">
                <TranslatedText text="Detailed AI Analysis" targetLanguage={language} />
              </h4>
              <p className="text-sm leading-relaxed">
                <TranslatedText text={analysisResult.detailedAnalysis} targetLanguage={language} />
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

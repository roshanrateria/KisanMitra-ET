import { useState } from 'react';
import { ImageUploadComponent } from '@/components/disease-detection/ImageUploadComponent';
import { DetectionImageWithBoundingBoxes } from '@/components/disease-detection/DetectionImageWithBoundingBoxes';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { detectDiseases } from '@/lib/disease-detection/api';
import { DetectionResult } from '@/lib/disease-detection/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, MapPin, Clock } from 'lucide-react';

export default function DiseaseDetectionDemo() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [highlightedPrediction, setHighlightedPrediction] = useState<number | null>(null);
  const { toast } = useToast();

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    setResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const detectionResult = await detectDiseases(selectedFile);
      setResult(detectionResult);
      toast({
        title: 'Analysis Complete',
        description: `Detected ${detectionResult.count} disease(s) in the image.`,
      });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'An error occurred during analysis.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 max-w-4xl">
      <Card className="shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl sm:text-3xl">Disease Detection Demo</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Upload a crop image to detect diseases using AI-powered analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUploadComponent
            onImageSelect={handleImageSelect}
            isProcessing={isProcessing}
          />

          {selectedFile && !result && (
            <Button
              onClick={handleAnalyze}
              disabled={isProcessing}
              className="w-full transition-all hover:scale-[1.02]"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing Image...
                </>
              ) : (
                'Analyze Image for Diseases'
              )}
            </Button>
          )}

          {result && (
            <Card className="border-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Detection Results</CardTitle>
                  {result.count === 0 ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {result.count} Disease{result.count > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image with Bounding Boxes */}
                {result.predictions.length > 0 && (
                  <div className="mb-6">
                    <DetectionImageWithBoundingBoxes
                      imageUrl={result.imageUrl}
                      predictions={result.predictions}
                      highlightedIndex={highlightedPrediction}
                      onPredictionHover={setHighlightedPrediction}
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(result.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {result.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {result.location.lat.toFixed(4)}, {result.location.lng.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Predictions */}
                {result.predictions.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Detected Diseases
                    </h4>
                    {result.predictions.map((pred, idx) => {
                      const confidencePercent = pred.confidence * 100;
                      const getSeverityColor = (confidence: number) => {
                        if (confidence >= 80) return 'text-red-600';
                        if (confidence >= 50) return 'text-orange-600';
                        return 'text-yellow-600';
                      };
                      const isHighlighted = highlightedPrediction === idx;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`border rounded-lg p-4 space-y-3 transition-all duration-200 cursor-pointer ${
                            isHighlighted ? 'shadow-lg ring-2 ring-primary scale-[1.02]' : 'hover:shadow-md'
                          }`}
                          onMouseEnter={() => setHighlightedPrediction(idx)}
                          onMouseLeave={() => setHighlightedPrediction(null)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-semibold text-base">{pred.class_name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                BBox: [{pred.bbox.map(v => v.toFixed(1)).join(', ')}]
                              </p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={`${getSeverityColor(confidencePercent)} border-current`}
                            >
                              {confidencePercent.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Confidence Level</span>
                              <span className="font-medium">{confidencePercent.toFixed(1)}%</span>
                            </div>
                            <Progress 
                              value={confidencePercent} 
                              className="h-2"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                    <p className="text-lg font-medium text-green-700">
                      No diseases detected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your crops appear healthy!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

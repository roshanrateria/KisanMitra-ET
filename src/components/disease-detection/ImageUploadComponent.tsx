import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateText } from '@/lib/bhashini';
import { compressImage, isSlowConnection } from '@/lib/disease-detection/imageUtils';

interface ImageUploadComponentProps {
  onImageSelect: (file: File) => void;
  isProcessing?: boolean;
  maxSizeBytes?: number;
  acceptedFormats?: string[];
  showCamera?: boolean;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ACCEPTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];

export function ImageUploadComponent({
  onImageSelect,
  isProcessing = false,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  showCamera = true,
}: ImageUploadComponentProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { language } = useLanguage();

  // Validate file type and size
  const validateFile = useCallback(async (file: File): Promise<boolean> => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      const titleText = language !== 'en'
        ? await translateText('Invalid File Type', 'en', language).catch(() => 'Invalid File Type')
        : 'Invalid File Type';
      const descText = language !== 'en'
        ? await translateText('Please upload JPG, PNG, or WEBP images only.', 'en', language).catch(() => 'Please upload JPG, PNG, or WEBP images only.')
        : 'Please upload JPG, PNG, or WEBP images only.';
      
      toast({
        title: titleText,
        description: descText,
        variant: 'destructive',
      });
      return false;
    }

    // Check file size
    if (file.size > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      
      const titleText = language !== 'en'
        ? await translateText('File Too Large', 'en', language).catch(() => 'File Too Large')
        : 'File Too Large';
      const descBase = `Maximum file size is ${maxSizeMB}MB. Your file is ${fileSizeMB}MB.`;
      const descText = language !== 'en'
        ? await translateText(descBase, 'en', language).catch(() => descBase)
        : descBase;
      
      toast({
        title: titleText,
        description: descText,
        variant: 'destructive',
      });
      return false;
    }

    return true;
  }, [acceptedFormats, maxSizeBytes, toast, language]);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    const isValid = await validateFile(file);
    if (!isValid) {
      return;
    }

    // Compress image if connection is slow
    let processedFile = file;
    if (isSlowConnection()) {
      try {
        processedFile = await compressImage(file, 2, 0.8);
        
        // Show compression notification
        const titleText = language !== 'en'
          ? await translateText('Image Compressed', 'en', language).catch(() => 'Image Compressed')
          : 'Image Compressed';
        const descText = language !== 'en'
          ? await translateText('Image optimized for your connection speed.', 'en', language).catch(() => 'Image optimized for your connection speed.')
          : 'Image optimized for your connection speed.';
        
        toast({
          title: titleText,
          description: descText,
        });
      } catch (error) {
        console.error('Image compression failed:', error);
        // Continue with original file if compression fails
      }
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(processedFile);

    setSelectedFile(processedFile);
    onImageSelect(processedFile);
  }, [validateFile, onImageSelect, toast, language]);

  // Handle drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileSelect(acceptedFiles[0]);
    }
  }, [handleFileSelect]);

  // Handle file rejection
  const onDropRejected = useCallback(async () => {
    const titleText = language !== 'en'
      ? await translateText('Invalid File', 'en', language).catch(() => 'Invalid File')
      : 'Invalid File';
    const descText = language !== 'en'
      ? await translateText('Please upload a valid image file (JPG, PNG, or WEBP).', 'en', language).catch(() => 'Please upload a valid image file (JPG, PNG, or WEBP).')
      : 'Please upload a valid image file (JPG, PNG, or WEBP).';
    
    toast({
      title: titleText,
      description: descText,
      variant: 'destructive',
    });
  }, [toast, language]);

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: maxSizeBytes,
    multiple: false,
    disabled: isProcessing,
  });

  // Clear selected image
  const clearImage = useCallback(() => {
    setPreview(null);
    setSelectedFile(null);
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Prefer back camera on mobile
        audio: false,
      });
      
      setVideoStream(stream);
      setCameraActive(true);
      
      // Set video source once ref is available
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera access error:', error);
      
      const titleText = language !== 'en'
        ? await translateText('Camera Access Denied', 'en', language).catch(() => 'Camera Access Denied')
        : 'Camera Access Denied';
      const descText = language !== 'en'
        ? await translateText('Unable to access camera. Please check your permissions.', 'en', language).catch(() => 'Unable to access camera. Please check your permissions.')
        : 'Unable to access camera. Please check your permissions.';
      
      toast({
        title: titleText,
        description: descText,
        variant: 'destructive',
      });
    }
  }, [toast, language]);

  // Stop camera and release resources
  const stopCamera = useCallback(() => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setCameraActive(false);
  }, [videoStream]);

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob then to File
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File(
            [blob],
            `camera-capture-${Date.now()}.jpg`,
            { type: 'image/jpeg' }
          );
          
          // Stop camera
          stopCamera();
          
          // Handle the captured file
          handleFileSelect(file);
        }
      }, 'image/jpeg', 0.95);
    }
  }, [stopCamera, handleFileSelect]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  // Set video source when stream is available
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  return (
    <Card className="w-full bg-surface-lowest rounded-3xl shadow-soft border-0 transition-shadow duration-400 hover:shadow-elevated">
      <CardContent className="p-6 sm:p-8">
        {cameraActive ? (
          // Camera view with fade-in animation
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="relative rounded-lg overflow-hidden border-2 border-border bg-black shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto max-h-[400px] object-contain"
              />
              {/* Camera active indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500/90 text-white px-3 py-1.5 rounded-full text-xs font-medium">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <TranslatedText text="Camera Active" targetLanguage={language} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button 
                onClick={capturePhoto} 
                size="lg"
                className="w-full sm:w-auto transition-all hover:scale-105"
              >
                <Camera className="h-5 w-5 mr-2" />
                <TranslatedText text="Capture Photo" targetLanguage={language} />
              </Button>
              <Button 
                onClick={stopCamera} 
                variant="outline" 
                size="lg"
                className="w-full sm:w-auto"
              >
                <TranslatedText text="Cancel" targetLanguage={language} />
              </Button>
            </div>
            {/* Hidden canvas for capturing photo */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : !preview ? (
          // Upload/Camera selection view with animations
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-[2rem] p-8 sm:p-12 text-center cursor-pointer
                transition-all duration-300 ease-in-out bg-surface-container-low
                ${isDragActive 
                  ? 'border-primary bg-primary/10 shadow-glow scale-[1.02]' 
                  : 'border-outline-variant/30 hover:border-primary/50 hover:bg-primary/5'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3 sm:gap-4">
                <div className={`
                  rounded-full bg-primary/10 p-3 sm:p-4 transition-transform duration-200
                  ${isDragActive ? 'scale-110' : 'scale-100'}
                `}>
                  {isDragActive ? (
                    <ImageIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary animate-pulse" />
                  ) : (
                    <Upload className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                  )}
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-lg sm:text-xl font-heading font-semibold text-foreground">
                    {isDragActive ? (
                      <TranslatedText text="Drop your image here" targetLanguage={language} />
                    ) : (
                      <TranslatedText text="Select or drop an image" targetLanguage={language} />
                    )}
                  </p>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">
                    <TranslatedText text="Tap to browse photos" targetLanguage={language} />
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-3 font-medium">
                    <TranslatedText 
                      text={`Supports JPG, PNG, WEBP (max ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB)`} 
                      targetLanguage={language} 
                    />
                  </p>
                </div>
              </div>
            </div>
            
            {showCamera && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-muted-foreground/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    <TranslatedText text="Or" targetLanguage={language} />
                  </span>
                </div>
              </div>
            )}
            
            {showCamera && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={startCamera}
                  variant="outline"
                  size="lg"
                  disabled={isProcessing}
                  className="w-full sm:w-auto transition-all hover:scale-105"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  <TranslatedText text="Use Camera" targetLanguage={language} />
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Preview view with fade-in animation
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="relative rounded-lg overflow-hidden border-2 border-border shadow-md group">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-auto max-h-[400px] object-contain bg-muted"
              />
              {/* Processing overlay with spinner */}
              {isProcessing && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center space-y-3">
                    <div className="relative">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-8 w-8 rounded-full border-2 border-primary/20" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        <TranslatedText text="Uploading image..." targetLanguage={language} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <TranslatedText text="Please wait" targetLanguage={language} />
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* Clear button with hover effect */}
              {!isProcessing && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded">
                    <ImageIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium truncate max-w-[200px] sm:max-w-none">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {isProcessing && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

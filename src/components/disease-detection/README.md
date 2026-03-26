# Disease Detection Components

This directory contains React components for the AI-powered image-based disease detection feature in Kisan Mitra.

## Components

### ImageUploadComponent

A drag-and-drop image upload component with file validation and preview functionality.

#### Features

- **Drag and Drop**: Users can drag image files directly onto the upload area
- **File Picker**: Click to open the native file picker dialog
- **File Type Validation**: Only accepts JPEG, PNG, and WEBP images
- **File Size Validation**: Enforces a maximum file size (default: 10MB)
- **Image Preview**: Displays a preview of the selected image
- **Error Handling**: Shows user-friendly error messages for invalid files
- **Loading States**: Disables interaction during processing

#### Props

```typescript
interface ImageUploadComponentProps {
  onImageSelect: (file: File) => void;  // Callback when a valid file is selected
  isProcessing?: boolean;                // Disable interaction during processing
  maxSizeBytes?: number;                 // Maximum file size (default: 10MB)
  acceptedFormats?: string[];            // Accepted MIME types
  showCamera?: boolean;                  // Show camera capture button (future)
}
```

#### Usage

```tsx
import { ImageUploadComponent } from '@/components/disease-detection/ImageUploadComponent';

function MyComponent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    // Process the file...
  };

  return (
    <ImageUploadComponent
      onImageSelect={handleImageSelect}
      isProcessing={isProcessing}
    />
  );
}
```

#### Validation Rules

1. **File Type**: Must be one of:
   - `image/jpeg` (.jpg, .jpeg)
   - `image/png` (.png)
   - `image/webp` (.webp)

2. **File Size**: Must not exceed 10MB (configurable via `maxSizeBytes` prop)

3. **Single File**: Only one file can be selected at a time

#### Error Messages

- **Invalid File Type**: "Please upload JPG, PNG, or WEBP images only."
- **File Too Large**: "Maximum file size is XMB. Your file is YMB."
- **Invalid File**: "Please upload a valid image file (JPG, PNG, or WEBP)."

#### Implementation Details

- Uses `react-dropzone` library for drag-and-drop functionality
- Uses Shadcn/UI components (Card, Button) for consistent styling
- Uses `useToast` hook for error notifications
- Validates files before creating preview
- Converts files to data URLs for preview display
- Provides visual feedback for drag-over state

#### Requirements Satisfied

- **1.1**: Displays drag-and-drop zone for image files
- **1.2**: Provides visual feedback when dragging files
- **1.3**: Accepts valid image file types (JPEG, PNG, WEBP)
- **1.4**: Rejects invalid file types with error message
- **1.5**: Opens file picker on click
- **1.9**: Rejects files exceeding 10MB with error message
- **1.10**: Displays preview of selected image

## Demo Page

A demo page is available at `src/pages/DiseaseDetectionDemo.tsx` that demonstrates the complete workflow:

1. Upload an image using the ImageUploadComponent
2. Click "Analyze Image" to send the image to the disease detection API
3. View the detection results including disease names, confidence scores, and bounding boxes

## Testing

### Manual Testing

1. Start the development server: `npm run dev`
2. Navigate to the disease detection demo page
3. Test the following scenarios:
   - Drag and drop a valid image (JPG, PNG, or WEBP)
   - Click to select an image from file picker
   - Try to upload an invalid file type (e.g., PDF, TXT)
   - Try to upload a file larger than 10MB
   - Verify the preview displays correctly
   - Clear the selected image and upload a new one

### Automated Testing

Property-based tests and unit tests will be added in subsequent tasks:
- Task 2.2: Property test for file validation consistency
- Task 2.4: Property test for camera resource cleanup

## Future Enhancements

- **Camera Capture** (Task 2.3): Add camera button to capture photos directly
- **Multiple Images**: Support batch upload for multiple images
- **Image Compression**: Automatically compress large images before upload
- **Crop/Rotate**: Allow users to crop or rotate images before analysis

## Dependencies

- `react-dropzone`: ^15.0.0 - Drag and drop functionality
- `lucide-react`: Icons (Upload, X, Image)
- Shadcn/UI components: Card, Button
- Custom hooks: useToast

## Related Files

- `src/lib/disease-detection/api.ts` - API service for disease detection
- `src/lib/disease-detection/types.ts` - TypeScript type definitions
- `src/lib/disease-detection/schemas.ts` - Zod validation schemas
- `src/pages/DiseaseDetectionDemo.tsx` - Demo page for testing

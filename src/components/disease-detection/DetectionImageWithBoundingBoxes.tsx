import { useState, useEffect, useRef } from 'react';
import { Prediction } from '@/lib/disease-detection/types';

interface DetectionImageWithBoundingBoxesProps {
  imageUrl: string;
  predictions: Prediction[];
  highlightedIndex?: number | null;
  onPredictionHover?: (index: number | null) => void;
}

/**
 * Color palette for different disease classes
 * Ensures distinct colors with good contrast
 */
const DISEASE_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

/**
 * Get a consistent color for a disease class name
 */
const getDiseaseColor = (className: string, allClasses: string[]): string => {
  const uniqueClasses = Array.from(new Set(allClasses));
  const index = uniqueClasses.indexOf(className);
  return DISEASE_COLORS[index % DISEASE_COLORS.length];
};

/**
 * Format confidence score as percentage with one decimal place
 */
const formatConfidence = (confidence: number): string => {
  return `${(Math.round(confidence * 1000) / 10).toFixed(1)}%`;
};

export function DetectionImageWithBoundingBoxes({
  imageUrl,
  predictions,
  highlightedIndex = null,
  onPredictionHover,
}: DetectionImageWithBoundingBoxesProps) {
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load image and get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Get all unique disease class names for consistent coloring
  const allClassNames = predictions.map(p => p.class_name);

  // Check if there are any predictions to display
  const hasDetections = predictions.length > 0;

  return (
    <div className="relative w-full">
      {/* Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={hasDetections ? "Detection result with bounding boxes" : "Healthy crop image"}
        className="w-full h-auto rounded-lg"
      />

      {/* SVG Overlay with Bounding Boxes - Only render if there are detections */}
      {hasDetections && imageDimensions && (
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {predictions.map((prediction, index) => {
            const [x1, y1, x2, y2] = prediction.bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            const color = getDiseaseColor(prediction.class_name, allClassNames);
            const isHighlighted = highlightedIndex === index;
            const opacity = isHighlighted ? 1 : 0.7;

            // Label dimensions
            const labelText = `${prediction.class_name} ${formatConfidence(prediction.confidence)}`;
            const labelPadding = 8;
            const labelHeight = 24;
            const labelWidth = labelText.length * 8 + labelPadding * 2;

            return (
              <g
                key={index}
                className="pointer-events-auto cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => onPredictionHover?.(index)}
                onMouseLeave={() => onPredictionHover?.(null)}
                opacity={opacity}
              >
                {/* Bounding Box Rectangle */}
                <rect
                  x={x1}
                  y={y1}
                  width={width}
                  height={height}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHighlighted ? 4 : 3}
                  strokeDasharray={isHighlighted ? '0' : '5,5'}
                  className="transition-all duration-200"
                />

                {/* Label Background */}
                <rect
                  x={x1}
                  y={Math.max(0, y1 - labelHeight - 4)}
                  width={labelWidth}
                  height={labelHeight}
                  fill={color}
                  rx={4}
                  className="transition-all duration-200"
                />

                {/* Label Text */}
                <text
                  x={x1 + labelPadding}
                  y={Math.max(labelHeight - 8, y1 - 12)}
                  fill="white"
                  fontSize="14"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  className="select-none"
                >
                  {labelText}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

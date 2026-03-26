import io
import os
import json
from fastapi import FastAPI, Request, Response
from PIL import Image

# Prevent runtime dependency auto-installs (slow and fragile in serverless containers).
os.environ.setdefault("YOLO_AUTOINSTALL", "False")

from ultralytics import YOLO

# Register HEIF support if available
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    print("Warning: pillow-heif not available, HEIF/HEIC images won't be supported")

app = FastAPI(title="Plant Disease Detection API - SageMaker Serverless")

try:
    model = YOLO("model.pt")
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {e}")
    # Fallback to a tiny model just so the app doesn't crash if the file is missing during build
    print("Warning: 'model.pt' not found, loading 'yolov8n.pt' as placeholder.")
    model = YOLO("yolov8n.pt") 

@app.get("/ping")
def ping():
    """Determine if the container is working and healthy."""
    return Response(content="\n", status_code=200, media_type="application/json")


@app.post("/invocations")
async def invocations(request: Request):
    """Do an inference on a single batch of data."""
    try:
        # Check standard SageMaker content types if needed, but we assume image bytes
        # Read the raw bytes from the request body
        image_data = await request.body()
        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        # Run Inference
        results = model.predict(image, conf=0.25)
        
        # Process Results
        detections = []
        result = results[0]

        for box in result.boxes:
            coords = box.xyxy[0].tolist()
            confidence = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = result.names[cls_id]

            detections.append({
                "bbox": coords,
                "confidence": confidence,
                "class_id": cls_id,
                "class_name": cls_name
            })

        response_body = {
            "count": len(detections),
            "predictions": detections
        }

        # SageMaker expects JSON response
        return Response(content=json.dumps(response_body), status_code=200, media_type="application/json")

    except Exception as e:
        return Response(content=json.dumps({"error": str(e)}), status_code=500, media_type="application/json")

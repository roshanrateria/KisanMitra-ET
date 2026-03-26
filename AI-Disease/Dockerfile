# Use a lightweight Python base image
FROM python:3.9-slim

# Set working directory
WORKDIR /code

# Install system dependencies required for OpenCV and pillow-heif
# libgl1-mesa-glx and libglib2.0-0 are critical for cv2 to work in Docker
# libheif-dev is required for pillow-heif to handle HEIF/HEIC images
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libheif-dev \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for SageMaker
ENV PYTHONDONTWRITEBYTECODE=TRUE \
    PYTHONUNBUFFERED=TRUE \
    PATH="/code:${PATH}"

# Copy requirements file first to leverage Docker caching
COPY requirements.txt .

# Install Python dependencies
# We use the CPU version of PyTorch to keep the image size small for deployment
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the application code and the model
COPY . .

# Make the serve script executable for SageMaker
RUN chmod +x /code/serve

# SageMaker models typically run on port 8080
EXPOSE 8080


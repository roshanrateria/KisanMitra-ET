#!/bin/bash
set -e

# Configuration
REGION=$(aws configure get region)
REGION=${REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_NAME="kisanmitra-disease-model"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}:${IMAGE_TAG}"

MODEL_NAME="kisanmitra-disease-model-$(date +%s)"
ENDPOINT_CONFIG_NAME="${MODEL_NAME}-config"
ENDPOINT_NAME="kisanmitra-disease-endpoint"
EXECUTION_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/SageMakerExecutionRole"

echo "============================================="
echo " Deploying Plant Disease Model to SageMaker "
echo "============================================="
echo "Region: $REGION"
echo "Account ID: $ACCOUNT_ID"
echo "Repository: $REPO_NAME"

# 1. Build Docker Image
echo "Building Docker image..."
docker build -t $REPO_NAME .

# 2. Authenticate to ECR
echo "Authenticating to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# 3. Create ECR repository if it doesn't exist
echo "Checking ECR repository..."
aws ecr describe-repositories --repository-names $REPO_NAME --region $REGION || aws ecr create-repository --repository-name $REPO_NAME --region $REGION

# 4. Tag and Push Image to ECR
echo "Pushing image to ECR..."
docker tag ${REPO_NAME}:latest $FULL_IMAGE_NAME
docker push $FULL_IMAGE_NAME

# 5. Check if SageMakerExecutionRole exists, if not, print warning
if ! aws iam get-role --role-name SageMakerExecutionRole &> /dev/null; then
  echo "WARNING: Role SageMakerExecutionRole not found!"
  echo "Please create an IAM Role named 'SageMakerExecutionRole' with 'AmazonSageMakerFullAccess' policies."
  echo "Deployment will likely fail at model creation."
fi

# 6. Create SageMaker Model
echo "Creating SageMaker Model: $MODEL_NAME"
aws sagemaker create-model \
    --model-name $MODEL_NAME \
    --primary-container Image=$FULL_IMAGE_NAME \
    --execution-role-arn $EXECUTION_ROLE_ARN \
    --region $REGION

# 7. Create SageMaker Serverless Endpoint Configuration
# Note: MemorySizeInMB defines the RAM allocated. Set to 2048 MB for PyTorch and YOLO to avoid OOM.
echo "Creating Serverless Endpoint Configuration: $ENDPOINT_CONFIG_NAME"
aws sagemaker create-endpoint-config \
    --endpoint-config-name $ENDPOINT_CONFIG_NAME \
    --production-variants VariantName=AllTraffic,ModelName=$MODEL_NAME,ServerlessConfig="{MemorySizeInMB=2048,MaxConcurrency=5}" \
    --region $REGION

# 8. Create or Update SageMaker Endpoint
echo "Checking if endpoint $ENDPOINT_NAME exists..."
if aws sagemaker describe-endpoint --endpoint-name $ENDPOINT_NAME --region $REGION &> /dev/null; then
    echo "Updating existing endpoint..."
    aws sagemaker update-endpoint \
        --endpoint-name $ENDPOINT_NAME \
        --endpoint-config-name $ENDPOINT_CONFIG_NAME \
        --region $REGION
else
    echo "Creating new endpoint..."
    aws sagemaker create-endpoint \
        --endpoint-name $ENDPOINT_NAME \
        --endpoint-config-name $ENDPOINT_CONFIG_NAME \
        --region $REGION
fi

echo "============================================="
echo " Deployment Initiated! "
echo " Endpoint Name: $ENDPOINT_NAME"
echo " Note: It will take a few minutes for the endpoint to become 'InService'."
echo " Check status with: aws sagemaker describe-endpoint --endpoint-name $ENDPOINT_NAME"
echo "============================================="

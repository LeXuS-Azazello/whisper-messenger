#!/bin/bash
# Build and push whisper-onnx image to Docker Hub

set -e

IMAGE_NAME="azazellosaraksh/debugging-whisper-onnx:latest"

echo "Building Docker image: $IMAGE_NAME"

cd "$(dirname "$0")"
docker build -t "$IMAGE_NAME" .

echo "Pushing to Docker Hub..."
docker push "$IMAGE_NAME"

echo "Done! Image pushed successfully."

#!/bin/bash
# Build and push qwen3-asr image to Docker Hub

set -e

IMAGE_NAME="azazellosaraksh/qwen3-asr:latest"

echo "Building Docker image: $IMAGE_NAME"

cd "$(dirname "$0")"
docker build -t "$IMAGE_NAME" .

echo "Pushing to Docker Hub..."
# Note: Ensure you are logged in to docker hub
docker push "$IMAGE_NAME"

echo "Done! Image pushed successfully."

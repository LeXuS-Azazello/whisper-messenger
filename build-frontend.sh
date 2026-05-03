#!/bin/bash
# Build and push frontend image to Docker Hub

set -e

IMAGE_NAME="azazellosaraksh/echo-frontend:latest"

echo "Building Docker image: $IMAGE_NAME"

docker build -t "$IMAGE_NAME" .

echo "Pushing to Docker Hub..."
docker push "$IMAGE_NAME"

echo "Done! Image pushed successfully."

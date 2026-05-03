#!/bin/bash
# Build and push mtproto-bridge image to Docker Hub

set -e

IMAGE_NAME="azazellosaraksh/debugging-mtproto-bridge:latest"

echo "Building Docker image: $IMAGE_NAME"

cd "$(dirname "$0")"
docker build -t "$IMAGE_NAME" .

echo "Pushing to Docker Hub..."
docker push "$IMAGE_NAME"

echo "Done! Image pushed successfully."
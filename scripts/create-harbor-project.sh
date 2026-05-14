#!/bin/bash

# Create a new project in Harbor via API
# Usage: ./create-harbor-project.sh <project_name> <username> <password>

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

PROJECT_NAME=${1:-${HARBOR_PROJECT:-devcenter}}
HARBOR_USER=${2:-${HARBOR_USER:-admin}}
HARBOR_PASS=${3:-${HARBOR_PASS}}
HARBOR_HOST=${HARBOR_HOST:-harbor.dev.takatan.cloud}

if [ -z "$HARBOR_PASS" ]; then
    echo "Usage: $0 <project_name> <username> <password>"
    exit 1
fi

echo "Creating project '$PROJECT_NAME' in $HARBOR_HOST..."

API_URL="${HARBOR_API_URL:-https://${HARBOR_HOST}/api/v2.0}"

curl -u "$HARBOR_USER:$HARBOR_PASS" -X POST "${API_URL}/projects" \
  -H "Content-Type: application/json" \
  -d "{
    \"project_name\": \"$PROJECT_NAME\",
    \"metadata\": {
      \"public\": \"true\"
    },
    \"storage_limit\": -1
  }"

echo ""
echo "Done."

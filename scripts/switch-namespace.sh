#!/bin/bash
set -e

OLD_NAMESPACE="${1:-debugging-trash-cloud}"
NEW_NAMESPACE="${2:-debugging-testcrash-cloud}"

echo "Switching namespace from $OLD_NAMESPACE to $NEW_NAMESPACE"

find kubernetes -name "*.yaml" -type f | while read -r file; do
  sed -i "s/namespace: $OLD_NAMESPACE/namespace: $NEW_NAMESPACE/g" "$file"
done

echo "Done. Showing changes:"
grep -r "namespace:" kubernetes/*.yaml | head -10
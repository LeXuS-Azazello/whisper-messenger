#!/bin/bash
set -e

NEW_NS="${1:-debugging-testcrash-cloud}"

echo "Switching all kubernetes manifests to namespace: $NEW_NS"

find kubernetes -name "*.yaml" -type f | while read -r file; do
  sed -i "s/namespace: debugging-[a-z].*-[a-z].*/namespace: $NEW_NS/g" "$file"
done

echo "Done"
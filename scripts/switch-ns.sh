#!/bin/bash
set -euo pipefail

NEW_NS="${1:-debugging-testcrash-pub}"

echo "Switching all kubernetes manifests to namespace: $NEW_NS"

find kubernetes -name "*.yaml" -type f | while read -r file; do
  # Skip kubeconfig files and non-K8s files
  if [[ "$file" == *"kubeconfig"* ]] || [[ "$file" == *"cloudflared"* ]]; then
    continue
  fi
  sed -i "s/namespace: debugging-[a-z].*-[a-z].*/namespace: $NEW_NS/g" "$file"
done

echo "Done. All manifests updated to namespace: $NEW_NS"
echo ""
echo "To verify:"
echo "  grep -r 'namespace:' kubernetes/*.yaml kubernetes/**/*.yaml"

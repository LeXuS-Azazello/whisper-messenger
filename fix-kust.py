import re
with open('kubernetes/base/kustomization.yaml', 'r') as f:
    c = f.read()
c = re.sub(r'configMapGenerator:.*', '', c, flags=re.DOTALL)
with open('kubernetes/base/kustomization.yaml', 'w') as f:
    f.write(c)

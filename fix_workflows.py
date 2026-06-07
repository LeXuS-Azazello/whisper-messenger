import os
import glob

workflow_dir = '/home/lexus/projects/telegramBots/fb_insta_voice_msg/.forgejo/workflows'
files = glob.glob(os.path.join(workflow_dir, '*.yaml'))

old_block = """          if ! command -v kubectl >/dev/null 2>&1; then
            curl -sLO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
            chmod +x kubectl
            if command -v sudo >/dev/null 2>&1; then
              sudo mv kubectl /usr/local/bin/
            else
              mkdir -p /usr/local/bin
              mv kubectl /usr/local/bin/
              export PATH=$PATH:/usr/local/bin
            fi
          fi"""

new_block = """          if ! command -v kubectl >/dev/null 2>&1; then
            curl -sLO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
            chmod +x kubectl
            mkdir -p $GITHUB_WORKSPACE/bin
            mv kubectl $GITHUB_WORKSPACE/bin/
            export PATH=$GITHUB_WORKSPACE/bin:$PATH
          fi"""

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    if old_block in content:
        content = content.replace(old_block, new_block)
        with open(f, 'w') as file:
            file.write(content)
        print(f"Fixed {f}")

import os

workflows = {
    'samesame.yaml': 'kubectl rollout restart deployment samesame -n debugging-testcrash-pub',
    'funasr.yaml': 'kubectl rollout restart deployment funasr -n debugging-testcrash-pub',
    'voicemsg.yaml': 'kubectl rollout restart deployment frontend -n debugging-testcrash-pub',
    'whatsapp-baileys-manager.yaml': 'kubectl rollout restart deployment whatsapp-baileys-manager -n debugging-testcrash-pub',
    'tg-client-manager.yaml': 'kubectl rollout restart deployment tg-client-manager -n debugging-testcrash-pub',
    'facebook-fca-manager.yaml': 'kubectl rollout restart deployment facebook-fca-manager -n debugging-testcrash-pub',
    'instagram-fca-manager.yaml': 'kubectl rollout restart deployment instagram-fca-manager -n debugging-testcrash-pub',
    'voicemsg-tester.yaml': 'kubectl rollout restart deployment voicemsg-tester -n debugging-testcrash-pub',
    'tg-client.yaml': 'kubectl delete pod -l app=tg-client-user -n debugging-testcrash-pub',
    'whatsapp-baileys-client.yaml': 'kubectl delete pod -l app=wa-baileys-client -n debugging-testcrash-pub',
    'facebook-fca-client.yaml': 'kubectl delete pod -l app=facebook-fca-client -n debugging-testcrash-pub',
    'instagram-fca-client.yaml': 'kubectl delete pod -l app=instagram-fca-client -n debugging-testcrash-pub'
}

base_path = '.forgejo/workflows'

for filename, cmd in workflows.items():
    filepath = os.path.join(base_path, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
        
        if 'kube-dc login' not in content:
            append_block = f"""
      - name: Trigger Kubernetes Rollout
        env:
          DOCKER_FORGE_PACKAGE_TOKEN: ${{{{ secrets.DOCKER_FORGE_PACKAGE_TOKEN }}}}
        run: |
          # Login and configure kubectl
          kube-dc login --domain kube-dc.cloud --org debugging

          # Switch to project context
          kube-dc use kube-dc.cloud/debugging/testcrash-pub

          # Trigger restart
          {cmd}
"""
            with open(filepath, 'a') as f:
                f.write(append_block)
            print(f"Updated {filename}")
        else:
            print(f"Already updated {filename}")


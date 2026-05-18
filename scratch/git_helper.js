import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const cwd = '/home/lexus/projects/telegramBots/fb_insta_voice_msg';

function run(cmd) {
    try {
        console.log(`Executing: ${cmd}`);
        const out = execSync(cmd, { cwd, encoding: 'utf8' });
        console.log(`Success:`, out);
        return out;
    } catch (err) {
        console.error(`Error:`, err.message);
        if (err.stdout) console.error('Stdout:', err.stdout);
        if (err.stderr) console.error('Stderr:', err.stderr);
        return `ERROR: ${err.message}\nSTDOUT: ${err.stdout}\nSTDERR: ${err.stderr}`;
    }
}

const action = process.argv[2] || 'status';

if (action === 'status') {
    const statusOut = run('git status');
    fs.writeFileSync(path.join(cwd, 'scratch/git_status.txt'), statusOut);
} else if (action === 'commit') {
    const msg = process.argv[3] || 'feat: remove qwen and ollama in favor of whisper turbo';
    run('git add -A');
    const commitOut = run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
    fs.writeFileSync(path.join(cwd, 'scratch/git_commit.txt'), commitOut);
} else if (action === 'push') {
    const pushOut = run('git push origin main');
    fs.writeFileSync(path.join(cwd, 'scratch/git_push.txt'), pushOut);
} else if (action === 'deploy') {
    const deployOut = run('bash scripts/deploy.sh');
    fs.writeFileSync(path.join(cwd, 'scratch/git_deploy.txt'), deployOut);
}

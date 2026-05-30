/** @jsxImportSource preact */

export const AIConfigCard = (props: { checks: any, env: any }) => {
    return (
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">AI & Speech Models</h3>
                <span class="status-tag active" id="whisper-status-tag" style="background: rgba(139, 92, 246, 0.15); color: #C084FC;">{props.checks.ASR_PROVIDER_NAME || 'FunASR'}</span>
            </div>
            
            <div class="input-group" style="margin-top: 15px">
                <label>Transcription (ASR) URL</label>
                <input type="text" id="ai-asr-url" placeholder="http://funasr...:50001" />
            </div>
            <div class="input-group">
                <label>Transcription Secret</label>
                <input type="password" id="ai-asr-secret" placeholder="Optional internal secret" />
            </div>
            
            <div class="input-group" style="margin-top: 25px">
                <label>Samesame CosyVoice URL</label>
                <input type="text" id="ai-samesame-url" placeholder="http://samesame...:8002" />
            </div>
            <div class="input-group">
                <label>Samesame Secret</label>
                <input type="password" id="ai-samesame-secret" placeholder="Samesame Secret token" />
            </div>
            
            <button class="btn" id="save-ai-btn" style="margin-top: 15px">Save AI Config</button>

            <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border)">
                <h4 style="font-size: 13px; color: var(--text-dim); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px">Tests</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
                    <button class="btn btn-sm" id="test-s2t-btn" style="background: rgba(139, 92, 246, 0.1); color: #A78BFA; border: 1px solid rgba(139, 92, 246, 0.2)">Test with Sample</button>
                    <button class="btn btn-sm" id="record-test-btn" style="background: rgba(239, 68, 68, 0.1); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.2)">Record 5s & Test</button>
                </div>
            </div>
        </div>
    );
};

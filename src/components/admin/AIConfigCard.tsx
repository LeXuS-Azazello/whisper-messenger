/** @jsxImportSource preact */

export const AIConfigCard = (props: { checks: any, env: any }) => {
    return (
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">AI & Speech Models</h3>
                <span class="status-tag active" id="whisper-status-tag" style="background: rgba(139, 92, 246, 0.15); color: #C084FC;">{props.checks.WHISPER_PROVIDER_NAME}</span>
            </div>
            
            <div class="input-group" style="margin-top: 15px">
                <label>Transcription (Whisper) URL</label>
                <input type="text" id="ai-whisper-url" placeholder="http://whisper-service-v2...:8000" />
            </div>
            <div class="input-group">
                <label>Transcription Secret</label>
                <input type="password" id="ai-whisper-secret" placeholder="Optional internal secret" />
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                <label style="display: block; margin-bottom: 8px; font-size: 13px; color: var(--text-dim);">Active ASR Engine</label>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-sm" id="btn-switch-whisper" style="flex: 1; background: rgba(59, 130, 246, 0.1); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3);">
                        Whisper (CPU)
                    </button>
                    <button class="btn btn-sm" id="btn-switch-sensevoice" style="flex: 1; background: rgba(16, 185, 129, 0.1); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3);">
                        SenseVoice (Fast)
                    </button>
                    <button class="btn btn-sm" id="btn-switch-funasr" style="flex: 1; background: rgba(245, 158, 11, 0.1); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3);">
                        FunASR (Chinese)
                    </button>
                </div>
            </div>

            <div class="input-group" style="margin-top: 25px">
                <label>SAMESAME (XTTS v2) URL</label>
                <input type="text" id="ai-samesame-url" placeholder="http://samesame...:8002" />
            </div>
            <div class="input-group">
                <label>SAMESAME Secret</label>
                <input type="password" id="ai-samesame-secret" placeholder="SAMESAME Secret token" />
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

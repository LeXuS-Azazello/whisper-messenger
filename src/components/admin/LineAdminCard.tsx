/** @jsxImportSource preact */

export function LineAdminCard() {
    return (
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">
                    <span style={{ color: '#00C300' }}>◉</span> LINE
                </h3>
            </div>
            <div style={{ marginTop: '15px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    LINE is configured directly by users in their Dashboard by entering Channel Access Token and Secret. Admin doesn't need global LINE tokens.
                </p>
            </div>
        </div>
    );
}

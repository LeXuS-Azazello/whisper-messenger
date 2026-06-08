/** @jsxImportSource preact */
import { render } from 'preact-render-to-string';
import { UserSession } from '../../types';
import { AdminHeader } from './AdminHeader';

export const renderAdminUserProfile = (user: UserSession) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>User Profile - {user.firstName}</title>
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/admin.css" />
            </head>
            <body>
                <div class="container">
                    <AdminHeader tgAuthenticated={true} />
                    <div style={{ marginBottom: '20px' }}>
                        <a href="/admin" style={{ color: '#3B82F6', textDecoration: 'none' }}>← Back to Dashboard</a>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">User Profile: {user.firstName} {user.username ? `(@${user.username})` : ''}</h3>
                        </div>
                        <div class="card-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                                <h4 style={{ color: 'var(--text-dim)', marginBottom: '15px' }}>General Information</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div><strong>User ID:</strong> <code style={{ color: '#94A3B8' }}>{user.userId}</code></div>
                                    <div><strong>Email:</strong> {user.email || 'N/A'}</div>
                                    <div><strong>Phone:</strong> {user.phone || 'N/A'}</div>
                                    <div><strong>Registered:</strong> {new Date(user.createdAt).toLocaleString()}</div>
                                    <div><strong>Status:</strong> <span class={`status-tag ${user.isActive ? 'active' : 'inactive'}`}>{user.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div>
                                </div>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                                <h4 style={{ color: 'var(--text-dim)', marginBottom: '15px' }}>Financials & Tariffs</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div><strong>Current Balance:</strong> <span style={{ color: '#10B981', fontWeight: 'bold' }}>${(user.balance || 0).toFixed(2)}</span></div>
                                    <div><strong>Active Plan:</strong> <span style={{ color: '#3B82F6', fontWeight: 'bold' }}>{user.currentPlan || 'Pay-As-You-Go'}</span></div>
                                </div>
                                
                                <h4 style={{ color: 'var(--text-dim)', marginTop: '20px', marginBottom: '10px' }}>Usage Statistics</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div><strong>Transcriptions:</strong> {user.transcriptionCount || 0}</div>
                                    <div><strong>Words Processed:</strong> {user.wordsCount || 0}</div>
                                    <div><strong>Voice Clones:</strong> {user.clonedMessagesCount || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
};

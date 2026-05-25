/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import { SparklesIcon } from './Home.utils';

export const renderHome = (googleClientId: string, origin: string) => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Echo Messenger - Seamless Voice AI Integration</title>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/landing.css" />
                <meta name="description" content="Personalized voice message transcription, translation, and synthesis for Telegram, WhatsApp & Meta." />
            </head>
            <body>
                <div class="bg-glow"></div>
                
                <nav class="navbar">
                    <div class="nav-container">
                        <div class="logo">
                            <SparklesIcon size={28} color="#8B5CF6" />
                            <span>Echo Messenger</span>
                        </div>
                        <div class="nav-actions">
                            <a href="/login" class="nav-link">Sign In</a>
                            <a href="/register" class="btn-primary-sm">Get Started</a>
                        </div>
                    </div>
                </nav>

                <main class="main-content">
                    <section class="hero">
                        <div class="badge">✨ Powered by Whisper large-v3-turbo</div>
                        <h1 class="hero-title">
                            Your Voice, <br/><span class="text-gradient">Understood Everywhere.</span>
                        </h1>
                        <p class="hero-subtitle">
                            Seamlessly connect Telegram, WhatsApp, and Meta to transcribe, translate, and synthesize voice messages in real-time.
                        </p>
                        <div class="hero-actions">
                            <a href="/register" class="btn-primary">Start for Free</a>
                            <a href="#features" class="btn-secondary">Explore Features</a>
                        </div>
                    </section>

                    <section id="features" class="features">
                        <div class="features-grid">
                            <div class="feature-card glass-card">
                                <div class="feature-icon" style={{ background: "rgba(139, 92, 246, 0.2)", color: "#8B5CF6" }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                </div>
                                <h3>Multi-Platform Support</h3>
                                <p>Connect your WhatsApp, Telegram, Instagram, and Facebook Messenger to a single dashboard.</p>
                            </div>
                            <div class="feature-card glass-card">
                                <div class="feature-icon" style={{ background: "rgba(6, 182, 212, 0.2)", color: "#06B6D4" }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                </div>
                                <h3>Lightning Fast AI</h3>
                                <p>Powered by the latest large-v3-turbo models for instant, highly accurate transcription.</p>
                            </div>
                            <div class="feature-card glass-card">
                                <div class="feature-icon" style={{ background: "rgba(16, 185, 129, 0.2)", color: "#10B981" }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                </div>
                                <h3>Voice Cloning</h3>
                                <p>Synthesize speech with XTTS v2 to reply in your own voice automatically across platforms.</p>
                            </div>
                            <div class="feature-card glass-card">
                                <div class="feature-icon" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#F59E0B" }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                </div>
                                <h3>Real-Time Translation</h3>
                                <p>Break language barriers with instant cross-lingual translation of incoming voice messages.</p>
                            </div>
                        </div>
                    </section>
                </main>

                <footer>
                    <div class="footer-container">
                        <div class="footer-logo">
                            <SparklesIcon size={20} color="var(--text-dim)" />
                            <span>Echo Messenger</span>
                        </div>
                        <p class="copyright">© {new Date().getFullYear()} Echo Messenger. All rights reserved.</p>
                    </div>
                </footer>
            </body>
        </html>
    );
};

/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import { SparklesIcon } from './Home.utils';

export const renderTerms = () => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Terms of Service - Echo Messenger</title>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
                <link rel="stylesheet" href="/assets/css/landing.css" />
                <style dangerouslySetInnerHTML={{ __html: `
                    .document-container {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 120px 24px 60px;
                        color: rgba(255, 255, 255, 0.85);
                        font-family: 'Inter', sans-serif;
                        line-height: 1.6;
                    }
                    .document-container h1 {
                        font-family: 'Outfit', sans-serif;
                        font-size: 3rem;
                        color: #fff;
                        margin-bottom: 2rem;
                    }
                    .document-container h2 {
                        font-family: 'Outfit', sans-serif;
                        font-size: 1.75rem;
                        color: #fff;
                        margin-top: 2rem;
                        margin-bottom: 1rem;
                    }
                    .document-container p {
                        margin-bottom: 1rem;
                    }
                `}} />
            </head>
            <body>
                <div class="bg-glow"></div>
                
                <nav class="navbar">
                    <div class="nav-container">
                        <div class="logo">
                            <SparklesIcon size={28} color="#8B5CF6" />
                            <a href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}><span>Echo Messenger</span></a>
                        </div>
                        <div class="nav-actions">
                            <a href="/login" class="nav-link">Sign In</a>
                            <a href="/register" class="btn-primary-sm">Get Started</a>
                        </div>
                    </div>
                </nav>

                <main class="document-container">
                    <h1>Terms of Service</h1>
                    <p>Last updated: June 2026</p>
                    
                    <h2>1. Acceptance of Terms</h2>
                    <p>By accessing or using Echo Messenger, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>

                    <h2>2. Description of Service</h2>
                    <p>Echo Messenger provides tools to transcribe and translate voice messages across various platforms, including Telegram, WhatsApp, and Meta messaging services. Voice data is processed in real time via streaming — audio is transmitted in base64-encoded format, processed, and immediately discarded. We do not permanently store any voice recordings or processed media on our servers.</p>

                    <h2>3. User Accounts</h2>
                    <p>You must provide accurate information when creating an account. You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password.</p>

                    <h2>4. Acceptable Use</h2>
                    <p>You agree not to use the service for any unlawful purpose or in any way that interrupts, damages, or impairs the service. You are solely responsible for the content of the voice messages you process through our service.</p>

                    <h2>5. Termination</h2>
                    <p>We reserve the right to terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.</p>

                    <h2>6. Changes to Terms</h2>
                    <p>We reserve the right to modify these terms at any time. We will notify users of any significant changes by updating the date at the top of this document.</p>
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

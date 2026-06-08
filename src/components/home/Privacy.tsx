/** @jsxImportSource preact */
import React from 'preact/compat';
import { render } from 'preact-render-to-string';
import { SparklesIcon } from './Home.utils';

export const renderPrivacy = () => {
    return "<!DOCTYPE html>" + render(
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Privacy Policy - Echo Messenger</title>
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
                    <h1>Privacy Policy</h1>
                    <p>Last updated: June 2026</p>
                    
                    <h2>1. Information We Collect</h2>
                    <p>We collect information you provide directly to us when you register for an account, connect messaging platforms, or use our voice transcription and synthesis features. This includes email addresses and authentication tokens.</p>

                    <h2>2. How We Use Information</h2>
                    <p>We use the information we collect to operate, maintain, and improve our services. Specifically, voice data is processed to generate text transcriptions or synthesize audio replies based on your usage.</p>

                    <h2>3. Data Storage and Security</h2>
                    <p>We prioritize the security of your data. Voice messages are processed through our temporary media storage and are not permanently kept unless required for the direct functioning of the app. We implement appropriate technical measures to protect your personal information.</p>

                    <h2>4. Third-Party Services</h2>
                    <p>Our service integrates with third-party platforms such as Telegram, WhatsApp, and Meta. Your interactions with these platforms through our service are also subject to their respective privacy policies.</p>

                    <h2>5. Changes to This Policy</h2>
                    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by updating the new Privacy Policy on this page.</p>

                    <h2>6. Contact Us</h2>
                    <p>If you have any questions about this Privacy Policy, please contact our support team.</p>
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

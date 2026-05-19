import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock config.js and ioredis to prevent real connection attempts during tests
vi.mock('./config.js', () => ({
    TARGET_USER_ID: '12345',
    redis: {
        on: () => {},
        get: () => Promise.resolve(null),
        set: () => Promise.resolve(null)
    }
}));

vi.mock('./utils.js', () => ({
    createClient: () => ({
        on: () => {},
        invoke: () => Promise.resolve({})
    })
}));

import {
    splitTextIntoChunks,
    handleNewMessage,
    __setTestState,
    __getIncomingQueue,
    __clearIncomingQueue
} from './telegramClient.js';

describe('splitTextIntoChunks', () => {
    it('should return an empty array if text is empty or falsy', () => {
        expect(splitTextIntoChunks('')).toEqual([]);
        expect(splitTextIntoChunks(null)).toEqual([]);
        expect(splitTextIntoChunks(undefined)).toEqual([]);
    });

    it('should not split text if it is shorter than the limit', () => {
        const text = 'Hello, this is a short test message.';
        const result = splitTextIntoChunks(text, 50);
        expect(result).toEqual([text]);
    });

    it('should split text into chunks of at most the specified limit', () => {
        const text = 'First paragraph.\nSecond paragraph.\nThird paragraph.';
        const result = splitTextIntoChunks(text, 20);
        
        expect(result.length).toBeGreaterThan(1);
        result.forEach(chunk => {
            expect(chunk.length).toBeLessThanOrEqual(20);
        });
    });

    it('should split by paragraph first if possible', () => {
        const text = 'Paragraph A\nParagraph B';
        const result = splitTextIntoChunks(text, 15);
        expect(result).toEqual(['Paragraph A', 'Paragraph B']);
    });

    it('should split by sentence if a paragraph exceeds the limit', () => {
        const text = 'Sentence one. Sentence two. Sentence three.';
        const result = splitTextIntoChunks(text, 15);
        
        expect(result.length).toBe(3);
        expect(result).toEqual(['Sentence one.', 'Sentence two.', 'Sentence three.']);
    });

    it('should split by word if a sentence exceeds the limit', () => {
        const text = 'WordOne WordTwo WordThree';
        const result = splitTextIntoChunks(text, 10);
        
        expect(result).toEqual(['WordOne', 'WordTwo', 'WordThree']);
    });

    it('should hard split a word if the word itself exceeds the limit', () => {
        const text = 'Supercalifragilistic';
        const result = splitTextIntoChunks(text, 5);
        
        expect(result).toEqual(['Super', 'calif', 'ragil', 'istic']);
    });
});

describe('handleNewMessage filtering', () => {
    let mockClient;
    const myUserId = 12345;

    beforeEach(() => {
        __clearIncomingQueue();
        mockClient = {
            invoke: vi.fn().mockImplementation(async (query) => {
                if (query['_'] === 'getMe') {
                    return { id: myUserId };
                }
                if (query['_'] === 'getChat') {
                    // Default mock behavior for private chats
                    if (query.chat_id === 99999 || query.chat_id === myUserId) {
                        return { type: { '_': 'chatTypePrivate' } };
                    }
                    if (query.chat_id === 88888) {
                        return { type: { '_': 'chatTypeSecret' } };
                    }
                    if (query.chat_id === -55555) {
                        return { type: { '_': 'chatTypeSupergroup' } };
                    }
                }
                return {};
            })
        };
        __setTestState(mockClient, myUserId);
    });

    it('should queue incoming voice notes in private chats', async () => {
        const msg = {
            id: 1,
            chat_id: 99999,
            is_outgoing: false,
            content: {
                '_': 'messageVoiceNote',
                voice_note: { voice: { id: 101 } }
            }
        };

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(1);
        expect(queue[0].id).toBe(1);
    });

    it('should queue incoming video notes in secret chats', async () => {
        const msg = {
            id: 2,
            chat_id: 88888,
            is_outgoing: false,
            content: {
                '_': 'messageVideoNote',
                video_note: { video: { id: 102 } }
            }
        };

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(1);
        expect(queue[0].id).toBe(2);
    });

    it('should queue outgoing/forwarded voice notes in our own chat (Saved Messages)', async () => {
        const msg = {
            id: 3,
            chat_id: myUserId,
            is_outgoing: true,
            content: {
                '_': 'messageVoiceNote',
                voice_note: { voice: { id: 103 } }
            }
        };

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(1);
        expect(queue[0].id).toBe(3);
    });

    it('should skip outgoing voice notes sent to other users', async () => {
        const msg = {
            id: 4,
            chat_id: 99999,
            is_outgoing: true,
            content: {
                '_': 'messageVoiceNote',
                voice_note: { voice: { id: 104 } }
            }
        };

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(0);
    });

    it('should skip voice notes from group chats (negative chat IDs)', async () => {
        const msg = {
            id: 5,
            chat_id: -100123456,
            is_outgoing: false,
            content: {
                '_': 'messageVoiceNote',
                voice_note: { voice: { id: 105 } }
            }
        };

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(0);
    });

    it('should skip voice notes from non-private chat types even if chat ID is not negative', async () => {
        const msg = {
            id: 6,
            chat_id: 77777, // Posive ID but we'll mock getChat to return supergroup
            is_outgoing: false,
            content: {
                '_': 'messageVoiceNote',
                voice_note: { voice: { id: 106 } }
            }
        };

        mockClient.invoke = vi.fn().mockImplementation(async (query) => {
            if (query['_'] === 'getChat' && query.chat_id === 77777) {
                return { type: { '_': 'chatTypeSupergroup' } };
            }
            return {};
        });

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(0);
    });

    it('should log text messages immediately without queueing them', async () => {
        const msg = {
            id: 7,
            chat_id: 99999,
            is_outgoing: false,
            content: {
                '_': 'messageText',
                text: { text: 'Hello!' }
            }
        };

        await handleNewMessage(msg);
        const queue = __getIncomingQueue();
        expect(queue.length).toBe(0);
    });
});

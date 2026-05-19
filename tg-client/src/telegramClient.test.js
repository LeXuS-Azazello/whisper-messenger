import { describe, it, expect } from 'vitest';
import { splitTextIntoChunks } from './telegramClient.js';

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
        // limit of 20 characters
        const result = splitTextIntoChunks(text, 20);
        
        expect(result.length).toBeGreaterThan(1);
        result.forEach(chunk => {
            expect(chunk.length).toBeLessThanOrEqual(20);
        });
    });

    it('should split by paragraph first if possible', () => {
        const text = 'Paragraph A\nParagraph B';
        // A limit that fits A and B individually but not together
        const result = splitTextIntoChunks(text, 15);
        expect(result).toEqual(['Paragraph A', 'Paragraph B']);
    });

    it('should split by sentence if a paragraph exceeds the limit', () => {
        const text = 'Sentence one. Sentence two. Sentence three.';
        // limit of 15 characters
        const result = splitTextIntoChunks(text, 15);
        
        expect(result.length).toBe(3);
        expect(result).toEqual(['Sentence one.', 'Sentence two.', 'Sentence three.']);
    });

    it('should split by word if a sentence exceeds the limit', () => {
        const text = 'WordOne WordTwo WordThree';
        // limit of 10 characters
        const result = splitTextIntoChunks(text, 10);
        
        expect(result).toEqual(['WordOne', 'WordTwo', 'WordThree']);
    });

    it('should hard split a word if the word itself exceeds the limit', () => {
        const text = 'Supercalifragilistic';
        // limit of 5 characters
        const result = splitTextIntoChunks(text, 5);
        
        expect(result).toEqual(['Super', 'calif', 'ragil', 'istic']);
    });
});

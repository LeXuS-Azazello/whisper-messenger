import { splitTextIntoChunks } from './telegramClient.js';
import assert from 'assert';

console.log("Running splitTextIntoChunks tests...");

// Test 1: Empty text
assert.deepStrictEqual(splitTextIntoChunks(''), []);
assert.deepStrictEqual(splitTextIntoChunks(null), []);
console.log("✅ Test 1 (Empty) passed.");

// Test 2: Shorter than limit
const textShort = 'Hello, this is a short test message.';
assert.deepStrictEqual(splitTextIntoChunks(textShort, 50), [textShort]);
console.log("✅ Test 2 (Short) passed.");

// Test 3: Paragraph split
const textParagraph = 'Paragraph A\nParagraph B';
assert.deepStrictEqual(splitTextIntoChunks(textParagraph, 15), ['Paragraph A', 'Paragraph B']);
console.log("✅ Test 3 (Paragraph split) passed.");

// Test 4: Sentence split
const textSentence = 'Sentence one. Sentence two. Sentence three.';
assert.deepStrictEqual(splitTextIntoChunks(textSentence, 15), ['Sentence one.', 'Sentence two.', 'Sentence three.']);
console.log("✅ Test 4 (Sentence split) passed.");

// Test 5: Word split
const textWords = 'WordOne WordTwo WordThree';
assert.deepStrictEqual(splitTextIntoChunks(textWords, 10), ['WordOne', 'WordTwo', 'WordThree']);
console.log("✅ Test 5 (Word split) passed.");

// Test 6: Hard split of a word
const longWord = 'Supercalifragilistic';
assert.deepStrictEqual(splitTextIntoChunks(longWord, 5), ['Super', 'calif', 'ragil', 'istic']);
console.log("✅ Test 6 (Hard word split) passed.");

console.log("🎉 ALL CHUNKING TESTS PASSED SUCCESSFULLY!");
process.exit(0);

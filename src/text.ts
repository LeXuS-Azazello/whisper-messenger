/**
 * Splits a long text into chunks that are safe for messenger platforms.
 * @param text The text to split
 * @param limit Character limit per chunk (default 2000 for Meta/Telegram)
 */
export function splitLongText(text: string, limit: number = 2000): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  // Split by whitespace to keep words together where possible
  const words = text.split(/(\s+)/);

  for (const word of words) {
    if ((currentChunk + word).length > limit) {
      // If the current chunk is not empty, push it
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // If the word itself is longer than the limit, we must split the word
      if (word.length > limit) {
        let remainingWord = word;
        while (remainingWord.length > limit) {
          chunks.push(remainingWord.slice(0, limit));
          remainingWord = remainingWord.slice(limit);
        }
        currentChunk = remainingWord;
      } else {
        // Word fits in a new chunk
        currentChunk = word;
      }
    } else {
      currentChunk += word;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

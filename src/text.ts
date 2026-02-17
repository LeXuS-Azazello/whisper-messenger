const LIMIT = 1000;

export function splitLongText(text: string): string[] {
  const out: string[] = [];

  let current = "";

  for (const word of text.split(" ")) {
    if ((current + word).length > LIMIT) {
      out.push(current);
      current = "";
    }

    current += word + " ";
  }

  if (current.trim()) {
    out.push(current);
  }

  return out;
}

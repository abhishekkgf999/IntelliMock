export const extractTextFromPdf = (buffer) => {
  const text = buffer.toString("latin1");
  const matches = text.match(/BT[\s\S]*?ET/g) || [];
  let extracted = matches
    .join(" ")
    .replace(/\(([^)]+)\)\s*Tj/g, "$1 ")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (extracted.length < 50) {
    extracted = text
      .replace(/[^\x20-\x7E\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 3000);
  }
  return extracted;
};
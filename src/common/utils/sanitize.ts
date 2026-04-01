/** Strip HTML tags and HTML entities from text */
export const sanitizeText = (text: string): string => {
  return text
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/&[#\w]+;/g, '') // strip HTML entities
    .trim();
};

import { translateText } from '@/lib/bhashini';

/**
 * Translate text with automatic fallback to English on failure
 * @param text - Text to translate
 * @param targetLanguage - Target language code
 * @returns Translated text or original text on failure
 */
export async function translateWithFallback(
  text: string,
  targetLanguage: string
): Promise<string> {
  // Return original text if target is English
  if (targetLanguage === 'en') {
    return text;
  }

  try {
    const translated = await translateText(text, 'en', targetLanguage);
    return translated;
  } catch (error) {
    console.error('Translation failed, using English fallback:', error);
    // Fallback to English on translation failure
    return text;
  }
}

/**
 * Translate multiple texts in parallel with fallback
 * @param texts - Array of texts to translate
 * @param targetLanguage - Target language code
 * @returns Array of translated texts with fallback to original on failure
 */
export async function translateMultipleWithFallback(
  texts: string[],
  targetLanguage: string
): Promise<string[]> {
  // Return original texts if target is English
  if (targetLanguage === 'en') {
    return texts;
  }

  // Translate all texts in parallel
  const translationPromises = texts.map(text => 
    translateWithFallback(text, targetLanguage)
  );

  return Promise.all(translationPromises);
}

import { useState, useEffect } from 'react';
import { translateText } from '@/lib/bhashini';

interface TranslatedTextProps {
  text: string;
  targetLanguage?: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
}

export const TranslatedText = ({ 
  text, 
  targetLanguage = 'en', 
  as: Component = 'span',
  className,
  children 
}: TranslatedTextProps) => {
  const [translatedText, setTranslatedText] = useState(text);
  const [isLoading, setIsLoading] = useState(false);
  const [translationFailed, setTranslationFailed] = useState(false);

  useEffect(() => {
    const translate = async () => {
      // Reset to original text if switching to English
      if (targetLanguage === 'en') {
        setTranslatedText(text);
        setTranslationFailed(false);
        return;
      }

      setIsLoading(true);
      setTranslationFailed(false);
      
      try {
        const result = await translateText(text, 'en', targetLanguage);
        setTranslatedText(result);
      } catch (error) {
        console.error('Translation error:', error);
        // Fallback to English on translation failure
        setTranslatedText(text);
        setTranslationFailed(true);
      } finally {
        setIsLoading(false);
      }
    };

    translate();
  }, [text, targetLanguage]);

  return (
    <Component className={className}>
      {isLoading ? text : translatedText}
      {children}
    </Component>
  );
};

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Key, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';

export const ApiKeySetup = () => {
  const { language } = useLanguage();
  const [apiKey, setApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
  const [saved, setSaved] = useState(!!localStorage.getItem('GEMINI_API_KEY'));

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', apiKey.trim());
      setSaved(true);
      window.location.reload(); // Reload to apply new key
    }
  };

  if (saved && apiKey) {
    return (
      <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              <TranslatedText text="Gemini API Key Configured" targetLanguage={language} />
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                localStorage.removeItem('GEMINI_API_KEY');
                setApiKey('');
                setSaved(false);
              }}
              className="mt-2 h-8 text-xs"
            >
              <TranslatedText text="Change Key" targetLanguage={language} />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-3 mb-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
            <TranslatedText text="Gemini API Key Required" targetLanguage={language} />
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <TranslatedText text="Get your free API key from" targetLanguage={language} />{' '}
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Google AI Studio
            </a>
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="password"
            placeholder="AIza..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSave} disabled={!apiKey.trim()}>
          <TranslatedText text="Save" targetLanguage={language} />
        </Button>
      </div>
    </Card>
  );
};

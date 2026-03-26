import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bot, Send, User } from 'lucide-react';
import { chatWithAI } from '@/lib/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatbotProps {
  diseaseContext?: {
    diseases: string[];
    confidences: number[];
    location?: { lat: number; lng: number };
  };
}

export const AIChatbot = ({ diseaseContext }: AIChatbotProps = {}) => {
  // Generate initial message based on disease context
  const getInitialMessage = (): string => {
    if (diseaseContext && diseaseContext.diseases.length > 0) {
      const diseaseList = diseaseContext.diseases.join(', ');
      return `Hello! I see you've detected the following disease(s): ${diseaseList}. I'm here to help you with treatment advice, prevention strategies, and answer any questions about these diseases. What would you like to know?`;
    }
    return 'Hello! I am your agricultural assistant. Ask me anything about organic farming, pest control, crop selection, or sustainable practices.';
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: getInitialMessage()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context with disease information if available
      let contextMessages = messages.map(m => `${m.role}: ${m.content}`);
      
      // Add disease context to the conversation if available
      if (diseaseContext && diseaseContext.diseases.length > 0) {
        const diseaseInfo = diseaseContext.diseases.map((disease, idx) => 
          `${disease} (${(diseaseContext.confidences[idx] * 100).toFixed(1)}% confidence)`
        ).join(', ');
        
        const locationInfo = diseaseContext.location 
          ? ` Location: ${diseaseContext.location.lat.toFixed(4)}, ${diseaseContext.location.lng.toFixed(4)}.`
          : '';
        
        const contextPrefix = `[Disease Detection Context] Detected diseases: ${diseaseInfo}.${locationInfo} The user is asking about these detected diseases.`;
        contextMessages = [contextPrefix, ...contextMessages];
      }
      
      const response = await chatWithAI(input, contextMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-4 border-b flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">
          <TranslatedText text="AI Farming Assistant" targetLanguage={language} />
        </h3>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'user' ? 'bg-primary' : 'bg-secondary'
              }`}>
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-white" />
                )}
              </div>
              <div className={`flex-1 max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground ml-auto' 
                  : 'bg-muted'
              }`}>
                {msg.role === 'user' ? (
                  <TranslatedText text={msg.content} targetLanguage={language} />
                ) : (
                  <div className="chatbot-markdown">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      components={{
                        // Custom styling for code blocks
                        code({ node, inline, className, children, ...props }: any) {
                          return inline ? (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={`block ${className}`} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about farming..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};

import { useAuth0 } from '@auth0/auth0-react';
import { Button } from '@/components/ui/button';
import { TranslatedText } from '@/components/TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { Sprout, Cloud, TrendingUp, Bot, MapPin, Wallet } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { CALLBACK_URL } from '@/contexts/Auth0ProviderWithHistory';

const Landing = () => {
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  const { language } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-xl">Loading...</div>
      </div>
    );
  }

  const handleLogin = async (signUp = false) => {
    const params: any = {
      authorizationParams: {
        redirect_uri: Capacitor.isNativePlatform() ? CALLBACK_URL : window.location.origin + '/dashboard',
        ...(signUp ? { screen_hint: 'signup' } : {}),
      },
    };
    if (Capacitor.isNativePlatform()) {
      params.openUrl = async (url: string) => {
        await Browser.open({ url, windowName: '_self' });
      };
    }
    await loginWithRedirect(params);
  };

  const features = [
    { icon: MapPin, title: 'Field Mapping', desc: 'Mark and manage your fields with interactive maps' },
    { icon: Cloud, title: 'Weather Insights', desc: 'Real-time weather data for better planning' },
    { icon: Sprout, title: 'Soil Analysis', desc: 'Detailed soil data for optimal crop selection' },
    { icon: TrendingUp, title: 'Market Prices', desc: 'Live commodity prices from across India' },
    { icon: Bot, title: 'AI Assistant', desc: 'Get organic farming advice from AI' },
    { icon: Wallet, title: 'Finance Manager', desc: 'Track expenses and predict profits' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(145_75%_42%_/_0.05),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(42_96%_58%_/_0.05),transparent_50%)]" />
      
      {/* Header */}
      <header className="relative glass sticky top-0 z-50 shadow-soft backdrop-blur-xl">
        <div className="container mx-auto px-4 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-xl shadow-glow">
                <Sprout className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">
                  <TranslatedText text="KisanMitra" targetLanguage={language} />
                </h1>
                <p className="text-xs text-muted-foreground">Smart Farming Solutions</p>
              </div>
            </div>
            <LanguageSelector />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative container mx-auto px-4 py-24 text-center">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="inline-block px-4 py-2 bg-primary/10 rounded-full border border-primary/20 mb-4">
            <span className="text-sm font-medium text-primary">🌾 AI-Powered Agricultural Platform</span>
          </div>
          
          <TranslatedText 
            text="Empowering Indian Farmers with AI & Technology"
            targetLanguage={language}
            as="h2"
            className="text-5xl md:text-7xl font-extrabold leading-tight"
          />
          
          <div className="h-2 w-32 gradient-hero mx-auto rounded-full shadow-glow" />
          
          <TranslatedText
            text="Manage your fields, get AI-powered insights, track market prices, and grow sustainably - all in your language"
            targetLanguage={language}
            as="p"
            className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
          />

          <div className="flex gap-4 justify-center flex-wrap pt-6">
            <Button 
              size="lg" 
              className="gradient-primary hover-glow text-white px-8 py-6 text-lg rounded-xl shadow-elevated hover:scale-105 transition-bounce"
              onClick={() => handleLogin()}
            >
              <TranslatedText text="Get Started Free" targetLanguage={language} />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-primary/30 hover:bg-primary/10 px-8 py-6 text-lg rounded-xl hover:border-primary transition-smooth backdrop-blur-sm"
              onClick={() => handleLogin(true)}
            >
              <TranslatedText text="Sign Up" targetLanguage={language} />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 bg-accent/10 rounded-full border border-accent/20 mb-4">
            <span className="text-sm font-medium text-accent-foreground">Complete Farming Toolkit</span>
          </div>
          <TranslatedText
            text="Everything You Need to Succeed"
            targetLanguage={language}
            as="h3"
            className="text-4xl md:text-5xl font-bold"
          />
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div 
              key={idx}
              className="group relative gradient-card p-8 rounded-2xl shadow-soft hover-lift border border-border/50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-smooth" />
              <div className="relative z-10">
                <div className="p-3 bg-primary/10 rounded-xl w-fit mb-5 group-hover:bg-primary/20 transition-smooth">
                  <feature.icon className="w-10 h-10 text-primary" />
                </div>
                <TranslatedText
                  text={feature.title}
                  targetLanguage={language}
                  as="h4"
                  className="text-2xl font-bold mb-3"
                />
                <TranslatedText
                  text={feature.desc}
                  targetLanguage={language}
                  as="p"
                  className="text-muted-foreground leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative container mx-auto px-4 py-24">
        <div className="relative gradient-hero rounded-3xl p-16 text-center text-white shadow-intense overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
          <div className="relative z-10 max-w-3xl mx-auto">
            <TranslatedText
              text="Ready to Transform Your Farming?"
              targetLanguage={language}
              as="h3"
              className="text-4xl md:text-5xl font-extrabold mb-6"
            />
            <TranslatedText
              text="Join thousands of farmers already using KisanMitra"
              targetLanguage={language}
              as="p"
              className="text-xl md:text-2xl mb-10 opacity-95"
            />
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/95 shadow-intense hover:scale-105 transition-bounce px-10 py-7 text-lg rounded-xl font-bold"
              onClick={() => handleLogin()}
            >
              <TranslatedText text="Start Your Journey" targetLanguage={language} />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative container mx-auto px-4 py-10 text-center text-muted-foreground border-t border-border/50">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sprout className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">KisanMitra</span>
        </div>
        <TranslatedText
          text="© 2025 KisanMitra - Empowering farmers across India"
          targetLanguage={language}
        />
      </footer>
    </div>
  );
};

export default Landing;

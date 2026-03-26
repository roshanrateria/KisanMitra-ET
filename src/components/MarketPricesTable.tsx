import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingUp, TrendingDown, Minus, IndianRupee } from 'lucide-react';
import { MarketPrice } from '@/lib/apis';

import { Loader2 } from 'lucide-react';

interface MarketPricesTableProps {
  prices: MarketPrice[];
  isLoading?: boolean;
}

export const MarketPricesTable = ({ prices, isLoading = false }: MarketPricesTableProps) => {
  const { language } = useLanguage();

  const getTrendIcon = (price: number) => {
    const avgPrice = 2650;
    if (price > avgPrice + 200) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (price < avgPrice - 200) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getHighestPrice = () => {
    if (prices.length === 0) return null;
    return prices.reduce((max, p) => p.modalPrice > max.modalPrice ? p : max);
  };

  const getLowestPrice = () => {
    if (prices.length === 0) return null;
    return prices.reduce((min, p) => p.modalPrice < min.modalPrice ? p : min);
  };

  const highest = getHighestPrice();
  const lowest = getLowestPrice();

  if (isLoading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-primary" />
          <TranslatedText text="Market Prices" targetLanguage={language} />
        </h3>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <p className="text-muted-foreground">
            <TranslatedText text="Fetching live market prices..." targetLanguage={language} />
          </p>
        </div>
      </Card>
    );
  }

  if (prices.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <IndianRupee className="w-5 h-5 text-primary" />
          <TranslatedText text="Market Prices" targetLanguage={language} />
        </h3>
        <p className="text-muted-foreground text-center py-8">
          <TranslatedText text="No market data available" targetLanguage={language} />
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 md:p-6 hover-lift w-full overflow-hidden">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2 shrink-0">
          <IndianRupee className="w-6 h-6 text-primary" />
          <TranslatedText text="Market Prices" targetLanguage={language} />
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm min-w-0">
          {highest && (
            <div className="flex items-center gap-1 text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-md">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="font-semibold shrink-0">₹{highest.modalPrice}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[120px] md:max-w-[200px]" title={highest.market}>({highest.market})</span>
            </div>
          )}
          {lowest && (
            <div className="flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-md">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span className="font-semibold shrink-0">₹{lowest.modalPrice}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[120px] md:max-w-[200px]" title={lowest.market}>({lowest.market})</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold whitespace-nowrap">
                <TranslatedText text="Market" targetLanguage={language} />
              </TableHead>
              <TableHead className="font-bold whitespace-nowrap hidden sm:table-cell">
                <TranslatedText text="Variety" targetLanguage={language} />
              </TableHead>
              <TableHead className="font-bold whitespace-nowrap hidden sm:table-cell">
                <TranslatedText text="Grade" targetLanguage={language} />
              </TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">
                <TranslatedText text="Min Price" targetLanguage={language} />
              </TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">
                <TranslatedText text="Max Price" targetLanguage={language} />
              </TableHead>
              <TableHead className="text-right font-bold whitespace-nowrap">
                <TranslatedText text="Modal Price" targetLanguage={language} />
              </TableHead>
              <TableHead className="text-center font-bold whitespace-nowrap">
                <TranslatedText text="Trend" targetLanguage={language} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price, idx) => (
              <TableRow 
                key={idx}
                className={`transition-colors hover:bg-muted/30 ${
                  price.slNo === highest?.slNo ? 'bg-green-50 dark:bg-green-950/20' : 
                  price.slNo === lowest?.slNo ? 'bg-red-50 dark:bg-red-950/20' : ''
                }`}
              >
                <TableCell className="font-medium min-w-[120px]">
                  <div>
                    <div className="font-semibold whitespace-nowrap truncate max-w-[140px]" title={price.market}>{price.market}</div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{price.district}</div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary whitespace-nowrap">
                    {price.variety}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-sm font-medium whitespace-nowrap">{price.grade}</span>
                </TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">₹{price.minPrice.toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">₹{price.maxPrice.toLocaleString('en-IN')}</TableCell>
                <TableCell className="text-right font-bold text-lg text-primary font-mono whitespace-nowrap">
                  ₹{price.modalPrice.toLocaleString('en-IN')}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">{getTrendIcon(price.modalPrice)}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TranslatedText 
            text="Prices per quintal (100 kg) • Last updated:" 
            targetLanguage={language} 
          />
          <span className="font-medium whitespace-nowrap">{prices[0]?.priceDate}</span>
        </div>
        <div className="shrink-0 text-muted-foreground/80">
          <TranslatedText 
            text="Source: Agmarknet.gov.in" 
            targetLanguage={language} 
          />
        </div>
      </div>
    </Card>
  );
};

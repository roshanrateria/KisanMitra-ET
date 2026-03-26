import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TranslatedText } from './TranslatedText';
import { useLanguage } from '@/contexts/LanguageContext';
import { Wallet, Plus, TrendingUp, TrendingDown, IndianRupee, Target } from 'lucide-react';
import { useState } from 'react';
import { FinancialRecord } from '@/lib/storage';

interface FinancialDashboardProps {
  records: FinancialRecord[];
  onAddRecord: (record: Omit<FinancialRecord, 'id'>) => void;
  projectedYield?: number; // in tons
  marketPrice?: number; // price per quintal
  fieldArea?: number; // in acres
}

export const FinancialDashboard = ({ records, onAddRecord, projectedYield = 0, marketPrice = 2700, fieldArea = 0 }: FinancialDashboardProps) => {
  const { language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const totalIncome = records
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const profit = totalIncome - totalExpense;

  // Calculate projected revenue from market price and yield
  // projectedYield is in tons, convert to quintals (1 ton = 10 quintals)
  const projectedRevenue = projectedYield * 10 * marketPrice;
  const projectedProfit = projectedRevenue - totalExpense;
  const roi = totalExpense > 0 ? ((projectedProfit / totalExpense) * 100) : 0;

  const handleSubmit = () => {
    if (!category || !amount) return;

    const record: Omit<FinancialRecord, 'id'> = {
      type,
      category,
      amount: parseFloat(amount),
      date: new Date().toISOString(),
      description
    };

    onAddRecord(record);
    setCategory('');
    setAmount('');
    setDescription('');
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                <TranslatedText text="Total Income" targetLanguage={language} />
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                ₹{totalIncome.toLocaleString('en-IN')}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                <TranslatedText text="Total Expenses" targetLanguage={language} />
              </p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                ₹{totalExpense.toLocaleString('en-IN')}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                <TranslatedText text="Current Profit" targetLanguage={language} />
              </p>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-700 dark:text-red-400'}`}>
                ₹{profit.toLocaleString('en-IN')}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                <TranslatedText text="Projected Profit" targetLanguage={language} />
              </p>
              <p className={`text-2xl font-bold ${projectedProfit >= 0 ? 'text-purple-700 dark:text-purple-400' : 'text-red-700 dark:text-red-400'}`}>
                ₹{projectedProfit.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ROI: {roi.toFixed(1)}%
              </p>
            </div>
            <Target className="w-8 h-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Projection Details */}
      {projectedYield > 0 && (
        <Card className="p-6 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border-amber-200">
          <div className="flex items-start gap-3">
            <IndianRupee className="w-6 h-6 text-amber-600 mt-1" />
            <div className="flex-1">
              <h4 className="font-semibold text-lg mb-2 text-amber-900 dark:text-amber-100">
                <TranslatedText text="Revenue Projection" targetLanguage={language} />
              </h4>
              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    <TranslatedText text="Expected Yield" targetLanguage={language} />
                  </p>
                  <p className="font-bold text-lg">{projectedYield.toFixed(2)} tons</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    <TranslatedText text="Market Price" targetLanguage={language} />
                  </p>
                  <p className="font-bold text-lg">₹{marketPrice.toLocaleString('en-IN')}/quintal</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    <TranslatedText text="Projected Revenue" targetLanguage={language} />
                  </p>
                  <p className="font-bold text-lg text-green-600">₹{projectedRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    <TranslatedText text="Expected Profit" targetLanguage={language} />
                  </p>
                  <p className={`font-bold text-lg ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{projectedProfit.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                <TranslatedText 
                  text="* Projection based on current market prices and AI-predicted yield" 
                  targetLanguage={language} 
                />
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Add Transaction */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <TranslatedText text="Financial Records" targetLanguage={language} />
          </h3>
          <Button onClick={() => setShowForm(!showForm)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            <TranslatedText text="Add Record" targetLanguage={language} />
          </Button>
        </div>

        {showForm && (
          <div className="space-y-3 mb-4 p-4 bg-muted rounded-lg">
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Category (e.g., Seeds, Labor, Harvest Sale)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />

            <Input
              type="number"
              placeholder="Amount (₹)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <Button onClick={handleSubmit} className="w-full">
              <TranslatedText text="Add Transaction" targetLanguage={language} />
            </Button>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="space-y-2">
          {records.slice(-5).reverse().map((record) => (
            <div 
              key={record.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div>
                <p className="font-medium">{record.category}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(record.date).toLocaleDateString('en-IN')}
                </p>
              </div>
              <p className={`font-bold ${record.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {record.type === 'income' ? '+' : '-'}₹{record.amount.toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

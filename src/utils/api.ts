import { AVAILABLE_CURRENCIES } from './mockData';

// Fetch live market data for all supported currencies from Yahoo Finance
export const fetchRates = async (baseCurrency: string = 'USD') => {
  try {
    const rates: Record<string, number> = { USD: 1 };
    
    const fetchPromises = AVAILABLE_CURRENCIES
      .filter(c => c.value !== 'USD')
      .map(async (currency) => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${currency.value}=X?range=1d&interval=1m`);
          const json = await res.json();
          if (json.chart.result && json.chart.result.length > 0) {
            rates[currency.value] = json.chart.result[0].meta.regularMarketPrice;
          }
        } catch (e) {
          console.warn(`Failed to fetch rate for ${currency.value}`);
        }
      });

    await Promise.all(fetchPromises);
    
    // Normalize if the requested base is not USD
    if (baseCurrency !== 'USD') {
      const baseRate = rates[baseCurrency];
      if (!baseRate) return null;
      
      const normalizedRates: Record<string, number> = {};
      for (const [code, rate] of Object.entries(rates)) {
        normalizedRates[code] = rate / baseRate;
      }
      return normalizedRates;
    }
    
    return rates;
  } catch (error) {
    console.error("Error fetching rates", error);
    return null;
  }
};

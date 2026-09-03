import { Platform } from 'react-native';
import { AVAILABLE_CURRENCIES } from './mockData';

// On web, Yahoo Finance blocks browser requests (CORS).
// We use open.er-api.com which is free and fully CORS-enabled.
// On native (iOS/Android), we continue using Yahoo Finance for real-time data.

const fetchWebRates = async (baseCurrency: string): Promise<Record<string, number> | null> => {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/USD`);
    const json = await res.json();
    if (json.result !== 'success') return null;

    const usdRates: Record<string, number> = json.rates;
    usdRates['USD'] = 1;

    if (baseCurrency === 'USD') return usdRates;

    const baseRate = usdRates[baseCurrency];
    if (!baseRate) return null;

    const normalized: Record<string, number> = {};
    for (const [code, rate] of Object.entries(usdRates)) {
      normalized[code] = (rate as number) / baseRate;
    }
    return normalized;
  } catch (e) {
    console.error('Web rate fetch failed', e);
    return null;
  }
};

const fetchNativeRates = async (baseCurrency: string): Promise<Record<string, number> | null> => {
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

    if (baseCurrency !== 'USD') {
      const baseRate = rates[baseCurrency];
      if (!baseRate) return null;
      const normalized: Record<string, number> = {};
      for (const [code, rate] of Object.entries(rates)) {
        normalized[code] = rate / baseRate;
      }
      return normalized;
    }

    return rates;
  } catch (error) {
    console.error('Error fetching rates', error);
    return null;
  }
};

export const fetchRates = async (baseCurrency: string = 'USD') => {
  if (Platform.OS === 'web') {
    return fetchWebRates(baseCurrency);
  }
  return fetchNativeRates(baseCurrency);
};

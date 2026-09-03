// Frankfurter API: free, CORS-friendly, no proxy needed
// Does not support TWD, so we fetch TWD via Yahoo Finance on native only,
// and use a fixed fallback on web.

const FRANKFURTER_BASE = 'https://api.frankfurter.app';

// Currencies supported by Frankfurter
const FRANKFURTER_SUPPORTED = ['USD','EUR','JPY','CNY','MYR','GBP','AUD','PHP','TRY','HKD','SGD','KRW','INR','THB'];

export const fetchRates = async (baseCurrency: string = 'USD') => {
  try {
    // Use Frankfurter for all supported currencies (CORS-safe)
    const res = await fetch(`${FRANKFURTER_BASE}/latest?from=USD`);
    const json = await res.json();

    if (!json.rates) return null;

    // Frankfurter returns rates relative to EUR by default if USD not base,
    // but we asked from=USD so json.rates = { EUR: 0.86, JPY: 145, ... }
    const rates: Record<string, number> = {
      USD: 1,
      ...json.rates,
    };

    // TWD is not in Frankfurter — use Yahoo Finance on native, skip on web
    if (!rates['TWD']) {
      try {
        const twdRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/TWD=X?range=1d&interval=1m');
        const twdJson = await twdRes.json();
        if (twdJson.chart?.result?.[0]?.meta?.regularMarketPrice) {
          rates['TWD'] = twdJson.chart.result[0].meta.regularMarketPrice;
        }
      } catch {
        rates['TWD'] = 32.5; // reasonable fallback if everything fails
      }
    }

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
    console.error('Error fetching rates', error);
    return null;
  }
};

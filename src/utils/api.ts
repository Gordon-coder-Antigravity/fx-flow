import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AVAILABLE_CURRENCIES } from './mockData';

// Fetch live rates from real-time API with multiple failover tiers and cache-busting
const fetchWebRates = async (baseCurrency: string, forceFresh: boolean = false): Promise<Record<string, number> | null> => {
  const timestamp = Date.now();
  let usdRates: Record<string, number> | null = null;

  // Tier 1: Real-time FX Rates API (live updates every minute, CORS enabled)
  try {
    const res = await fetch(`https://api.fxratesapi.com/latest?nocache=${timestamp}`, {
      cache: forceFresh ? 'no-store' : 'default',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.rates) {
        usdRates = { ...json.rates, USD: 1 };
      }
    }
  } catch (e) {
    console.warn('Tier 1 rate fetch failed, trying Tier 2:', e);
  }

  // Tier 2: Open Exchange Rates fallback
  if (!usdRates) {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/USD?t=${timestamp}`, {
        cache: forceFresh ? 'no-store' : 'default',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.result === 'success' && json.rates) {
          usdRates = { ...json.rates, USD: 1 };
        }
      }
    } catch (e) {
      console.warn('Tier 2 rate fetch failed, trying Tier 3:', e);
    }
  }

  // Tier 3: jsdelivr currency-api fallback
  if (!usdRates) {
    try {
      const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json?t=${timestamp}`);
      if (res.ok) {
        const json = await res.json();
        if (json.usd) {
          usdRates = {};
          for (const [k, v] of Object.entries(json.usd)) {
            usdRates[k.toUpperCase()] = v as number;
          }
          usdRates['USD'] = 1;
        }
      }
    } catch (e) {
      console.warn('Tier 3 rate fetch failed:', e);
    }
  }

  // Tier 4: Local AsyncStorage Database fallback
  if (!usdRates) {
    try {
      const cached = await AsyncStorage.getItem('cached_rates');
      if (cached) {
        usdRates = JSON.parse(cached);
      }
    } catch {}
  }

  if (usdRates) {
    // Persist to local database (AsyncStorage / localStorage)
    try {
      await AsyncStorage.setItem('cached_rates', JSON.stringify(usdRates));
      await AsyncStorage.setItem('last_rates_updated', new Date().toISOString());
    } catch (e) {
      console.error('Failed to cache rates locally:', e);
    }

    if (baseCurrency === 'USD') return usdRates;

    const baseRate = usdRates[baseCurrency];
    if (!baseRate) return null;

    const normalized: Record<string, number> = {};
    for (const [code, rate] of Object.entries(usdRates)) {
      normalized[code] = (rate as number) / baseRate;
    }
    return normalized;
  }

  return null;
};

const fetchNativeRates = async (baseCurrency: string, forceFresh: boolean = false): Promise<Record<string, number> | null> => {
  // On native, try web live feed first for consistency across platforms
  const webResult = await fetchWebRates(baseCurrency, forceFresh);
  if (webResult) return webResult;

  try {
    const rates: Record<string, number> = { USD: 1 };

    const fetchPromises = AVAILABLE_CURRENCIES
      .filter(c => c.value !== 'USD')
      .map(async (currency) => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${currency.value}=X?range=1d&interval=1m&t=${Date.now()}`);
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
    console.error('Error fetching native rates', error);
    return null;
  }
};

export const fetchRates = async (baseCurrency: string = 'USD', forceFresh: boolean = false) => {
  if (Platform.OS === 'web') {
    return fetchWebRates(baseCurrency, forceFresh);
  }
  return fetchNativeRates(baseCurrency, forceFresh);
};

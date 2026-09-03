import { Platform } from 'react-native';

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';

export type ChartDataPoint = {
  value: number;
  label?: string;
  date: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PROXY = Platform.OS === 'web' ? 'https://api.allorigins.win/raw?url=' : '';

function getDateRange(timeframe: Timeframe): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  switch (timeframe) {
    case '1D': start.setDate(end.getDate() - 1); break;
    case '1W': start.setDate(end.getDate() - 7); break;
    case '1M': start.setMonth(end.getMonth() - 1); break;
    case '3M': start.setMonth(end.getMonth() - 3); break;
    case '6M': start.setMonth(end.getMonth() - 6); break;
    case '1Y': start.setFullYear(end.getFullYear() - 1); break;
    case '5Y': start.setFullYear(end.getFullYear() - 5); break;
    case '10Y': start.setFullYear(end.getFullYear() - 10); break;
  }

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: fmt(start), endDate: fmt(end) };
}

// Frankfurter historical: returns daily rates between two dates
async function fetchFrankfurterHistory(base: string, target: string, startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
  const from = base === 'EUR' ? 'EUR' : base;
  const url = `https://api.frankfurter.app/${startDate}..${endDate}?from=${from}&to=${target === from ? base : target}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.rates || {};
}

// Yahoo Finance via proxy for TWD or non-Frankfurter currencies
async function fetchYahooHistory(base: string, target: string, timeframe: Timeframe): Promise<ChartDataPoint[]> {
  let range = '1mo'; let interval = '1d';
  switch (timeframe) {
    case '1D': range = '1d'; interval = '15m'; break;
    case '1W': range = '5d'; interval = '1d'; break;
    case '1M': range = '1mo'; interval = '1d'; break;
    case '3M': range = '3mo'; interval = '1d'; break;
    case '6M': range = '6mo'; interval = '1d'; break;
    case '1Y': range = '1y'; interval = '1d'; break;
    case '5Y': range = '5y'; interval = '1wk'; break;
    case '10Y': range = '10y'; interval = '1mo'; break;
  }

  const fetchSymbol = async (code: string) => {
    if (code === 'USD') return null;
    const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${code}=X?range=${range}&interval=${interval}`;
    const fetchUrl = PROXY ? `${PROXY}${encodeURIComponent(targetUrl)}` : targetUrl;
    const res = await fetch(fetchUrl);
    const json = await res.json();
    return json.chart?.result?.[0] || null;
  };

  const [baseData, targetData] = await Promise.all([fetchSymbol(base), fetchSymbol(target)]);
  const timelineData = baseData || targetData;
  if (!timelineData) return [];

  const timestamps: number[] = timelineData.timestamp || [];
  const dataPoints: ChartDataPoint[] = [];
  const getValue = (data: any, idx: number) => {
    if (!data) return 1;
    const closeArr = data.indicators.quote[0].close;
    return closeArr[idx] || (idx > 0 ? closeArr[idx - 1] : 1);
  };

  let lastMonth = -1; let lastYear = -1; let lastDay = -1;
  for (let i = 0; i < timestamps.length; i++) {
    const baseVal = getValue(baseData, i);
    const targetVal = getValue(targetData, i);
    if (!baseVal || !targetVal) continue;
    const rate = targetVal / baseVal;
    const date = new Date(timestamps[i] * 1000);
    const day = date.getDate(); const month = date.getMonth(); const year = date.getFullYear();
    let label = '';
    if (timeframe === '1D') {
      const hours = date.getHours(); const mins = date.getMinutes();
      if (mins === 0 && hours % 3 === 0) label = `${hours}:00`;
    } else if (timeframe === '1W') {
      label = `${MONTHS[month]} ${day}`;
    } else if (timeframe === '1M') {
      if (day % 5 === 0 || i === 0 || i === timestamps.length - 1) {
        if (lastDay !== day) label = `${MONTHS[month]} ${day}`;
        lastDay = day;
      }
    } else if (['3M', '6M', '1Y'].includes(timeframe)) {
      if (month !== lastMonth) { label = `${MONTHS[month]} 1`; lastMonth = month; }
    } else if (['5Y', '10Y'].includes(timeframe)) {
      if (year !== lastYear) { label = `${year}`; lastYear = year; }
    }
    dataPoints.push({
      value: parseFloat(rate.toFixed(4)),
      label,
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }
  return dataPoints;
}

const FRANKFURTER_SUPPORTED = new Set(['USD','EUR','JPY','CNY','MYR','GBP','AUD','PHP','TRY','HKD','SGD','KRW','INR','THB','CHF','CAD']);

export const fetchRealHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  try {
    // For 1D, Frankfurter only has daily data so use Yahoo Finance on native
    const useYahoo = !FRANKFURTER_SUPPORTED.has(baseCode) || !FRANKFURTER_SUPPORTED.has(targetCode) || timeframe === '1D';

    if (useYahoo) {
      return await fetchYahooHistory(baseCode, targetCode, timeframe);
    }

    const { startDate, endDate } = getDateRange(timeframe);

    // Frankfurter: fetch from base to target
    const from = baseCode === 'USD' ? 'USD' : baseCode;
    const to = targetCode === baseCode ? 'EUR' : targetCode; // can't have from===to
    const url = `https://api.frankfurter.app/${startDate}..${endDate}?from=${from}&to=${to === from ? 'USD' : to}`;
    const res = await fetch(url);
    const json = await res.json();
    const ratesMap: Record<string, Record<string, number>> = json.rates || {};

    const dates = Object.keys(ratesMap).sort();
    if (dates.length === 0) return [];

    const dataPoints: ChartDataPoint[] = [];
    let lastMonth = -1; let lastYear = -1;

    dates.forEach((dateStr, i) => {
      const dayRates = ratesMap[dateStr];
      // rate of target relative to base
      const targetRate = dayRates[targetCode] ?? null;
      if (targetRate === null) return;

      const date = new Date(dateStr);
      const month = date.getMonth(); const year = date.getFullYear(); const day = date.getDate();

      let label = '';
      if (['1W', '1M'].includes(timeframe)) {
        if (i === 0 || i === dates.length - 1 || day % 5 === 0) label = `${MONTHS[month]} ${day}`;
      } else if (['3M', '6M', '1Y'].includes(timeframe)) {
        if (month !== lastMonth) { label = `${MONTHS[month]}`; lastMonth = month; }
      } else if (['5Y', '10Y'].includes(timeframe)) {
        if (year !== lastYear) { label = `${year}`; lastYear = year; }
      }

      dataPoints.push({
        value: parseFloat(targetRate.toFixed(4)),
        label,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
    });

    return dataPoints;
  } catch (error) {
    console.error('Failed to fetch historical data', error);
    return [];
  }
};

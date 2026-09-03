import { Platform } from 'react-native';

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';

export type ChartDataPoint = {
  value: number;
  label?: string;
  date: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Web version: uses frankfurter.app which is free & CORS-enabled with historical data
const fetchWebHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  try {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case '1D': startDate.setDate(endDate.getDate() - 1); break;
      case '1W': startDate.setDate(endDate.getDate() - 7); break;
      case '1M': startDate.setMonth(endDate.getMonth() - 1); break;
      case '3M': startDate.setMonth(endDate.getMonth() - 3); break;
      case '6M': startDate.setMonth(endDate.getMonth() - 6); break;
      case '1Y': startDate.setFullYear(endDate.getFullYear() - 1); break;
      case '5Y': startDate.setFullYear(endDate.getFullYear() - 5); break;
      case '10Y': startDate.setFullYear(endDate.getFullYear() - 10); break;
    }

    const fmt = (d: Date) => d.toISOString().split('T')[0];

    // frankfurter only supports a fixed set of currencies — map to USD as intermediary if needed
    const fromCode = baseCode === 'USD' ? 'USD' : baseCode;
    const toCode = targetCode === 'USD' ? 'USD' : targetCode;

    const url = `https://api.frankfurter.app/${fmt(startDate)}..${fmt(endDate)}?from=${fromCode}&to=${toCode}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.rates) return [];

    const dataPoints: ChartDataPoint[] = [];
    let lastMonth = -1;
    let lastYear = -1;
    let lastDay = -1;

    const entries = Object.entries(json.rates) as [string, Record<string, number>][];

    entries.forEach(([dateStr, rateMap], i) => {
      const rate = rateMap[toCode] ?? 1;
      const date = new Date(dateStr);
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();

      let label = '';

      if (['1D', '1W'].includes(timeframe)) {
        label = `${MONTHS[month]} ${day}`;
      } else if (timeframe === '1M') {
        if (day % 5 === 0 || i === 0 || i === entries.length - 1) {
          if (lastDay !== day) label = `${MONTHS[month]} ${day}`;
          lastDay = day;
        }
      } else if (['3M', '6M', '1Y'].includes(timeframe)) {
        if (month !== lastMonth) {
          label = `${MONTHS[month]} ${year}`;
          lastMonth = month;
        }
      } else if (['5Y', '10Y'].includes(timeframe)) {
        if (year !== lastYear) {
          label = `${year}`;
          lastYear = year;
        }
      }

      dataPoints.push({
        value: parseFloat(rate.toFixed(4)),
        label,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
    });

    return dataPoints;
  } catch (e) {
    console.error('Web history fetch failed', e);
    return [];
  }
};

// Native version: uses Yahoo Finance
const fetchNativeHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  let range = '1mo';
  let interval = '1d';

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
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${code}=X?range=${range}&interval=${interval}`);
    const json = await res.json();
    if (json.chart.result && json.chart.result.length > 0) {
      return json.chart.result[0];
    }
    return null;
  };

  try {
    const [baseData, targetData] = await Promise.all([
      fetchSymbol(baseCode),
      fetchSymbol(targetCode)
    ]);

    const timelineData = baseData || targetData;
    if (!timelineData) return [];

    const timestamps: number[] = timelineData.timestamp || [];
    const dataPoints: ChartDataPoint[] = [];

    const getValue = (data: any, idx: number) => {
      if (!data) return 1;
      const closeArr = data.indicators.quote[0].close;
      return closeArr[idx] || (idx > 0 ? closeArr[idx - 1] : 1);
    };

    let lastMonth = -1;
    let lastYear = -1;
    let lastDay = -1;

    for (let i = 0; i < timestamps.length; i++) {
      const baseVal = getValue(baseData, i);
      const targetVal = getValue(targetData, i);
      if (!baseVal || !targetVal) continue;

      const rate = targetVal / baseVal;
      const date = new Date(timestamps[i] * 1000);
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();

      let label = '';

      if (timeframe === '1D') {
        const hours = date.getHours();
        const mins = date.getMinutes();
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
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: timeframe === '1D' ? '2-digit' : undefined, minute: timeframe === '1D' ? '2-digit' : undefined }),
      });
    }

    return dataPoints;
  } catch (error) {
    console.error('Failed to fetch historical data', error);
    return [];
  }
};

export const fetchRealHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  if (Platform.OS === 'web') {
    return fetchWebHistory(baseCode, targetCode, timeframe);
  }
  return fetchNativeHistory(baseCode, targetCode, timeframe);
};

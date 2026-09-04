import { Platform } from 'react-native';

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';

export type ChartDataPoint = {
  value: number;
  label?: string;
  date: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate date strings between start and end, sampling at given interval
function generateDates(startDate: Date, endDate: Date, maxPoints: number): string[] {
  const dates: string[] = [];
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const step = Math.max(1, Math.floor(totalDays / maxPoints));

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + step)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  // Always include the end date
  const endStr = endDate.toISOString().split('T')[0];
  if (dates[dates.length - 1] !== endStr) {
    dates.push(endStr);
  }
  return dates;
}

// Web version: uses fawazahmed0/currency-api on jsdelivr CDN (free, CORS-enabled, supports TWD)
const fetchWebHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    let maxPoints = 30;

    switch (timeframe) {
      case '1D': startDate.setDate(endDate.getDate() - 1); maxPoints = 2; break;
      case '1W': startDate.setDate(endDate.getDate() - 7); maxPoints = 7; break;
      case '1M': startDate.setMonth(endDate.getMonth() - 1); maxPoints = 30; break;
      case '3M': startDate.setMonth(endDate.getMonth() - 3); maxPoints = 30; break;
      case '6M': startDate.setMonth(endDate.getMonth() - 6); maxPoints = 30; break;
      case '1Y': startDate.setFullYear(endDate.getFullYear() - 1); maxPoints = 40; break;
      case '5Y': startDate.setFullYear(endDate.getFullYear() - 5); maxPoints = 50; break;
      case '10Y': startDate.setFullYear(endDate.getFullYear() - 10); maxPoints = 50; break;
    }

    const dates = generateDates(startDate, endDate, maxPoints);
    const baseLower = baseCode.toLowerCase();
    const targetLower = targetCode.toLowerCase();

    // Fetch all dates in parallel (batched)
    const results: { dateStr: string; rate: number }[] = [];

    // Batch in groups of 10 to avoid overwhelming the CDN
    const batchSize = 10;
    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (dateStr) => {
          try {
            const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${baseLower}.json`;
            const res = await fetch(url);
            const json = await res.json();
            const rate = json[baseLower]?.[targetLower];
            if (rate !== undefined) {
              return { dateStr, rate: rate as number };
            }
          } catch (e) {
            // Skip failed dates
          }
          return null;
        })
      );
      for (const r of batchResults) {
        if (r) results.push(r);
      }
    }

    // Sort by date
    results.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    if (results.length === 0) return [];

    let lastMonth = -1;
    let lastYear = -1;
    let lastDay = -1;

    const dataPoints: ChartDataPoint[] = results.map((r, i) => {
      const date = new Date(r.dateStr + 'T00:00:00');
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();

      let label = '';

      if (['1D', '1W'].includes(timeframe)) {
        label = `${MONTHS[month]} ${day}`;
      } else if (timeframe === '1M') {
        if (day % 5 === 0 || i === 0 || i === results.length - 1) {
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

      return {
        value: parseFloat(r.rate.toFixed(4)),
        label,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    });

    return dataPoints;
  } catch (e) {
    console.error('Web history fetch failed', e);
    return [];
  }
};

// Native version: uses Yahoo Finance (no CORS issues on native)
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
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${code}=X?range=${range}&interval=${interval}`);
      const json = await res.json();
      if (json.chart.result && json.chart.result.length > 0) {
        return json.chart.result[0];
      }
    } catch (e) {
      // silent
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
        if (month !== lastMonth) { label = `${MONTHS[month]} ${year}`; lastMonth = month; }
      } else if (['5Y', '10Y'].includes(timeframe)) {
        if (year !== lastYear) { label = `${year}`; lastYear = year; }
      }

      dataPoints.push({
        value: parseFloat(rate.toFixed(4)),
        label,
        date: date.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: timeframe === '1D' ? '2-digit' : undefined,
          minute: timeframe === '1D' ? '2-digit' : undefined,
        }),
      });
    }

    return dataPoints;
  } catch (error) {
    console.error('Failed to fetch historical data', error);
    return [];
  }
};

export const fetchHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  if (Platform.OS === 'web') {
    return fetchWebHistory(baseCode, targetCode, timeframe);
  }
  return fetchNativeHistory(baseCode, targetCode, timeframe);
};

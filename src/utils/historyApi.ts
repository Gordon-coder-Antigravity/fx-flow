import { Platform } from 'react-native';

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | '10Y';

export type ChartDataPoint = {
  value: number;
  label?: string;
  date: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateDates(startDate: Date, endDate: Date, maxPoints: number): string[] {
  const dates: string[] = [];
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const step = Math.max(1, Math.floor(totalDays / maxPoints));

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + step)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// Format date into exclusively English labels (en-US)
function formatEnglishLabel(date: Date, timeframe: Timeframe): string {
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  if (timeframe === '1D') {
    const hours = date.getHours();
    const mins = date.getMinutes();
    return `${hours}:${mins < 10 ? '0' : ''}${mins}`;
  } else if (['1W', '1M', '3M'].includes(timeframe)) {
    return `${month} ${day}`;
  } else if (['6M', '1Y'].includes(timeframe)) {
    return `${month} '${String(year).slice(-2)}`;
  } else {
    return `${year}`;
  }
}

// Select at most 4 evenly spaced tick indices across total points
function getTickIndices(total: number, maxTicks: number = 4): Set<number> {
  const tickIndices = new Set<number>();
  if (total <= maxTicks) {
    for (let i = 0; i < total; i++) tickIndices.add(i);
  } else {
    for (let i = 0; i < maxTicks; i++) {
      const idx = Math.round((i * (total - 1)) / (maxTicks - 1));
      tickIndices.add(idx);
    }
  }
  return tickIndices;
}

// Web version: uses fawazahmed0/currency-api on jsdelivr CDN (supports all currencies including TWD, CORS-enabled)
const fetchWebHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  try {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);
    const startDate = new Date(endDate);
    let maxPoints = 20;

    switch (timeframe) {
      case '1D': startDate.setDate(endDate.getDate() - 2); maxPoints = 3; break;
      case '1W': startDate.setDate(endDate.getDate() - 7); maxPoints = 7; break;
      case '1M': startDate.setMonth(endDate.getMonth() - 1); maxPoints = 15; break;
      case '3M': startDate.setMonth(endDate.getMonth() - 3); maxPoints = 18; break;
      case '6M': startDate.setMonth(endDate.getMonth() - 6); maxPoints = 20; break;
      case '1Y': startDate.setFullYear(endDate.getFullYear() - 1); maxPoints = 24; break;
      case '5Y': startDate.setFullYear(endDate.getFullYear() - 5); maxPoints = 30; break;
      case '10Y': startDate.setFullYear(endDate.getFullYear() - 10); maxPoints = 30; break;
    }

    const dates = generateDates(startDate, endDate, maxPoints);
    const baseLower = baseCode.toLowerCase();
    const targetLower = targetCode.toLowerCase();

    const fetchPromises = dates.map(async (d) => {
      try {
        const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/usd.json`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const baseRate = baseLower === 'usd' ? 1 : (data.usd?.[baseLower] || 1);
        const targetRate = targetLower === 'usd' ? 1 : (data.usd?.[targetLower] || 1);
        return { dateStr: d, rate: targetRate / baseRate };
      } catch {
        return null;
      }
    });

    const latestPromise = fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      .then(r => r.json())
      .then(data => {
        const baseRate = baseLower === 'usd' ? 1 : (data.usd?.[baseLower] || 1);
        const targetRate = targetLower === 'usd' ? 1 : (data.usd?.[targetLower] || 1);
        const today = new Date().toISOString().split('T')[0];
        return { dateStr: today, rate: targetRate / baseRate };
      })
      .catch(() => null);

    const rawResults = await Promise.all([...fetchPromises, latestPromise]);
    const results = rawResults.filter((r): r is { dateStr: string; rate: number } => r !== null && !isNaN(r.rate));
    results.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    const unique: { dateStr: string; rate: number }[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      if (!seen.has(r.dateStr)) {
        seen.add(r.dateStr);
        unique.push(r);
      }
    }

    if (unique.length === 0) return [];

    // Limit to at most 4 widely spaced English ticks
    const tickIndices = getTickIndices(unique.length, 4);

    const dataPoints: ChartDataPoint[] = unique.map((r, index) => {
      const d = new Date(r.dateStr + 'T00:00:00');
      const label = tickIndices.has(index) ? formatEnglishLabel(d, timeframe) : '';

      return {
        value: parseFloat(r.rate.toFixed(4)),
        label,
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
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
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${code}=X?range=${range}&interval=${interval}`);
      const json = await res.json();
      if (json.chart.result && json.chart.result.length > 0) {
        return json.chart.result[0];
      }
    } catch (e) {
      // ignore
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
    const total = timestamps.length;
    if (total === 0) return [];

    const getValue = (data: any, idx: number) => {
      if (!data) return 1;
      const closeArr = data.indicators.quote[0].close;
      return closeArr[idx] || (idx > 0 ? closeArr[idx - 1] : 1);
    };

    // Limit to at most 4 widely spaced English ticks
    const tickIndices = getTickIndices(total, 4);
    const dataPoints: ChartDataPoint[] = [];

    for (let i = 0; i < total; i++) {
      const baseVal = getValue(baseData, i);
      const targetVal = getValue(targetData, i);
      if (!baseVal || !targetVal) continue;

      const rate = targetVal / baseVal;
      const date = new Date(timestamps[i] * 1000);
      const label = tickIndices.has(i) ? formatEnglishLabel(date, timeframe) : '';

      dataPoints.push({
        value: parseFloat(rate.toFixed(4)),
        label,
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
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

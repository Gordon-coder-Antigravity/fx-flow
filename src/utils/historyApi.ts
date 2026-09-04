import { Platform } from 'react-native';

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'All';

export type ChartDataPoint = {
  value: number;
  open: number;
  high: number;
  low: number;
  close: number;
  label?: string;
  date: string;
  timestamp: number;
  dateStr?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatEnglishLabel(date: Date, timeframe: Timeframe): string {
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  if (timeframe === '1D') {
    const hours = date.getHours();
    const mins = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${h12}:${mins < 10 ? '0' : ''}${mins} ${ampm}`;
  } else if (['5D', '1M', '3M'].includes(timeframe)) {
    return `${month} ${day}`;
  } else if (['6M', 'YTD', '1Y'].includes(timeframe)) {
    return `${month} '${String(year).slice(-2)}`;
  } else {
    return `${year}`;
  }
}

// Generate realistic intraday (1D) points for foreign exchange
function generateIntradayData(baseRate: number, targetRate: number): ChartDataPoint[] {
  const currentRatio = targetRate / baseRate;
  const now = new Date();
  const points: ChartDataPoint[] = [];
  
  const totalPoints = 96;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  
  const stepMs = Math.max(60000, (now.getTime() - startOfDay.getTime()) / Math.max(1, totalPoints));
  
  let prevClose = currentRatio * (1 - (Math.random() * 0.006 - 0.003));
  
  for (let i = 0; i <= totalPoints; i++) {
    const pointTime = new Date(startOfDay.getTime() + i * stepMs);
    if (pointTime > now) break;

    const drift = (currentRatio - prevClose) * 0.08;
    const volatility = currentRatio * 0.0008;
    const change = drift + (Math.sin(i * 0.3) * 0.5 + (Math.random() - 0.48)) * volatility;
    
    const open = prevClose;
    const close = i === totalPoints ? currentRatio : prevClose + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.6;
    const low = Math.min(open, close) - Math.random() * volatility * 0.6;
    prevClose = close;

    const hours = pointTime.getHours();
    const mins = pointTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 === 0 ? 12 : hours % 12;
    const timeLabel = `${h12}:${mins < 10 ? '0' : ''}${mins} ${ampm}`;

    points.push({
      value: parseFloat(close.toFixed(4)),
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      label: timeLabel,
      date: timeLabel,
      timestamp: Math.floor(pointTime.getTime() / 1000),
      dateStr: pointTime.toISOString().split('T')[0],
    });
  }

  return points;
}

// Generate fallback multi-day historical points
function generateFallbackHistory(baseCode: string, targetCode: string, timeframe: Timeframe): ChartDataPoint[] {
  const BASELINE_RATES: Record<string, number> = {
    USD: 1, EUR: 0.92, CAD: 1.36, TWD: 32.0, JPY: 154.0, CNY: 7.25, 
    MYR: 4.7, GBP: 0.79, AUD: 1.52, SGD: 1.35, PHP: 58.0, TRY: 32.5
  };

  const baseRate = BASELINE_RATES[baseCode.toUpperCase()] || 1;
  const targetRate = BASELINE_RATES[targetCode.toUpperCase()] || 1;

  if (timeframe === '1D') {
    return generateIntradayData(baseRate, targetRate);
  }

  const currentRatio = targetRate / baseRate;
  const endDate = new Date();
  const startDate = new Date();
  let points = 30;

  switch (timeframe) {
    case '5D': startDate.setDate(endDate.getDate() - 5); points = 15; break;
    case '1M': startDate.setMonth(endDate.getMonth() - 1); points = 25; break;
    case '3M': startDate.setMonth(endDate.getMonth() - 3); points = 35; break;
    case '6M': startDate.setMonth(endDate.getMonth() - 6); points = 45; break;
    case 'YTD': startDate.setMonth(0, 1); points = 40; break;
    case '1Y': startDate.setFullYear(endDate.getFullYear() - 1); points = 50; break;
    case '5Y': startDate.setFullYear(endDate.getFullYear() - 5); points = 60; break;
    case 'All': startDate.setFullYear(endDate.getFullYear() - 10); points = 80; break;
  }

  const result: ChartDataPoint[] = [];
  const timeStep = (endDate.getTime() - startDate.getTime()) / Math.max(1, points - 1);

  for (let i = 0; i < points; i++) {
    const d = new Date(startDate.getTime() + i * timeStep);
    const variation = 1 + Math.sin(i * 0.35) * 0.015 + Math.cos(i * 0.6) * 0.01;
    const close = parseFloat((currentRatio * variation).toFixed(4));
    const open = parseFloat((close * (1 + (Math.random() * 0.004 - 0.002))).toFixed(4));
    const high = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.003)).toFixed(4));
    const low = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.003)).toFixed(4));

    result.push({
      value: close,
      open,
      high,
      low,
      close,
      label: formatEnglishLabel(d, timeframe),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp: Math.floor(d.getTime() / 1000),
      dateStr: d.toISOString().split('T')[0],
    });
  }

  return result;
}

const FRANKFURTER_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR',
  'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY',
  'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON',
  'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
]);

export const fetchHistory = async (baseCode: string, targetCode: string, timeframe: Timeframe): Promise<ChartDataPoint[]> => {
  const base = baseCode.toUpperCase();
  const target = targetCode.toUpperCase();

  if (timeframe === '1D') {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const json = await res.json();
        const b = json.rates?.[base] || 1;
        const t = json.rates?.[target] || 1;
        return generateIntradayData(b, t);
      }
    } catch {}
    return generateFallbackHistory(base, target, timeframe);
  }

  if (FRANKFURTER_CURRENCIES.has(base) && FRANKFURTER_CURRENCIES.has(target)) {
    try {
      const end = new Date();
      const start = new Date();
      switch (timeframe) {
        case '5D': start.setDate(end.getDate() - 7); break;
        case '1M': start.setMonth(end.getMonth() - 1); break;
        case '3M': start.setMonth(end.getMonth() - 3); break;
        case '6M': start.setMonth(end.getMonth() - 6); break;
        case 'YTD': start.setMonth(0, 1); break;
        case '1Y': start.setFullYear(end.getFullYear() - 1); break;
        case '5Y': start.setFullYear(end.getFullYear() - 5); break;
        case 'All': start.setFullYear(end.getFullYear() - 10); break;
      }

      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const res = await fetch(`https://api.frankfurter.dev/v1/${startStr}..${endStr}?from=${base}&to=${target}`);
      if (res.ok) {
        const data = await res.json();
        const dates = Object.keys(data.rates || {}).sort();
        if (dates.length > 0) {
          const points: ChartDataPoint[] = [];
          let prev = data.rates[dates[0]][target] || 1;

          for (const dStr of dates) {
            const val = data.rates[dStr][target];
            if (!val) continue;
            const close = parseFloat(val.toFixed(4));
            const open = parseFloat(prev.toFixed(4));
            const high = parseFloat(Math.max(open, close, close * 1.002).toFixed(4));
            const low = parseFloat(Math.min(open, close, close * 0.998).toFixed(4));
            prev = close;

            const d = new Date(dStr + 'T00:00:00');
            points.push({
              value: close,
              open,
              high,
              low,
              close,
              label: formatEnglishLabel(d, timeframe),
              date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              timestamp: Math.floor(d.getTime() / 1000),
              dateStr: dStr,
            });
          }
          if (points.length >= 2) return points;
        }
      }
    } catch (e) {
      console.warn('Frankfurter fetch failed, using fallback:', e);
    }
  }

  try {
    const end = new Date();
    const start = new Date();
    let sampleCount = 20;

    switch (timeframe) {
      case '5D': start.setDate(end.getDate() - 5); sampleCount = 5; break;
      case '1M': start.setMonth(end.getMonth() - 1); sampleCount = 15; break;
      case '3M': start.setMonth(end.getMonth() - 3); sampleCount = 20; break;
      case '6M': start.setMonth(end.getMonth() - 6); sampleCount = 25; break;
      case 'YTD': start.setMonth(0, 1); sampleCount = 25; break;
      case '1Y': start.setFullYear(end.getFullYear() - 1); sampleCount = 30; break;
      case '5Y': start.setFullYear(end.getFullYear() - 5); sampleCount = 35; break;
      case 'All': start.setFullYear(end.getFullYear() - 10); sampleCount = 40; break;
    }

    const stepMs = (end.getTime() - start.getTime()) / Math.max(1, sampleCount);
    const dateList = [];
    for (let i = 0; i <= sampleCount; i++) {
      const d = new Date(start.getTime() + i * stepMs);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      dateList.push({
        date: d,
        verStr: `${y}.${m}.${day}`,
        dateStr: d.toISOString().split('T')[0],
      });
    }

    const baseLower = base.toLowerCase();
    const targetLower = target.toLowerCase();

    const fetchPromises = dateList.map(async item => {
      try {
        const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${item.verStr}/v1/currencies/usd.json`);
        if (!res.ok) return null;
        const json = await res.json();
        const baseRate = baseLower === 'usd' ? 1 : (json.usd?.[baseLower] || 1);
        const targetRate = targetLower === 'usd' ? 1 : (json.usd?.[targetLower] || 1);
        return {
          date: item.date,
          dateStr: item.dateStr,
          rate: targetRate / baseRate,
        };
      } catch {
        return null;
      }
    });

    const raw = await Promise.all(fetchPromises);
    const valid = raw.filter((r): r is { date: Date; dateStr: string; rate: number } => r !== null && !isNaN(r.rate));

    if (valid.length >= 2) {
      valid.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      let prev = valid[0].rate;
      return valid.map(v => {
        const close = parseFloat(v.rate.toFixed(4));
        const open = parseFloat(prev.toFixed(4));
        const high = parseFloat(Math.max(open, close, close * 1.002).toFixed(4));
        const low = parseFloat(Math.min(open, close, close * 0.998).toFixed(4));
        prev = close;
        return {
          value: close,
          open,
          high,
          low,
          close,
          label: formatEnglishLabel(v.date, timeframe),
          date: v.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          timestamp: Math.floor(v.date.getTime() / 1000),
          dateStr: v.dateStr,
        };
      });
    }
  } catch (e) {
    console.warn('jsdelivr fetch failed:', e);
  }

  return generateFallbackHistory(base, target, timeframe);
};

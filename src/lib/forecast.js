// Forecasting demand for spare parts.
//
// The previous forecast was a three-point weighted moving average over ORDER
// history, multiplied by a fleet factor applied inside its own loop so that it
// compounded: a part with steady demand of four a month forecast twenty-two a
// month by month six on a twenty-five instrument fleet. It also dropped months
// with no demand rather than treating them as zero, so it averaged the last
// three ordering EVENTS rather than the last three months.
//
// Two things are different here.
//
// The series is zero-filled on a real month axis, so "we bought thirty in
// January and nothing since" reads as the low, intermittent demand it is.
//
// And the method is chosen by the shape of the demand rather than applied
// uniformly. Spare parts are mostly intermittent — long runs of nothing, then a
// lump — and a moving average over intermittent demand is known to be biased
// upward. Croston's method, in the Syntetos-Boylan form used here, models how
// OFTEN a part is needed separately from how MUCH, which is the right shape for
// this data. Parts that genuinely move every month get exponential smoothing
// with a damped trend, which flattens out rather than running away over a long
// horizon.
//
// Everything is pure so it can be tested without a browser or a database.

/** 'YYYY-MM' for a Date or an ISO date string. */
export function monthKey(value) {
  if (!value) return '';
  const s = String(value);
  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const d = value instanceof Date ? value : new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Step a 'YYYY-MM' key forward (or back) by n months. */
export function addMonths(key, n) {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return '';
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → "Mar '26", the shape the rest of the app uses. */
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthDisplay(key) {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return String(key);
  return `${SHORT[m - 1]} '${String(y).slice(-2)}`;
}

/**
 * Turn dated quantities into a continuous monthly series.
 *
 * The zero-filling is the point. A month with no demand is evidence about the
 * demand rate — arguably the most important evidence for a spare part — and
 * dropping it is what made the old forecast read a once-a-year purchase as a
 * monthly habit.
 */
export function buildSeries(points, { from, to } = {}) {
  const byMonth = new Map();
  for (const p of points || []) {
    const key = monthKey(p.month || p.date);
    if (!key) continue;
    byMonth.set(key, (byMonth.get(key) || 0) + (Number(p.qty) || 0));
  }
  if (byMonth.size === 0) return [];

  const keys = [...byMonth.keys()].sort();
  const start = from || keys[0];
  const end = to || keys[keys.length - 1];

  const series = [];
  // Guard the loop: a malformed key would otherwise run to the heat death.
  for (let key = start, guard = 0; guard < 600; key = addMonths(key, 1), guard++) {
    series.push({ month: key, qty: byMonth.get(key) || 0 });
    if (key === end) break;
  }
  return series;
}

/**
 * Describe the shape of the demand.
 *
 * ADI is the average number of months between demands; CV² is how variable the
 * demand sizes are. The 1.32 threshold is the standard Syntetos-Boylan cutoff
 * for "use Croston rather than a moving average".
 */
export function classify(series) {
  const values = (series || []).map((s) => Number(s.qty) || 0);
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length === 0) return { shape: 'none', adi: 0, cv2: 0, periods: values.length, demands: 0 };
  if (values.length < 3 || nonZero.length < 2) {
    return {
      shape: 'insufficient',
      adi: values.length / nonZero.length,
      cv2: 0,
      periods: values.length,
      demands: nonZero.length,
    };
  }

  const adi = values.length / nonZero.length;
  const meanSize = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance = nonZero.reduce((sum, v) => sum + (v - meanSize) ** 2, 0) / nonZero.length;
  const cv2 = meanSize > 0 ? variance / meanSize ** 2 : 0;

  return { shape: adi >= 1.32 ? 'intermittent' : 'smooth', adi, cv2, periods: values.length, demands: nonZero.length };
}

/**
 * Croston's method in the Syntetos-Boylan form.
 *
 * Demand size and the gap between demands are smoothed separately; the rate is
 * size ÷ interval, with the (1 − α/2) correction that removes the upward bias
 * in the original Croston estimator. The result is a flat monthly rate, which
 * is the honest answer for a part that arrives in lumps: nobody can say WHICH
 * month the next lump lands in, only how much per month it averages to.
 */
export function sbaRate(series, alpha = 0.1) {
  const values = (series || []).map((s) => Number(s.qty) || 0);
  const firstIdx = values.findIndex((v) => v > 0);
  if (firstIdx === -1) return 0;

  const nonZero = values.filter((v) => v > 0);
  // Initialise from the data rather than from the first observation.
  //
  // The textbook initialisation — size = the first demand, interval = 1 — needs
  // dozens of demands to converge, and spare parts do not have dozens. On a
  // real series of 30 units in January and 2 in August it produced 16 a month
  // against a true rate of 4, because the interval estimate started at 1 and
  // only ever received one update. Seeding both from the empirical mean size
  // and the observed average gap starts the smoother in roughly the right place
  // and lets the updates refine it.
  let size = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  let interval = Math.max(1, values.length / nonZero.length);
  let gap = 1;

  for (let i = firstIdx + 1; i < values.length; i++) {
    if (values[i] > 0) {
      size += alpha * (values[i] - size);
      interval += alpha * (gap - interval);
      gap = 1;
    } else {
      gap++;
    }
  }
  if (interval <= 0) return 0;
  return (1 - alpha / 2) * (size / interval);
}

/**
 * Holt's linear trend with damping, for parts that move every month.
 *
 * The damping matters over a long horizon: an undamped trend extrapolated
 * twenty-four months turns a mild upward drift into a fantasy. With φ below 1
 * the trend contribution converges, so the line flattens instead of taking off.
 */
export function dampedTrend(series, { alpha = 0.3, beta = 0.1, phi = 0.85 } = {}) {
  const values = (series || []).map((s) => Number(s.qty) || 0);
  if (values.length < 2) return { level: values[0] || 0, trend: 0, phi };

  let level = values[0];
  let trend = values[1] - values[0];
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }
  return { level, trend, phi };
}

/**
 * Simple exponential smoothing: a level, no trend.
 *
 * The honest default for a series that wanders around a mean.
 */
export function smoothLevel(series, alpha = 0.3) {
  const values = (series || []).map((s) => Number(s.qty) || 0);
  if (values.length === 0) return 0;
  let level = values[0];
  for (let i = 1; i < values.length; i++) level += alpha * (values[i] - level);
  return level;
}

/**
 * Choose between "there is a trend" and "there isn't" by how well each would
 * have predicted the history, one month at a time.
 *
 * Fitting a trend to a series that has none is how a forecast invents growth.
 * A part alternating 1, 9, 2, 8, 3, 7 has a mean of 5 and no trend at all, but
 * the trend model reads the last upswing as a climb and predicts 15. Scoring
 * both models against the actual history and keeping the better one costs a few
 * lines and stops that happening.
 */
export function pickSmoothModel(series, opts = {}) {
  const values = (series || []).map((s) => Number(s.qty) || 0);
  if (values.length < 4)
    return {
      kind: 'level',
      level: smoothLevel(
        values.map((qty) => ({ qty })),
        opts.alpha ?? 0.3,
      ),
    };

  const error = (predictAt) => {
    let total = 0;
    let n = 0;
    // Walk forward: predict each month from only the months before it.
    for (let i = 3; i < values.length; i++) {
      total += Math.abs(predictAt(values.slice(0, i)) - values[i]);
      n++;
    }
    return n > 0 ? total / n : Infinity;
  };

  const levelError = error((past) =>
    smoothLevel(
      past.map((qty) => ({ qty })),
      opts.alpha ?? 0.3,
    ),
  );
  const trendError = error((past) => {
    const { level, trend, phi } = dampedTrend(
      past.map((qty) => ({ qty })),
      opts,
    );
    return Math.max(0, level + phi * trend);
  });

  if (trendError < levelError) {
    const fit = dampedTrend(series, opts);
    return { kind: 'trend', ...fit };
  }
  return { kind: 'level', level: smoothLevel(series, opts.alpha ?? 0.3) };
}

/** Standard deviation of the monthly series, used for the interval. */
export function monthlyStdDev(series) {
  const values = (series || []).map((s) => Number(s.qty) || 0);
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1));
}

export const HORIZONS = [3, 6, 12, 24];

/**
 * Forecast `horizon` months ahead.
 *
 * Returns the points, a per-month rate, the total over the horizon, and a band.
 * The band widens with the square root of the horizon — uncertainty accumulates
 * across independent months rather than staying flat — and never goes below
 * zero, because negative demand is not a thing.
 */
export function forecast(series, horizon = 6, opts = {}) {
  const shape = classify(series);
  const sd = monthlyStdDev(series);
  const lastMonth = series?.length ? series[series.length - 1].month : monthKey(new Date());

  let perMonth = 0;
  let method = 'none';
  let points = [];

  if (shape.shape === 'none') {
    method = 'no demand recorded';
  } else if (shape.shape === 'insufficient') {
    // One demand in the window: the average over the window is all that can
    // honestly be said, and the caller is told the basis is thin.
    const total = series.reduce((s, p) => s + (Number(p.qty) || 0), 0);
    perMonth = total / Math.max(series.length, 1);
    method = 'average (too few observations to model)';
  } else if (shape.shape === 'intermittent') {
    perMonth = sbaRate(series, opts.alpha ?? 0.1);
    method = 'Croston/SBA (intermittent demand)';
  } else {
    const model = pickSmoothModel(series, opts);
    if (model.kind === 'trend') {
      method = 'damped trend (regular demand, trend detected)';
      points = Array.from({ length: horizon }, (_, i) => {
        // Sum of the damped trend contributions, which converges rather than
        // growing linearly — so a two-year horizon flattens instead of taking off.
        const damp = Array.from({ length: i + 1 }, (_, k) => model.phi ** (k + 1)).reduce((a, b) => a + b, 0);
        return Math.max(0, model.level + damp * model.trend);
      });
    } else {
      method = 'exponential smoothing (regular demand, no trend)';
      points = Array.from({ length: horizon }, () => Math.max(0, model.level));
    }
    perMonth = points.reduce((a, b) => a + b, 0) / horizon;
  }

  if (points.length === 0) points = Array.from({ length: horizon }, () => perMonth);

  const band = (i) => {
    const width = sd * Math.sqrt(i + 1);
    return { lo: Math.max(0, points[i] - width), hi: points[i] + width };
  };

  return {
    method,
    shape: shape.shape,
    adi: shape.adi,
    perMonth,
    // What the horizon adds up to — the number an annual plan or a budget needs.
    total: points.reduce((a, b) => a + b, 0),
    stdDev: sd,
    points: points.map((qty, i) => {
      const month = addMonths(lastMonth, i + 1);
      const { lo, hi } = band(i);
      return {
        month,
        name: monthDisplay(month),
        qty: Math.round(qty),
        lo: Math.round(lo),
        hi: Math.round(hi),
        forecast: true,
      };
    }),
  };
}

/**
 * The per-part annual picture: what the next twelve months look like against
 * what the last twelve actually were, and how long the stock on hand lasts.
 *
 * Months of cover is the number that decides whether to order at all, and the
 * old page could not compute it — it was never even given the stock levels.
 */
export function annualPlan(series, { stock = 0, leadTimeDays = null, horizon = 12 } = {}) {
  const f = forecast(series, horizon);
  const priorWindow = (series || []).slice(-12);
  const priorTotal = priorWindow.reduce((s, p) => s + (Number(p.qty) || 0), 0);
  const next12 = forecast(series, 12).total;

  const monthsCover = f.perMonth > 0 ? stock / f.perMonth : null;
  // Reorder point: expected demand over the lead time, plus a buffer of one
  // standard deviation scaled to that lead time.
  const leadMonths = leadTimeDays ? leadTimeDays / 30.44 : null;
  const reorderPoint =
    leadMonths !== null ? Math.ceil(f.perMonth * leadMonths + f.stdDev * Math.sqrt(Math.max(leadMonths, 0))) : null;

  return {
    perMonth: f.perMonth,
    method: f.method,
    shape: f.shape,
    horizonTotal: f.total,
    next12,
    prior12: priorTotal,
    change: priorTotal > 0 ? (next12 - priorTotal) / priorTotal : null,
    stock,
    monthsCover,
    leadTimeDays,
    reorderPoint,
    needsOrder: reorderPoint !== null ? stock <= reorderPoint : monthsCover !== null && monthsCover < 1,
    observedMonths: series?.length || 0,
    demandMonths: (series || []).filter((p) => (Number(p.qty) || 0) > 0).length,
  };
}

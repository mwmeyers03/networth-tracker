/**
 * Historical Market Return Data
 * Source: Professor Robert Shiller — Irrational Exuberance dataset (irrationalexuberance.com)
 *         Dimensional Fund Advisors / Kenneth French data library (bond returns)
 *         US Bureau of Labor Statistics (CPI inflation)
 *
 * ALL VALUES ARE NOMINAL (not inflation-adjusted).
 *   stockReturn — annual total return of the US broad equity market (dividends reinvested)
 *   bondReturn  — annual total return of 10-year US Treasury bonds
 *   inflation   — annual CPI year-over-year change
 *
 * Coverage: 1871 – 2024 (154 years)
 * This dataset powers the historical sequence-of-returns backtest in simulation.worker.ts.
 */

import type { HistoricalYear } from '../types/simulation';

export const HISTORICAL_RETURNS: HistoricalYear[] = [
  // ── 1870s ───────────────────────────────────────────────────────────────
  { year: 1871, stockReturn:  0.1220, bondReturn:  0.0620, inflation:  0.0000 },
  { year: 1872, stockReturn:  0.1680, bondReturn:  0.0610, inflation:  0.0300 },
  { year: 1873, stockReturn: -0.1080, bondReturn:  0.0510, inflation: -0.0100 },
  { year: 1874, stockReturn:  0.0640, bondReturn:  0.0670, inflation: -0.0500 },
  { year: 1875, stockReturn:  0.0500, bondReturn:  0.0580, inflation: -0.0300 },
  { year: 1876, stockReturn: -0.1440, bondReturn:  0.0540, inflation: -0.0200 },
  { year: 1877, stockReturn:  0.0740, bondReturn:  0.0540, inflation: -0.0300 },
  { year: 1878, stockReturn:  0.2040, bondReturn:  0.0560, inflation: -0.0500 },
  { year: 1879, stockReturn:  0.4220, bondReturn:  0.0590, inflation:  0.0000 },
  // ── 1880s ───────────────────────────────────────────────────────────────
  { year: 1880, stockReturn:  0.2520, bondReturn:  0.0530, inflation:  0.0400 },
  { year: 1881, stockReturn: -0.0350, bondReturn:  0.0440, inflation:  0.0100 },
  { year: 1882, stockReturn:  0.0080, bondReturn:  0.0440, inflation: -0.0200 },
  { year: 1883, stockReturn: -0.0740, bondReturn:  0.0410, inflation: -0.0300 },
  { year: 1884, stockReturn: -0.1780, bondReturn:  0.0480, inflation: -0.0100 },
  { year: 1885, stockReturn:  0.3810, bondReturn:  0.0630, inflation: -0.0300 },
  { year: 1886, stockReturn:  0.1140, bondReturn:  0.0470, inflation:  0.0200 },
  { year: 1887, stockReturn: -0.0610, bondReturn:  0.0330, inflation:  0.0100 },
  { year: 1888, stockReturn:  0.0510, bondReturn:  0.0490, inflation: -0.0100 },
  { year: 1889, stockReturn:  0.0870, bondReturn:  0.0450, inflation: -0.0100 },
  // ── 1890s ───────────────────────────────────────────────────────────────
  { year: 1890, stockReturn: -0.0440, bondReturn:  0.0380, inflation: -0.0100 },
  { year: 1891, stockReturn:  0.1820, bondReturn:  0.0500, inflation:  0.0000 },
  { year: 1892, stockReturn:  0.0900, bondReturn:  0.0420, inflation:  0.0000 },
  { year: 1893, stockReturn: -0.2270, bondReturn:  0.0400, inflation: -0.0200 },
  { year: 1894, stockReturn:  0.0000, bondReturn:  0.0540, inflation: -0.0400 },
  { year: 1895, stockReturn:  0.0340, bondReturn:  0.0410, inflation: -0.0200 },
  { year: 1896, stockReturn:  0.0940, bondReturn:  0.0430, inflation: -0.0200 },
  { year: 1897, stockReturn:  0.2140, bondReturn:  0.0400, inflation:  0.0100 },
  { year: 1898, stockReturn:  0.2240, bondReturn:  0.0420, inflation:  0.0000 },
  { year: 1899, stockReturn:  0.0430, bondReturn:  0.0350, inflation:  0.0200 },
  // ── 1900s ───────────────────────────────────────────────────────────────
  { year: 1900, stockReturn:  0.2080, bondReturn:  0.0410, inflation:  0.0100 },
  { year: 1901, stockReturn:  0.1940, bondReturn:  0.0340, inflation:  0.0200 },
  { year: 1902, stockReturn:  0.0090, bondReturn:  0.0330, inflation:  0.0300 },
  { year: 1903, stockReturn: -0.1480, bondReturn:  0.0360, inflation:  0.0100 },
  { year: 1904, stockReturn:  0.3440, bondReturn:  0.0390, inflation:  0.0000 },
  { year: 1905, stockReturn:  0.2450, bondReturn:  0.0340, inflation: -0.0100 },
  { year: 1906, stockReturn:  0.0100, bondReturn:  0.0310, inflation:  0.0400 },
  { year: 1907, stockReturn: -0.2720, bondReturn:  0.0390, inflation:  0.0400 },
  { year: 1908, stockReturn:  0.3580, bondReturn:  0.0490, inflation: -0.0200 },
  { year: 1909, stockReturn:  0.1680, bondReturn:  0.0380, inflation:  0.0100 },
  // ── 1910s ───────────────────────────────────────────────────────────────
  { year: 1910, stockReturn:  0.0090, bondReturn:  0.0400, inflation:  0.0400 },
  { year: 1911, stockReturn:  0.0610, bondReturn:  0.0380, inflation:  0.0000 },
  { year: 1912, stockReturn:  0.0940, bondReturn:  0.0370, inflation:  0.0400 },
  { year: 1913, stockReturn: -0.1300, bondReturn:  0.0340, inflation:  0.0200 },
  { year: 1914, stockReturn: -0.0680, bondReturn:  0.0340, inflation:  0.0100 },
  { year: 1915, stockReturn:  0.3780, bondReturn:  0.0430, inflation:  0.0100 },
  { year: 1916, stockReturn:  0.1010, bondReturn:  0.0310, inflation:  0.0700 },
  { year: 1917, stockReturn: -0.2990, bondReturn: -0.0160, inflation:  0.1700 },
  { year: 1918, stockReturn:  0.2330, bondReturn: -0.0050, inflation:  0.1800 },
  { year: 1919, stockReturn:  0.3010, bondReturn:  0.0320, inflation:  0.1470 },
  // ── 1920s ───────────────────────────────────────────────────────────────
  { year: 1920, stockReturn: -0.1000, bondReturn:  0.0180, inflation:  0.1540 },
  { year: 1921, stockReturn:  0.1290, bondReturn:  0.0880, inflation: -0.1050 },
  { year: 1922, stockReturn:  0.2890, bondReturn:  0.0360, inflation: -0.0610 },
  { year: 1923, stockReturn:  0.0150, bondReturn:  0.0490, inflation:  0.0180 },
  { year: 1924, stockReturn:  0.2530, bondReturn:  0.0500, inflation:  0.0000 },
  { year: 1925, stockReturn:  0.4360, bondReturn:  0.0480, inflation:  0.0230 },
  { year: 1926, stockReturn:  0.1240, bondReturn:  0.0780, inflation: -0.0110 },
  { year: 1927, stockReturn:  0.3730, bondReturn:  0.0893, inflation: -0.0170 },
  { year: 1928, stockReturn:  0.4360, bondReturn:  0.0084, inflation: -0.0130 },
  { year: 1929, stockReturn: -0.0891, bondReturn:  0.0342, inflation:  0.0000 },
  // ── 1930s ───────────────────────────────────────────────────────────────
  { year: 1930, stockReturn: -0.2526, bondReturn:  0.0466, inflation: -0.0230 },
  { year: 1931, stockReturn: -0.4386, bondReturn: -0.0256, inflation: -0.0900 },
  { year: 1932, stockReturn: -0.0886, bondReturn:  0.1684, inflation: -0.1030 },
  { year: 1933, stockReturn:  0.5399, bondReturn: -0.0007, inflation:  0.0080 },
  { year: 1934, stockReturn: -0.0119, bondReturn:  0.1002, inflation:  0.0150 },
  { year: 1935, stockReturn:  0.4767, bondReturn:  0.0497, inflation:  0.0300 },
  { year: 1936, stockReturn:  0.3392, bondReturn:  0.0752, inflation:  0.0140 },
  { year: 1937, stockReturn: -0.3503, bondReturn:  0.0015, inflation:  0.0290 },
  { year: 1938, stockReturn:  0.3112, bondReturn:  0.0575, inflation: -0.0280 },
  { year: 1939, stockReturn: -0.0041, bondReturn:  0.0597, inflation:  0.0000 },
  // ── 1940s ───────────────────────────────────────────────────────────────
  { year: 1940, stockReturn: -0.0978, bondReturn:  0.0609, inflation:  0.0070 },
  { year: 1941, stockReturn: -0.1159, bondReturn:  0.0093, inflation:  0.0500 },
  { year: 1942, stockReturn:  0.2034, bondReturn:  0.0322, inflation:  0.1080 },
  { year: 1943, stockReturn:  0.2590, bondReturn:  0.0208, inflation:  0.0610 },
  { year: 1944, stockReturn:  0.1975, bondReturn:  0.0257, inflation:  0.0170 },
  { year: 1945, stockReturn:  0.3644, bondReturn:  0.1073, inflation:  0.0230 },
  { year: 1946, stockReturn: -0.0807, bondReturn:  0.0313, inflation:  0.0830 },
  { year: 1947, stockReturn:  0.0571, bondReturn: -0.0226, inflation:  0.1440 },
  { year: 1948, stockReturn:  0.0550, bondReturn:  0.0328, inflation:  0.0800 },
  { year: 1949, stockReturn:  0.1879, bondReturn:  0.0645, inflation: -0.0110 },
  // ── 1950s ───────────────────────────────────────────────────────────────
  { year: 1950, stockReturn:  0.3171, bondReturn:  0.0006, inflation:  0.0140 },
  { year: 1951, stockReturn:  0.2402, bondReturn: -0.0394, inflation:  0.0790 },
  { year: 1952, stockReturn:  0.1837, bondReturn:  0.0163, inflation:  0.0230 },
  { year: 1953, stockReturn: -0.0099, bondReturn:  0.0363, inflation:  0.0080 },
  { year: 1954, stockReturn:  0.5262, bondReturn:  0.0719, inflation: -0.0050 },
  { year: 1955, stockReturn:  0.3156, bondReturn: -0.0130, inflation:  0.0040 },
  { year: 1956, stockReturn:  0.0656, bondReturn: -0.0558, inflation:  0.0300 },
  { year: 1957, stockReturn: -0.1078, bondReturn:  0.0745, inflation:  0.0290 },
  { year: 1958, stockReturn:  0.4336, bondReturn: -0.0621, inflation:  0.0180 },
  { year: 1959, stockReturn:  0.1196, bondReturn: -0.0239, inflation:  0.0170 },
  // ── 1960s ───────────────────────────────────────────────────────────────
  { year: 1960, stockReturn:  0.0047, bondReturn:  0.1378, inflation:  0.0140 },
  { year: 1961, stockReturn:  0.2689, bondReturn:  0.0097, inflation:  0.0080 },
  { year: 1962, stockReturn: -0.0873, bondReturn:  0.0689, inflation:  0.0130 },
  { year: 1963, stockReturn:  0.2280, bondReturn:  0.0121, inflation:  0.0170 },
  { year: 1964, stockReturn:  0.1648, bondReturn:  0.0351, inflation:  0.0120 },
  { year: 1965, stockReturn:  0.1245, bondReturn:  0.0071, inflation:  0.0190 },
  { year: 1966, stockReturn: -0.1006, bondReturn:  0.0370, inflation:  0.0350 },
  { year: 1967, stockReturn:  0.2398, bondReturn: -0.0919, inflation:  0.0300 },
  { year: 1968, stockReturn:  0.1106, bondReturn: -0.0026, inflation:  0.0470 },
  { year: 1969, stockReturn: -0.0850, bondReturn: -0.0508, inflation:  0.0620 },
  // ── 1970s ───────────────────────────────────────────────────────────────
  { year: 1970, stockReturn:  0.0401, bondReturn:  0.1210, inflation:  0.0560 },
  { year: 1971, stockReturn:  0.1431, bondReturn:  0.1321, inflation:  0.0330 },
  { year: 1972, stockReturn:  0.1898, bondReturn:  0.0568, inflation:  0.0340 },
  { year: 1973, stockReturn: -0.1466, bondReturn: -0.0111, inflation:  0.0870 },
  { year: 1974, stockReturn: -0.2647, bondReturn:  0.0435, inflation:  0.1230 },
  { year: 1975, stockReturn:  0.3720, bondReturn:  0.0919, inflation:  0.0690 },
  { year: 1976, stockReturn:  0.2393, bondReturn:  0.1675, inflation:  0.0480 },
  { year: 1977, stockReturn: -0.0718, bondReturn: -0.0067, inflation:  0.0670 },
  { year: 1978, stockReturn:  0.0656, bondReturn: -0.0116, inflation:  0.0900 },
  { year: 1979, stockReturn:  0.1844, bondReturn: -0.0122, inflation:  0.1330 },
  // ── 1980s ───────────────────────────────────────────────────────────────
  { year: 1980, stockReturn:  0.3242, bondReturn: -0.0395, inflation:  0.1250 },
  { year: 1981, stockReturn: -0.0491, bondReturn:  0.0186, inflation:  0.0890 },
  { year: 1982, stockReturn:  0.2141, bondReturn:  0.4035, inflation:  0.0380 },
  { year: 1983, stockReturn:  0.2251, bondReturn:  0.0065, inflation:  0.0320 },
  { year: 1984, stockReturn:  0.0627, bondReturn:  0.1545, inflation:  0.0430 },
  { year: 1985, stockReturn:  0.3216, bondReturn:  0.3097, inflation:  0.0356 },
  { year: 1986, stockReturn:  0.1847, bondReturn:  0.2444, inflation:  0.0186 },
  { year: 1987, stockReturn:  0.0523, bondReturn: -0.0281, inflation:  0.0342 },
  { year: 1988, stockReturn:  0.1681, bondReturn:  0.0967, inflation:  0.0410 },
  { year: 1989, stockReturn:  0.3149, bondReturn:  0.1821, inflation:  0.0482 },
  // ── 1990s ───────────────────────────────────────────────────────────────
  { year: 1990, stockReturn: -0.0310, bondReturn:  0.0618, inflation:  0.0540 },
  { year: 1991, stockReturn:  0.3047, bondReturn:  0.1930, inflation:  0.0424 },
  { year: 1992, stockReturn:  0.0762, bondReturn:  0.0940, inflation:  0.0299 },
  { year: 1993, stockReturn:  0.1008, bondReturn:  0.1821, inflation:  0.0275 },
  { year: 1994, stockReturn:  0.0132, bondReturn: -0.0791, inflation:  0.0267 },
  { year: 1995, stockReturn:  0.3758, bondReturn:  0.2348, inflation:  0.0254 },
  { year: 1996, stockReturn:  0.2296, bondReturn: -0.0092, inflation:  0.0329 },
  { year: 1997, stockReturn:  0.3336, bondReturn:  0.1158, inflation:  0.0234 },
  { year: 1998, stockReturn:  0.2858, bondReturn:  0.1486, inflation:  0.0155 },
  { year: 1999, stockReturn:  0.2104, bondReturn: -0.0825, inflation:  0.0219 },
  // ── 2000s ───────────────────────────────────────────────────────────────
  { year: 2000, stockReturn: -0.0910, bondReturn:  0.1666, inflation:  0.0340 },
  { year: 2001, stockReturn: -0.1189, bondReturn:  0.0557, inflation:  0.0283 },
  { year: 2002, stockReturn: -0.2210, bondReturn:  0.1512, inflation:  0.0159 },
  { year: 2003, stockReturn:  0.2868, bondReturn:  0.0238, inflation:  0.0227 },
  { year: 2004, stockReturn:  0.1088, bondReturn:  0.0451, inflation:  0.0268 },
  { year: 2005, stockReturn:  0.0491, bondReturn:  0.0287, inflation:  0.0339 },
  { year: 2006, stockReturn:  0.1579, bondReturn:  0.0183, inflation:  0.0324 },
  { year: 2007, stockReturn:  0.0549, bondReturn:  0.1021, inflation:  0.0285 },
  { year: 2008, stockReturn: -0.3700, bondReturn:  0.2587, inflation:  0.0038 },
  { year: 2009, stockReturn:  0.2646, bondReturn: -0.1112, inflation:  0.0272 },
  // ── 2010s ───────────────────────────────────────────────────────────────
  { year: 2010, stockReturn:  0.1506, bondReturn:  0.0846, inflation:  0.0150 },
  { year: 2011, stockReturn:  0.0211, bondReturn:  0.1641, inflation:  0.0296 },
  { year: 2012, stockReturn:  0.1600, bondReturn:  0.0297, inflation:  0.0174 },
  { year: 2013, stockReturn:  0.3239, bondReturn: -0.0910, inflation:  0.0150 },
  { year: 2014, stockReturn:  0.1369, bondReturn:  0.1075, inflation:  0.0076 },
  { year: 2015, stockReturn:  0.0138, bondReturn:  0.0127, inflation:  0.0073 },
  { year: 2016, stockReturn:  0.1196, bondReturn:  0.0069, inflation:  0.0213 },
  { year: 2017, stockReturn:  0.2183, bondReturn:  0.0280, inflation:  0.0213 },
  { year: 2018, stockReturn: -0.0438, bondReturn:  0.0001, inflation:  0.0244 },
  { year: 2019, stockReturn:  0.3149, bondReturn:  0.0925, inflation:  0.0229 },
  // ── 2020s ───────────────────────────────────────────────────────────────
  { year: 2020, stockReturn:  0.1840, bondReturn:  0.1191, inflation:  0.0123 },
  { year: 2021, stockReturn:  0.2871, bondReturn: -0.0451, inflation:  0.0700 },
  { year: 2022, stockReturn: -0.1811, bondReturn: -0.1769, inflation:  0.0800 },
  { year: 2023, stockReturn:  0.2629, bondReturn:  0.0393, inflation:  0.0310 },
  { year: 2024, stockReturn:  0.2502, bondReturn:  0.0044, inflation:  0.0280 },
];

/**
 * The earliest year a retirement cohort can start.
 * A cohort starting in `FIRST_COHORT_YEAR` uses returns data from that year forward.
 */
export const FIRST_COHORT_YEAR = HISTORICAL_RETURNS[0].year; // 1871

/**
 * The latest year a retirement cohort can start and still have at least
 * `minYears` of historical data ahead of it.
 * Workers use this to bound the cohort loop.
 */
export const lastCohortStartYear = (minYears: number): number => {
  const lastDataYear = HISTORICAL_RETURNS[HISTORICAL_RETURNS.length - 1].year;
  return lastDataYear - minYears + 1;
};

/**
 * Cash return assumption (money-market / HYSA) — not in the Shiller dataset.
 * Used for the cash sleeve of the portfolio.
 */
export const DEFAULT_CASH_RETURN = 0.035;

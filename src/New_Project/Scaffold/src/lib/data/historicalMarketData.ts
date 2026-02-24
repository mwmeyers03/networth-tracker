export interface HistoricalYear {
  year: number;
  stockReturn: number; // S&P 500 Total Return
  bondReturn: number;  // 10-Year Treasury Yield / Bond Proxy
  inflation: number;   // US CPI-U
}

export const historicalData: HistoricalYear[] = [
  { year: 2000, stockReturn: -0.0910, bondReturn: 0.0944, inflation: 0.0338 },
  { year: 2001, stockReturn: -0.1189, bondReturn: 0.0558, inflation: 0.0155 },
  { year: 2002, stockReturn: -0.2210, bondReturn: 0.1512, inflation: 0.0238 },
  { year: 2003, stockReturn: 0.2868,  bondReturn: 0.0038, inflation: 0.0188 },
  { year: 2004, stockReturn: 0.1088,  bondReturn: 0.0434, inflation: 0.0326 },
  { year: 2005, stockReturn: 0.0491,  bondReturn: 0.0280, inflation: 0.0342 },
  { year: 2006, stockReturn: 0.1579,  bondReturn: 0.0319, inflation: 0.0254 },
  { year: 2007, stockReturn: 0.0549,  bondReturn: 0.0881, inflation: 0.0408 },
  { year: 2008, stockReturn: -0.3700, bondReturn: 0.2010, inflation: 0.0009 },
  { year: 2009, stockReturn: 0.2646,  bondReturn: -0.1112,inflation: 0.0272 },
  { year: 2010, stockReturn: 0.1506,  bondReturn: 0.0587, inflation: 0.0150 },
  { year: 2011, stockReturn: 0.0211,  bondReturn: 0.1604, inflation: 0.0296 },
  { year: 2012, stockReturn: 0.1600,  bondReturn: 0.0297, inflation: 0.0174 },
  { year: 2013, stockReturn: 0.3239,  bondReturn: -0.0898,inflation: 0.0150 },
  { year: 2014, stockReturn: 0.1369,  bondReturn: 0.1075, inflation: 0.0076 },
  { year: 2015, stockReturn: 0.0138,  bondReturn: 0.0128, inflation: 0.0073 },
  { year: 2016, stockReturn: 0.1196,  bondReturn: 0.0069, inflation: 0.0207 },
  { year: 2017, stockReturn: 0.2183,  bondReturn: 0.0280, inflation: 0.0211 },
  { year: 2018, stockReturn: -0.0438, bondReturn: -0.0002,inflation: 0.0191 },
  { year: 2019, stockReturn: 0.3149,  bondReturn: 0.0964, inflation: 0.0229 },
  { year: 2020, stockReturn: 0.1840,  bondReturn: 0.1133, inflation: 0.0136 },
  { year: 2021, stockReturn: 0.2871,  bondReturn: -0.0392,inflation: 0.0704 },
  { year: 2022, stockReturn: -0.1811, bondReturn: -0.1633,inflation: 0.0645 },
  { year: 2023, stockReturn: 0.2423,  bondReturn: 0.0390, inflation: 0.0340 }
];
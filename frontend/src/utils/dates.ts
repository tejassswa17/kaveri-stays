export const getTodayString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTomorrowString = (fromDateStr?: string): string => {
  let d: Date;
  if (fromDateStr) {
    const [year, month, day] = fromDateStr.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date();
  }
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFutureDateString = (daysAhead: number, fromDateStr?: string): string => {
  let d: Date;
  if (fromDateStr) {
    const [year, month, day] = fromDateStr.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date();
  }
  d.setDate(d.getDate() + daysAhead);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getFirstDayOfYear = (year?: number): string => {
  const y = year || new Date().getFullYear();
  return `${y}-01-01`;
};

export const getLastDayOfYear = (year?: number): string => {
  const y = year || new Date().getFullYear();
  return `${y}-12-31`;
};

export const calculateNights = (checkIn: string, checkOut: string): number => {
  if (!checkIn || !checkOut) return 0;
  const [startYear, startMonth, startDay] = checkIn.split('-').map(Number);
  const [endYear, endMonth, endDay] = checkOut.split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

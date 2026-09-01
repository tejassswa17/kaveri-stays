export interface ReportRow {
  property_id: number;
  month: string; // YYYY-MM-DD (date_trunc('month'))
  value: string; // Decimal string (Occupancy %, ADR amount, or RevPAR amount)
}

export interface ReportPage {
  items: ReportRow[];
}

export type ReportType = 'occupancy' | 'adr' | 'revpar';

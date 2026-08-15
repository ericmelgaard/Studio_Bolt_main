export interface CsvTemplatePreset {
  id: string;
  name: string;
  description: string;
  expectedHeaders: string[];
  columnMappings: Array<{
    importColumn: string;
    targetField: string;
    fieldType: string;
    isTranslation: boolean;
  }>;
  matchOnUpload: boolean;
}

export const CSV_TEMPLATE_PRESETS: CsvTemplatePreset[] = [
  {
    id: 'par_export',
    name: 'PAR Export CSV',
    description: 'Standard PAR POS export format with item name, price, PLU, and active status',
    expectedHeaders: ['Item/Combo', 'Price', 'PLU', 'Active'],
    columnMappings: [
      { importColumn: 'Item/Combo', targetField: 'name', fieldType: 'text', isTranslation: false },
      { importColumn: 'Price', targetField: 'price', fieldType: 'number', isTranslation: false },
      { importColumn: 'PLU', targetField: 'plu', fieldType: 'text', isTranslation: false },
      { importColumn: 'Active', targetField: 'active', fieldType: 'boolean', isTranslation: false },
    ],
    matchOnUpload: true,
  },
];

export function matchCsvTemplate(headers: string[]): CsvTemplatePreset | null {
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  for (const preset of CSV_TEMPLATE_PRESETS) {
    if (!preset.matchOnUpload) continue;
    const expectedNormalized = preset.expectedHeaders.map(h => h.trim().toLowerCase());
    const allMatch = expectedNormalized.every(expected =>
      normalizedHeaders.includes(expected)
    );
    if (allMatch) return preset;
  }
  return null;
}

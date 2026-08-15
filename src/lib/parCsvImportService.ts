import { supabase } from './supabase';

export interface ParCsvRow {
  name: string;
  price: number;
  plu: string;
  active: boolean;
}

export interface ParImportResult {
  rows_processed: number;
  rows_succeeded: number;
  rows_failed: number;
  products_updated: number;
  new_products_added: number;
  error_details: Array<{ row: number; message: string; data?: string }>;
  status: 'success' | 'partial' | 'failed';
}

export interface ParImportConfig {
  configId: string;
  wandSourceId: string;
  conceptId?: number | null;
  companyId?: number | null;
  siteId?: number | null;
  uploaderEmail?: string | null;
  sourceType?: 'in_app' | 'magic_link' | 'endpoint';
  fileName: string;
}

const PAR_SOURCE_ID = '361c7668-df99-4dc6-ab9b-c169d7918cb2';

export function parseParCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => parseCsvLine(line));

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function mapHeadersToParFields(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    if (normalized === 'item/combo' || normalized === 'item name' || normalized === 'itemtitle' || normalized === 'name') {
      mapping.name = index;
    } else if (normalized === 'price') {
      mapping.price = index;
    } else if (normalized === 'plu' || normalized === 'item number' || normalized === 'externalid' || normalized === 'pos key' || normalized === 'poskey') {
      mapping.plu = index;
    } else if (normalized === 'active' || normalized === 'isactive') {
      mapping.active = index;
    } else if (normalized === 'barcode') {
      mapping.barcode = index;
    } else if (normalized === 'description') {
      mapping.description = index;
    } else if (normalized === 'category') {
      mapping.category = index;
    } else if (normalized === 'tax group' || normalized === 'taxgroup') {
      mapping.taxGroup = index;
    }
  });

  return mapping;
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES' || normalized === 'T';
}

function parsePrice(value: string): number {
  const cleaned = value.replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function importParCsv(
  csvText: string,
  config: ParImportConfig
): Promise<ParImportResult> {
  const result: ParImportResult = {
    rows_processed: 0,
    rows_succeeded: 0,
    rows_failed: 0,
    products_updated: 0,
    new_products_added: 0,
    error_details: [],
    status: 'success',
  };

  const { headers, rows } = parseParCsv(csvText);

  if (headers.length === 0 || rows.length === 0) {
    result.status = 'failed';
    result.error_details.push({ row: 0, message: 'CSV file is empty or has no data rows' });
    return result;
  }

  const fieldMap = mapHeadersToParFields(headers);

  if (fieldMap.name === undefined) {
    result.status = 'failed';
    result.error_details.push({ row: 0, message: 'Could not find item name column (expected "Item/Combo" or "Item Name")' });
    return result;
  }

  if (fieldMap.plu === undefined) {
    result.status = 'failed';
    result.error_details.push({ row: 0, message: 'Could not find PLU column (expected "PLU" or "Item Number")' });
    return result;
  }

  const wandSourceId = config.wandSourceId || PAR_SOURCE_ID;
  const now = new Date().toISOString();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    result.rows_processed++;

    try {
      const name = row[fieldMap.name] || '';
      const plu = row[fieldMap.plu] || '';
      const price = fieldMap.price !== undefined ? parsePrice(row[fieldMap.price]) : 0;
      const active = fieldMap.active !== undefined ? parseBoolean(row[fieldMap.active]) : true;

      if (!name.trim()) {
        throw new Error('Missing item name');
      }

      if (!plu.trim()) {
        throw new Error('Missing PLU');
      }

      const data: Record<string, any> = {
        price,
        isActive: active,
        plu,
        itemTitle: name,
      };

      if (fieldMap.barcode !== undefined && row[fieldMap.barcode]) {
        data.barcode = row[fieldMap.barcode];
      }
      if (fieldMap.description !== undefined && row[fieldMap.description]) {
        data.description = row[fieldMap.description];
      }
      if (fieldMap.category !== undefined && row[fieldMap.category]) {
        data.category = row[fieldMap.category];
      }
      if (fieldMap.taxGroup !== undefined && row[fieldMap.taxGroup]) {
        data.taxGroup = row[fieldMap.taxGroup];
      }

      const existing = await supabase
        .from('integration_products')
        .select('id')
        .eq('wand_source_id', wandSourceId)
        .eq('external_id', plu)
        .maybeSingle();

      if (existing.data) {
        const { error: updateError } = await supabase
          .from('integration_products')
          .update({
            name,
            data,
            last_synced_at: now,
            updated_at: now,
          })
          .eq('id', existing.data.id);

        if (updateError) throw updateError;
        result.products_updated++;
      } else {
        const { error: insertError } = await supabase
          .from('integration_products')
          .insert({
            wand_source_id: wandSourceId,
            external_id: plu,
            name,
            item_type: 'product',
            data,
            concept_id: config.conceptId || null,
            company_id: config.companyId || null,
            site_id: config.siteId || null,
            last_synced_at: now,
          });

        if (insertError) throw insertError;
        result.new_products_added++;
      }

      result.rows_succeeded++;
    } catch (error: any) {
      result.rows_failed++;
      result.error_details.push({
        row: i + 2,
        message: error.message || 'Unknown error',
        data: row.join(',').substring(0, 100),
      });
    }
  }

  result.status = result.rows_failed === 0 ? 'success' : result.rows_succeeded > 0 ? 'partial' : 'failed';

  await logParUpload(config, result);

  return result;
}

async function logParUpload(config: ParImportConfig, result: ParImportResult): Promise<void> {
  try {
    await supabase.from('integration_upload_history').insert({
      integration_config_id: config.configId,
      source_type: config.sourceType || 'in_app',
      uploader_email: config.uploaderEmail || null,
      file_name: config.fileName,
      file_type: 'csv',
      rows_processed: result.rows_processed,
      rows_succeeded: result.rows_succeeded,
      rows_failed: result.rows_failed,
      products_updated: result.products_updated,
      new_products_added: result.new_products_added,
      error_details: result.error_details,
      status: result.status,
    });
  } catch (error) {
    console.error('Failed to log upload history:', error);
  }
}

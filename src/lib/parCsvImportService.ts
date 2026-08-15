import * as XLSX from 'xlsx';
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
  products_unchanged: number;
  price_changes: number;
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

function detectDelimiter(lines: string[]): string {
  const sample = lines.find(l => l.trim()) || '';
  const tabCount = (sample.match(/\t/g) || []).length;
  const commaCount = (sample.match(/,/g) || []).length;
  const semicolonCount = (sample.match(/;/g) || []).length;

  if (tabCount >= commaCount && tabCount >= semicolonCount && tabCount > 0) return '\t';
  if (semicolonCount > commaCount && semicolonCount > 0) return ';';
  return ',';
}

export function parseParCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map(line => parseDelimitedLine(line, delimiter));

  return { headers, rows };
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
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
    } else if (char === delimiter && !inQuotes) {
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

function parseBoolean(value: string | undefined | null): boolean {
  const normalized = (value ?? '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES' || normalized === 'T';
}

function parsePrice(value: string | undefined | null): number {
  const cleaned = (value ?? '').replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function importParFile(
  file: File,
  config: ParImportConfig
): Promise<ParImportResult> {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

  if (isExcel) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        rows_processed: 0, rows_succeeded: 0, rows_failed: 0,
        products_updated: 0, new_products_added: 0, products_unchanged: 0, price_changes: 0,
        error_details: [{ row: 0, message: 'Excel file has no sheets' }],
        status: 'failed',
      };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1, raw: false });
    if (jsonRows.length < 2) {
      return {
        rows_processed: 0, rows_succeeded: 0, rows_failed: 0,
        products_updated: 0, new_products_added: 0, products_unchanged: 0, price_changes: 0,
        error_details: [{ row: 0, message: 'Excel file is empty or has no data rows' }],
        status: 'failed',
      };
    }
    const headers = (jsonRows[0] as any[]).map((h: any) => String(h || '').trim());
    const rows = jsonRows.slice(1).map(r => (r as any[]).map((c: any) => String(c ?? '')));
    return processParRows(headers, rows, config, 'xlsx');
  }

  const csvText = await file.text();
  return importParCsv(csvText, config);
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
    products_unchanged: 0,
    price_changes: 0,
    error_details: [],
    status: 'success',
  };

  const { headers, rows } = parseParCsv(csvText);
  return processParRows(headers, rows, config, 'csv');
}

async function processParRows(
  headers: string[],
  rows: string[][],
  config: ParImportConfig,
  fileType: string
): Promise<ParImportResult> {
  const result: ParImportResult = {
    rows_processed: 0,
    rows_succeeded: 0,
    rows_failed: 0,
    products_updated: 0,
    new_products_added: 0,
    products_unchanged: 0,
    price_changes: 0,
    error_details: [],
    status: 'success',
  };

  if (headers.length === 0 || rows.length === 0) {
    result.status = 'failed';
    result.error_details.push({ row: 0, message: 'File is empty or has no data rows' });
    return result;
  }

  const fieldMap = mapHeadersToParFields(headers);

  if (fieldMap.name === undefined) {
    result.status = 'failed';
    result.error_details.push({ row: 0, message: `Could not find item name column. Headers found: ${headers.join(', ')}` });
    return result;
  }

  if (fieldMap.plu === undefined) {
    result.status = 'failed';
    result.error_details.push({ row: 0, message: `Could not find PLU column. Headers found: ${headers.join(', ')}` });
    return result;
  }

  const wandSourceId = config.wandSourceId || PAR_SOURCE_ID;
  const now = new Date().toISOString();

  type ParsedRow = {
    rowIndex: number;
    name: string;
    plu: string;
    data: Record<string, any>;
  };

  const validRows: ParsedRow[] = [];

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
        continue;
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

      validRows.push({ rowIndex: i + 2, name, plu, data });
    } catch (error: any) {
      result.rows_failed++;
      result.error_details.push({
        row: i + 2,
        message: error.message || 'Unknown error',
        data: row.join(',').substring(0, 100),
      });
    }
  }

  if (validRows.length === 0) {
    result.status = 'failed';
    await logParUpload(config, result, fileType);
    return result;
  }

  const dedupedRows = new Map<string, ParsedRow>();
  for (const r of validRows) {
    dedupedRows.set(r.plu, r);
  }
  const uniqueRows = Array.from(dedupedRows.values());

  const plusToFind = uniqueRows.map(r => r.plu);
  const existingMap = new Map<string, string>();
  const existingDataById = new Map<string, { name: string; data: Record<string, any> }>();

  const CHUNK_SIZE = 200;
  for (let i = 0; i < plusToFind.length; i += CHUNK_SIZE) {
    const chunk = plusToFind.slice(i, i + CHUNK_SIZE);
    const { data: existing, error: fetchError } = await supabase
      .from('integration_products')
      .select('id, external_id, name, data')
      .eq('wand_source_id', wandSourceId)
      .in('external_id', chunk);

    if (fetchError) {
      console.error('Error fetching existing products:', fetchError);
    } else if (existing) {
      existing.forEach((p: any) => {
        existingMap.set(String(p.external_id), p.id);
        existingDataById.set(p.id, { name: p.name, data: p.data ?? {} });
      });
    }
  }

  const toInsert: any[] = [];
  const toUpdate: { id: string; name: string; data: Record<string, any> }[] = [];

  const existingDataMap = new Map<string, { name: string; data: Record<string, any> }>();
  for (const [plu, id] of existingMap) {
    const existingProduct = existingDataById.get(id);
    if (existingProduct) {
      existingDataMap.set(plu, { name: existingProduct.name, data: existingProduct.data });
    }
  }

  for (const r of uniqueRows) {
    const existingId = existingMap.get(r.plu);
    if (existingId) {
      const existing = existingDataMap.get(r.plu);
      const oldPrice = Number(existing?.data?.price ?? 0);
      const newPrice = Number(r.data.price ?? 0);
      const oldName = existing?.name ?? '';
      const newName = r.name;
      const oldActive = existing?.data?.isActive;
      const newActive = r.data.isActive;

      const priceChanged = oldPrice !== newPrice;
      const nameChanged = oldName !== newName;
      const activeChanged = oldActive !== newActive;

      if (priceChanged) {
        result.price_changes++;
      }

      if (priceChanged || nameChanged || activeChanged) {
        toUpdate.push({ id: existingId, name: r.name, data: r.data });
      } else {
        result.products_unchanged++;
      }
    } else {
      toInsert.push({
        wand_source_id: wandSourceId,
        external_id: r.plu,
        name: r.name,
        item_type: 'product',
        data: r.data,
        concept_id: config.conceptId || null,
        company_id: config.companyId || null,
        site_id: config.siteId || null,
        last_synced_at: now,
      });
    }
  }

  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase
      .from('integration_products')
      .insert(chunk);

    if (insertError) {
      console.error('Bulk insert error:', insertError);
      result.rows_failed += chunk.length;
      result.error_details.push({ row: 0, message: `Bulk insert failed: ${insertError.message}` });
    } else {
      result.new_products_added += chunk.length;
      result.rows_succeeded += chunk.length;
    }
  }

  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    const updatePromises = chunk.map(item =>
      supabase
        .from('integration_products')
        .update({
          name: item.name,
          data: item.data,
          last_synced_at: now,
          updated_at: now,
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(updatePromises);
    const failedInChunk = results.filter(r => r.error).length;

    if (failedInChunk > 0) {
      result.rows_failed += failedInChunk;
      results.forEach((r, idx) => {
        if (r.error) {
          result.error_details.push({
            row: 0,
            message: `Update failed for product ${chunk[idx].id}: ${r.error.message}`,
          });
        }
      });
    }

    const succeededInChunk = chunk.length - failedInChunk;
    result.products_updated += succeededInChunk;
    result.rows_succeeded += succeededInChunk;
  }

  result.status = result.rows_failed === 0 ? 'success' : result.rows_succeeded > 0 ? 'partial' : 'failed';

  await logParUpload(config, result, fileType);

  return result;
}

async function logParUpload(config: ParImportConfig, result: ParImportResult, fileType: string): Promise<void> {
  try {
    await supabase.from('integration_upload_history').insert({
      integration_config_id: config.configId,
      source_type: config.sourceType || 'in_app',
      uploader_email: config.uploaderEmail || null,
      file_name: config.fileName,
      file_type: fileType,
      rows_processed: result.rows_processed,
      rows_succeeded: result.rows_succeeded,
      rows_failed: result.rows_failed,
      products_updated: result.products_updated,
      new_products_added: result.new_products_added,
      products_unchanged: result.products_unchanged,
      price_changes: result.price_changes,
      error_details: result.error_details,
      status: result.status,
    });
  } catch (error) {
    console.error('Failed to log upload history:', error);
  }
}

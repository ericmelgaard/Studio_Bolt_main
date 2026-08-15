import { supabase } from './supabase';

interface ImportRow {
  rowNumber: number;
  data: Record<string, any>;
  productId?: string;
  publicationDate?: string;
}

interface ImportConfig {
  importId: string;
  publicationMode: 'immediate' | 'scheduled' | 'per_row';
  scheduledPublishAt?: string;
  columnMappings: any[];
  translationLocales: string[];
  conceptId?: number;
  companyId?: number;
  siteId?: number;
}

interface ProcessedResult {
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}

export async function processProductImport(
  rows: ImportRow[],
  config: ImportConfig
): Promise<ProcessedResult> {
  const result: ProcessedResult = {
    success: 0,
    failed: 0,
    created: 0,
    updated: 0,
    errors: []
  };

  await supabase
    .from('product_imports')
    .update({ status: 'processing' })
    .eq('id', config.importId);

  for (const row of rows) {
    try {
      await processRow(row, config, result);
      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        row: row.rowNumber,
        error: error.message
      });

      await supabase.from('product_import_rows').insert({
        import_id: config.importId,
        row_number: row.rowNumber,
        row_data: row.data,
        status: 'failed',
        error_message: error.message
      });
    }
  }

  await supabase
    .from('product_imports')
    .update({
      status: 'completed',
      processed_rows: result.success,
      failed_rows: result.failed,
      products_created: result.created,
      products_updated: result.updated,
      completed_at: new Date().toISOString(),
      error_log: result.errors
    })
    .eq('id', config.importId);

  return result;
}

async function processRow(
  row: ImportRow,
  config: ImportConfig,
  result: ProcessedResult
) {
  const productId = row.productId || row.data.id || row.data.product_id;

  const baseAttributes: Record<string, any> = {};
  const translationData: Record<string, Record<string, any>> = {};

  config.columnMappings.forEach((mapping: any) => {
    const value = row.data[mapping.importColumn];

    if (mapping.isTranslation && mapping.translationLocale) {
      const translationKey = `translations_${mapping.translationLocale.replace('-', '_').toLowerCase()}`;

      if (!translationData[translationKey]) {
        translationData[translationKey] = {};
      }

      translationData[translationKey][mapping.targetField] = value;
    } else {
      baseAttributes[mapping.targetField] = value;
    }
  });

  const attributes = {
    ...baseAttributes,
    ...translationData
  };

  const productName = attributes.name || attributes.product_name || row.data.name || row.data.product_name;

  if (!productName) {
    throw new Error('Product name is required');
  }

  const changes = {
    name: productName,
    attributes: attributes,
    updated_at: new Date().toISOString()
  };

  let existingProduct = null;

  if (productId) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    existingProduct = data;
  }

  if (!existingProduct && attributes.plu) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('attributes->>plu', String(attributes.plu))
      .maybeSingle();

    existingProduct = data;
  }

  const publicationDate = row.publicationDate ||
    (config.publicationMode === 'scheduled' ? config.scheduledPublishAt : null);

  if (existingProduct) {
    await updateProduct(existingProduct.id, changes, publicationDate, config);
    result.updated++;
  } else {
    await createProduct(changes, publicationDate, config);
    result.created++;
  }

  await supabase.from('product_import_rows').insert({
    import_id: config.importId,
    row_number: row.rowNumber,
    product_id: productId || null,
    row_data: row.data,
    publication_date: publicationDate,
    status: 'processed',
    changes_applied: changes,
    processed_at: new Date().toISOString()
  });
}

async function updateProduct(
  productId: string,
  changes: any,
  publicationDate: string | null,
  config: ImportConfig
) {
  if (config.publicationMode === 'immediate' && !publicationDate) {
    const { data: existingProduct } = await supabase
      .from('products')
      .select('attributes')
      .eq('id', productId)
      .single();

    const mergedAttributes = {
      ...(existingProduct?.attributes || {}),
      ...changes.attributes
    };

    await supabase
      .from('products')
      .update({
        ...changes,
        attributes: mergedAttributes
      })
      .eq('id', productId);

    await supabase.from('product_publications').insert({
      product_id: productId,
      status: 'published',
      published_at: new Date().toISOString(),
      changes: { ...changes, attributes: mergedAttributes }
    });
  } else {
    const { data: existingProduct } = await supabase
      .from('products')
      .select('attributes')
      .eq('id', productId)
      .single();

    const mergedAttributes = {
      ...(existingProduct?.attributes || {}),
      ...changes.attributes
    };

    await supabase.from('product_publications').insert({
      product_id: productId,
      status: 'scheduled',
      publish_at: publicationDate,
      changes: { ...changes, attributes: mergedAttributes }
    });
  }
}

async function createProduct(
  changes: any,
  publicationDate: string | null,
  config: ImportConfig
) {
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('default_product_attribute_template_id')
    .limit(1)
    .maybeSingle();

  const productData = {
    name: changes.name,
    attributes: changes.attributes,
    attribute_template_id: settings?.default_product_attribute_template_id || null
  };

  if (config.publicationMode === 'immediate' && !publicationDate) {
    const { data: newProduct } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (newProduct) {
      await supabase.from('product_publications').insert({
        product_id: newProduct.id,
        status: 'published',
        published_at: new Date().toISOString(),
        changes: changes
      });
    }
  } else {
    const { data: newProduct } = await supabase
      .from('products')
      .insert({
        ...productData,
        attributes: {}
      })
      .select()
      .single();

    if (newProduct) {
      await supabase.from('product_publications').insert({
        product_id: newProduct.id,
        status: 'scheduled',
        publish_at: publicationDate,
        changes: changes
      });
    }
  }
}

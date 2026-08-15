import { useState, useEffect } from 'react';
import { X, Upload, AlertCircle, Check, Calendar, Clock, FileText, ChevronDown, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { processProductImport } from '../lib/productImportService';
import { CSV_TEMPLATE_PRESETS, matchCsvTemplate, type CsvTemplatePreset } from '../lib/csvTemplates';

interface ProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  conceptId?: number;
  companyId?: number;
  siteId?: number;
}

interface ImportPreviewRow {
  rowNumber: number;
  data: Record<string, any>;
  status: 'valid' | 'warning' | 'error';
  messages: string[];
  productId?: string;
  publicationDate?: string;
}

interface ColumnMapping {
  importColumn: string;
  targetField: string;
  fieldType: string;
  isTranslation: boolean;
  translationLocale?: string;
}

export default function ProductImportModal({
  isOpen,
  onClose,
  onSuccess,
  conceptId,
  companyId,
  siteId
}: ProductImportModalProps) {
  const [importName, setImportName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [publicationMode, setPublicationMode] = useState<'immediate' | 'scheduled' | 'per_row'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [detectedTranslations, setDetectedTranslations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'configure'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [detectedTemplate, setDetectedTemplate] = useState<CsvTemplatePreset | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('auto');

  useEffect(() => {
    if (isOpen) {
      setImportName(`Product Import ${new Date().toLocaleDateString()}`);
      setFile(null);
      setStep('upload');
      setPreviewRows([]);
      setColumnMappings([]);
    }
  }, [isOpen]);

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(selectedFile: File) {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
      setFileFormat('csv');
    } else if (extension === 'xlsx' || extension === 'xls') {
      setFileFormat('excel');
    } else if (extension === 'json') {
      setFileFormat('json');
    } else {
      alert('Unsupported file format. Please upload CSV, Excel, or JSON files.');
      return;
    }

    setFile(selectedFile);
    setDetectedTemplate(null);
  }

  async function parseAndPreviewFile() {
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();

      if (fileFormat === 'csv') {
        parseCSV(text);
      } else if (fileFormat === 'json') {
        parseJSON(text);
      } else {
        alert('Excel parsing not yet implemented. Please use CSV for now.');
        return;
      }

      setStep('preview');
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please check the file format.');
    } finally {
      setLoading(false);
    }
  }

  function parseCSV(text: string) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('File must contain at least a header row and one data row.');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const detectedTranslationLocales = new Set<string>();
    const mappings: ColumnMapping[] = [];

    headers.forEach(header => {
      const translationMatch = header.match(/^(.+)_(fr[-_]FR|es[-_]ES|de[-_]DE|it[-_]IT|pt[-_]PT)$/i);

      if (translationMatch) {
        const fieldName = translationMatch[1];
        const locale = translationMatch[2].replace('_', '-');
        detectedTranslationLocales.add(locale);

        mappings.push({
          importColumn: header,
          targetField: fieldName,
          fieldType: 'text',
          isTranslation: true,
          translationLocale: locale
        });
      } else {
        mappings.push({
          importColumn: header,
          targetField: header.toLowerCase().replace(/\s+/g, '_'),
          fieldType: inferFieldType(header),
          isTranslation: false
        });
      }
    });

    if (template) {
      mappings = template.columnMappings.map(m => ({
        importColumn: m.importColumn,
        targetField: m.targetField,
        fieldType: m.fieldType,
        isTranslation: m.isTranslation,
      }));
    }

    setDetectedTranslations(Array.from(detectedTranslationLocales));
    setColumnMappings(mappings);

    const previewData: ImportPreviewRow[] = [];
    const dataLines = lines.slice(1, Math.min(11, lines.length));

    dataLines.forEach((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const rowData: Record<string, any> = {};

      headers.forEach((header, i) => {
        rowData[header] = values[i] || '';
      });

      const validation = validateRow(rowData, mappings);

      previewData.push({
        rowNumber: index + 2,
        data: rowData,
        status: validation.status,
        messages: validation.messages,
        productId: rowData.id || rowData.product_id,
        publicationDate: rowData.publication_date || rowData.publish_at
      });
    });

    setPreviewRows(previewData);
  }

  function parseJSON(text: string) {
    try {
      const data = JSON.parse(text);
      const array = Array.isArray(data) ? data : [data];

      if (array.length === 0) {
        alert('JSON file is empty.');
        return;
      }

      const firstItem = array[0];
      const headers = Object.keys(firstItem);
      const detectedTranslationLocales = new Set<string>();
      const mappings: ColumnMapping[] = [];

      headers.forEach(header => {
        const translationMatch = header.match(/^(.+)_(fr[-_]FR|es[-_]ES|de[-_]DE|it[-_]IT|pt[-_]PT)$/i);

        if (translationMatch) {
          const fieldName = translationMatch[1];
          const locale = translationMatch[2].replace('_', '-');
          detectedTranslationLocales.add(locale);

          mappings.push({
            importColumn: header,
            targetField: fieldName,
            fieldType: typeof firstItem[header],
            isTranslation: true,
            translationLocale: locale
          });
        } else {
          mappings.push({
            importColumn: header,
            targetField: header,
            fieldType: typeof firstItem[header],
            isTranslation: false
          });
        }
      });

      setDetectedTranslations(Array.from(detectedTranslationLocales));
      setColumnMappings(mappings);

      const previewData: ImportPreviewRow[] = array.slice(0, 10).map((item, index) => {
        const validation = validateRow(item, mappings);

        return {
          rowNumber: index + 1,
          data: item,
          status: validation.status,
          messages: validation.messages,
          productId: item.id || item.product_id,
          publicationDate: item.publication_date || item.publish_at
        };
      });

      setPreviewRows(previewData);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      alert('Invalid JSON format.');
    }
  }

  function inferFieldType(columnName: string): string {
    const name = columnName.toLowerCase();
    if (name.includes('price') || name.includes('calorie') || name.includes('cost')) {
      return 'number';
    }
    if (name.includes('date') || name.includes('time')) {
      return 'date';
    }
    if (name.includes('active') || name.includes('enabled') || name.includes('is_')) {
      return 'boolean';
    }
    if (name.includes('image') || name.includes('photo') || name.includes('url')) {
      return 'image';
    }
    return 'text';
  }

  function validateRow(rowData: Record<string, any>, mappings: ColumnMapping[]): {
    status: 'valid' | 'warning' | 'error';
    messages: string[];
  } {
    const messages: string[] = [];
    let hasError = false;
    let hasWarning = false;

    if (!rowData.name && !rowData.product_name) {
      messages.push('Missing product name');
      hasError = true;
    }

    if (!rowData.id && !rowData.product_id) {
      messages.push('No product ID - will create new product');
      hasWarning = true;
    }

    if (rowData.publication_date || rowData.publish_at) {
      const dateValue = rowData.publication_date || rowData.publish_at;
      const parsedDate = new Date(dateValue);
      if (isNaN(parsedDate.getTime())) {
        messages.push('Invalid publication date format');
        hasWarning = true;
      }
    }

    if (hasError) {
      return { status: 'error', messages };
    }
    if (hasWarning) {
      return { status: 'warning', messages };
    }
    return { status: 'valid', messages: ['Ready to import'] };
  }

  async function handleImport() {
    if (!importName.trim()) {
      alert('Please enter an import name');
      return;
    }

    if (publicationMode === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      alert('Please select a publication date and time');
      return;
    }

    setImporting(true);
    try {
      const scheduledPublishAt = publicationMode === 'scheduled'
        ? `${scheduledDate}T${scheduledTime}:00`
        : null;

      const importConfig = {
        import_name: importName,
        file_format: fileFormat,
        concept_id: conceptId,
        company_id: companyId,
        site_id: siteId,
        publication_mode: publicationMode,
        scheduled_publish_at: scheduledPublishAt,
        translation_locales: detectedTranslations,
        total_rows: previewRows.length,
        column_mapping: { mappings: columnMappings },
        status: 'pending',
        metadata: {
          file_name: file?.name,
          file_size: file?.size
        }
      };

      const { data: importRecord, error: importError } = await supabase
        .from('product_imports')
        .insert(importConfig)
        .select()
        .single();

      if (importError) throw importError;

      const importRows = previewRows.map(row => ({
        rowNumber: row.rowNumber,
        data: row.data,
        productId: row.productId,
        publicationDate: row.publicationDate
      }));

      const result = await processProductImport(importRows, {
        importId: importRecord.id,
        publicationMode,
        scheduledPublishAt,
        columnMappings,
        translationLocales: detectedTranslations,
        conceptId,
        companyId,
        siteId
      });

      const message = `Import completed!\n${result.success} successful, ${result.failed} failed\n${result.created} created, ${result.updated} updated`;
      alert(message);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error importing products:', error);
      alert('Failed to import products. Please try again.');
    } finally {
      setImporting(false);
    }
  }


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative z-[201]">
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Import Products</h2>
              <p className="text-sm text-green-100">
                {step === 'upload' && 'Upload your product file'}
                {step === 'preview' && 'Review and configure import'}
                {step === 'configure' && 'Configure publication settings'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Import Name
                </label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Enter import name..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  CSV Template
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
                >
                  <option value="auto">Auto-detect</option>
                  {CSV_TEMPLATE_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                  ))}
                </select>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-300 hover:border-green-400'
                }`}
              >
                <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-slate-900 mb-2">
                  {file ? file.name : 'Drop your file here or click to browse'}
                </p>
                <p className="text-sm text-slate-600 mb-4">
                  Supported formats: CSV, Excel (.xlsx, .xls), JSON
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium cursor-pointer transition-colors"
                >
                  Choose File
                </label>
              </div>

              {file && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">File selected</p>
                    <p className="text-xs text-green-700 mt-1">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                </div>
              )}

              {detectedTemplate && step === 'preview' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{detectedTemplate.name} template detected</p>
                    <p className="text-xs text-blue-700 mt-0.5">{detectedTemplate.description}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Link className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Synced Attribute Protection</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Products with attributes synced to API sources cannot be updated via import.
                      Synced fields will be skipped and a notification will be shown after import.
                    </p>
                  </div>
                </div>
              </div>
              {detectedTranslations.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Translation columns detected</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Found translations for: {detectedTranslations.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-3">Import Preview (first 10 rows)</h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Product ID</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Messages</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {previewRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-slate-600">{row.rowNumber}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                row.status === 'valid' ? 'bg-green-100 text-green-700' :
                                row.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {row.status === 'valid' && <Check className="w-3 h-3" />}
                                {row.status === 'warning' && <AlertCircle className="w-3 h-3" />}
                                {row.status === 'error' && <X className="w-3 h-3" />}
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-700">{row.productId || '-'}</td>
                            <td className="px-3 py-2 text-slate-900 font-medium">{row.data.name || row.data.product_name || '-'}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{row.messages.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-900">Publication Settings</h3>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
                    <input
                      type="radio"
                      name="publicationMode"
                      value="immediate"
                      checked={publicationMode === 'immediate'}
                      onChange={(e) => setPublicationMode(e.target.value as any)}
                      className="w-4 h-4 text-green-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-slate-900">Publish Immediately</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">Apply all changes right away</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
                    <input
                      type="radio"
                      name="publicationMode"
                      value="scheduled"
                      checked={publicationMode === 'scheduled'}
                      onChange={(e) => setPublicationMode(e.target.value as any)}
                      className="w-4 h-4 text-green-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-slate-900">Schedule for Later</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">Set a specific date and time for publication</p>
                    </div>
                  </label>

                  {publicationMode === 'scheduled' && (
                    <div className="ml-7 grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Time</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-green-400 transition-colors">
                    <input
                      type="radio"
                      name="publicationMode"
                      value="per_row"
                      checked={publicationMode === 'per_row'}
                      onChange={(e) => setPublicationMode(e.target.value as any)}
                      className="w-4 h-4 text-green-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-slate-900">Use Per-Row Dates</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">Each row has its own publication date</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-900 mb-2">Import Summary</p>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• {previewRows.length} rows will be processed</li>
                  <li>• {previewRows.filter(r => r.status === 'valid').length} valid, {previewRows.filter(r => r.status === 'warning').length} warnings, {previewRows.filter(r => r.status === 'error').length} errors</li>
                  <li>• {detectedTranslations.length} translation language(s) detected</li>
                  <li>• {columnMappings.length} columns mapped</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              if (step === 'preview') {
                setStep('upload');
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
          >
            {step === 'preview' ? 'Back' : 'Cancel'}
          </button>

          {step === 'upload' && (
            <button
              onClick={parseAndPreviewFile}
              disabled={!file || loading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Continue'}
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={handleImport}
              disabled={importing || previewRows.filter(r => r.status === 'error').length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing...' : 'Start Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, FileJson, X, CheckCircle, AlertCircle, Package, Loader, DollarSign, ChevronDown, ChevronRight, Plus, TrendingDown, ArrowRight } from 'lucide-react';
import { IntegrationMagicLinkService, SimulatedUploadResult } from '../lib/integrationMagicLinkService';
import { importParFile, type ParImportResult, type PriceChangeDetail, type NewProductDetail, type RemovedProductDetail } from '../lib/parCsvImportService';

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  configId: string;
  configName: string;
  uploaderEmail?: string | null;
  sourceType?: 'in_app' | 'magic_link' | 'endpoint';
}

export default function DataUploadModal({
  isOpen,
  onClose,
  configId,
  configName,
  uploaderEmail = null,
  sourceType = 'in_app',
}: DataUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SimulatedUploadResult | ParImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      const validTypes = ['.csv', '.json', '.xlsx', '.xls'];
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (validTypes.includes(ext) || selectedFile.type.includes('csv') || selectedFile.type.includes('json') || selectedFile.type.includes('spreadsheet')) {
        setFile(selectedFile);
        setResult(null);
      } else {
        setFile(selectedFile);
        setResult(null);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const importResult = await importParFile(file, {
        configId,
        wandSourceId: '361c7668-df99-4dc6-ab9b-c169d7918cb2',
        uploaderEmail,
        sourceType,
        fileName: file.name,
      });

      setResult(importResult);
    } catch (error: any) {
      setResult({
        rows_processed: 0,
        rows_succeeded: 0,
        rows_failed: 0,
        products_updated: 0,
        new_products_added: 0,
        products_unchanged: 0,
        price_changes: 0,
        removed_products: 0,
        price_change_details: [],
        new_product_details: [],
        removed_product_details: [],
        error_details: [{ row: 0, message: error.message || 'Failed to process file' }],
        status: 'failed',
      } as ParImportResult);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setUploading(false);
    onClose();
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.toLowerCase().endsWith('.json')) return FileJson;
    return FileSpreadsheet;
  };

  const FileIcon = file ? getFileIcon(file.name) : FileSpreadsheet;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Upload Data</h2>
            <p className="text-sm text-slate-500 mt-0.5">{configName}</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {!result && (
            <>
              {/* Upload Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : file
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.json,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <FileIcon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-slate-900">{file.name}</div>
                      <div className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="ml-2 p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-4">
                      <UploadCloud className="w-10 h-10 text-blue-600" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 mb-1">Drop your file here or click to browse</p>
                    <p className="text-sm text-slate-500">Supports CSV, JSON, and Excel files</p>
                  </>
                )}
              </div>

              {/* Info Box */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Upload your data file to update product information. The system will process each row and report the results.
                  Supported formats: CSV export from your POS system, JSON data files, or Excel spreadsheets.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Upload & Process
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Results */}
          {result && (
            <div>
              <div className={`p-6 rounded-xl border-2 mb-5 ${
                result.status === 'success' ? 'border-green-200 bg-green-50' :
                result.status === 'partial' ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {result.status === 'success' ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : result.status === 'partial' ? (
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {result.status === 'success' ? 'Upload Complete' : result.status === 'partial' ? 'Upload Completed with Errors' : 'Upload Failed'}
                    </h3>
                    <p className="text-sm text-slate-600">{file?.name}</p>
                  </div>
                </div>

                {/* Primary Stats - only what matters */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-4 border border-slate-200 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-medium text-slate-500">Price Changes</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-600 mt-auto">{result.price_changes ?? 0}</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-500">New Products</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 mt-auto">{result.new_products_added}</div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-slate-200 flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-medium text-slate-500">Removed</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600 mt-auto">{result.removed_products ?? 0}</div>
                  </div>
                </div>

                {/* No changes message */}
                {(result.price_changes ?? 0) === 0 && (result.new_products_added ?? 0) === 0 && (result.removed_products ?? 0) === 0 && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                    <span>No changes detected — all {result.rows_processed} products match existing data.</span>
                  </div>
                )}

                {/* Row Summary */}
                {result.rows_failed > 0 && (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="text-red-700 font-medium">{result.rows_failed} failed</span>
                  </div>
                )}
              </div>

              {/* Expandable Price Changes */}
              {(result as ParImportResult).price_change_details?.length > 0 && (
                <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'price' ? null : 'price')}
                    className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSection === 'price' ? <ChevronDown className="w-4 h-4 text-amber-700" /> : <ChevronRight className="w-4 h-4 text-amber-700" />}
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-slate-900">Price Changes</span>
                      <span className="text-sm text-amber-700">({result.price_changes})</span>
                    </div>
                  </button>
                  {expandedSection === 'price' && (
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {(result as ParImportResult).price_change_details.map((item: PriceChangeDetail, idx: number) => {
                        const diff = item.newPrice - item.oldPrice;
                        const isIncrease = diff > 0;
                        return (
                          <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-white">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
                              <span className="text-xs text-slate-400 ml-2">PLU {item.plu}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm text-slate-500">${item.oldPrice.toFixed(2)}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="text-sm font-semibold text-slate-900">${item.newPrice.toFixed(2)}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${isIncrease ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isIncrease ? '+' : ''}{diff.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Expandable New Products */}
              {(result as ParImportResult).new_product_details?.length > 0 && (
                <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'new' ? null : 'new')}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSection === 'new' ? <ChevronDown className="w-4 h-4 text-blue-700" /> : <ChevronRight className="w-4 h-4 text-blue-700" />}
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-slate-900">New Products</span>
                      <span className="text-sm text-blue-700">({result.new_products_added})</span>
                    </div>
                  </button>
                  {expandedSection === 'new' && (
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {(result as ParImportResult).new_product_details.map((item: NewProductDetail, idx: number) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-white">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
                            <span className="text-xs text-slate-400 ml-2">PLU {item.plu}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900 flex-shrink-0">${item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Expandable Removed Products */}
              {(result as ParImportResult).removed_product_details?.length > 0 && (
                <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === 'removed' ? null : 'removed')}
                    className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSection === 'removed' ? <ChevronDown className="w-4 h-4 text-red-700" /> : <ChevronRight className="w-4 h-4 text-red-700" />}
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-slate-900">Removed Products</span>
                      <span className="text-sm text-red-700">({result.removed_products})</span>
                    </div>
                  </button>
                  {expandedSection === 'removed' && (
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {(result as ParImportResult).removed_product_details.map((item: RemovedProductDetail, idx: number) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-2.5 bg-white">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-slate-900 truncate">{item.name}</span>
                            <span className="text-xs text-slate-400 ml-2">PLU {item.plu}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-500 flex-shrink-0">${item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Error Details */}
              {result.error_details.length > 0 && (
                <div className="mb-5">
                  <h4 className="font-semibold text-slate-900 mb-3">Error Details</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {result.error_details.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="text-sm font-medium text-red-900">Row {err.row}:</span>
                          <span className="text-sm text-red-700 ml-1">{err.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setFile(null); setResult(null); setExpandedSection(null); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Upload Another
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataUploadModal
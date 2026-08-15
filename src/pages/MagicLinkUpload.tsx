import { useState, useEffect } from 'react';
import { Link2, Mail, KeyRound, UploadCloud, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader, Plus, ArrowRight, ShieldCheck, FileJson, DollarSign, ChevronDown, ChevronRight, TrendingDown } from 'lucide-react';
import { IntegrationMagicLinkService } from '../lib/integrationMagicLinkService';
import { supabase } from '../lib/supabase';
import { importParFile, type ParImportResult, type PriceChangeDetail, type NewProductDetail, type RemovedProductDetail } from '../lib/parCsvImportService';

interface MagicLinkUploadProps {
  token: string;
}

export default function MagicLinkUpload({ token }: MagicLinkUploadProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configName, setConfigName] = useState('');
  const [integrationType, setIntegrationType] = useState('');
  const [linkId, setLinkId] = useState('');
  const [configId, setConfigId] = useState('');

  // Auth flow
  const [step, setStep] = useState<'email' | 'code' | 'upload'>('email');
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [authorizedEmailId, setAuthorizedEmailId] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Upload flow
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ParImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    loadLinkInfo();
  }, [token]);

  const loadLinkInfo = async () => {
    setLoading(true);
    const info = await IntegrationMagicLinkService.getMagicLinkByToken(token);
    if (!info) {
      setError('Invalid or expired magic link. Please contact your WAND Digital representative for a new link.');
      setLoading(false);
      return;
    }
    if (!info.link.is_active) {
      setError('This magic link has been suspended. Please contact your WAND Digital representative.');
      setLoading(false);
      return;
    }
    setConfigName(info.configName);
    setIntegrationType(info.integrationType);
    setLinkId(info.link.id);
    setConfigId(info.link.integration_config_id);
    setLoading(false);
  };

  const handleSendCode = async () => {
    setAuthError('');
    setSendingCode(true);

    const authEmail = await IntegrationMagicLinkService.getAuthorizedEmailByLinkAndEmail(linkId, emailInput);
    if (!authEmail) {
      setAuthError('This email address is not authorized for this upload link. Please contact your WAND Digital representative.');
      setSendingCode(false);
      return;
    }

    if (!authEmail.is_active) {
      setAuthError('This email address has been suspended. Please contact your WAND Digital representative.');
      setSendingCode(false);
      return;
    }

    const result = await IntegrationMagicLinkService.sendVerificationCode(authEmail.id);
    if (!result.success) {
      setAuthError('Failed to send verification code. Please try again.');
      setSendingCode(false);
      return;
    }

    setSentCode(result.code || '');
    setAuthorizedEmailId(authEmail.id);
    setStep('code');
    setSendingCode(false);
  };

  const handleVerifyCode = async () => {
    setAuthError('');
    setVerifying(true);

    const valid = await IntegrationMagicLinkService.verifyCode(authorizedEmailId, codeInput);
    if (!valid) {
      setAuthError('Invalid or expired verification code. Please try again.');
      setVerifying(false);
      return;
    }

    await IntegrationMagicLinkService.updateEmailLastUsed(authorizedEmailId);
    setStep('upload');
    setVerifying(false);
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
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
        uploaderEmail: emailInput,
        sourceType: 'magic_link',
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
      });
    } finally {
      setUploading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="p-4 bg-red-50 rounded-full w-fit mx-auto mb-4">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Link Unavailable</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  const FileIcon = file?.name.toLowerCase().endsWith('.json') ? FileJson : FileSpreadsheet;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{configName}</h1>
            <p className="text-xs text-slate-500">Data Upload Portal</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full">
          {/* Step indicator */}
          {step !== 'upload' && !result && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`flex items-center gap-2 ${step === 'email' ? 'text-blue-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'email' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                  1
                </div>
                <span className="text-sm font-medium">Email</span>
              </div>
              <div className="w-12 h-0.5 bg-slate-200" />
              <div className={`flex items-center gap-2 ${step === 'code' ? 'text-blue-600' : 'text-slate-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'code' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                  2
                </div>
                <span className="text-sm font-medium">Verify</span>
              </div>
              <div className="w-12 h-0.5 bg-slate-200" />
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-slate-200">
                  3
                </div>
                <span className="text-sm font-medium">Upload</span>
              </div>
            </div>
          )}

          {/* Email Step */}
          {step === 'email' && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              <div className="text-center mb-6">
                <div className="p-3 bg-blue-50 rounded-full w-fit mx-auto mb-4">
                  <Mail className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Enter Your Email</h2>
                <p className="text-sm text-slate-600">
                  Your email must be authorized by WAND Digital to use this upload link.
                  A verification code will be sent to your email.
                </p>
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{authError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                    placeholder="your.email@company.com"
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSendCode}
                  disabled={!emailInput.trim() || sendingCode}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {sendingCode ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Sending Code...
                    </>
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Code Step */}
          {step === 'code' && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              <div className="text-center mb-6">
                <div className="p-3 bg-green-50 rounded-full w-fit mx-auto mb-4">
                  <KeyRound className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Enter Verification Code</h2>
                <p className="text-sm text-slate-600">
                  A 6-digit code was sent to <span className="font-medium text-slate-900">{emailInput}</span>
                </p>
                {sentCode && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      Demo mode: Your code is <span className="font-bold font-mono text-blue-900">{sentCode}</span>
                    </p>
                  </div>
                )}
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{authError}</p>
                </div>
              )}

              <div className="space-y-4">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').substring(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                  autoFocus
                  maxLength={6}
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={codeInput.length !== 6 || verifying}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Verify & Continue
                    </>
                  )}
                </button>
                <button
                  onClick={() => { setStep('email'); setCodeInput(''); setAuthError(''); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}

          {/* Upload Step (no result yet) */}
          {step === 'upload' && !result && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Verified</h2>
                  <p className="text-sm text-slate-500">{emailInput}</p>
                </div>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && document.getElementById('magic-link-file-input')?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                  dragActive ? 'border-blue-500 bg-blue-50' : file ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <input
                  id="magic-link-file-input"
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
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="ml-2 p-1.5 hover:bg-slate-200 rounded-lg">
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-4">
                      <UploadCloud className="w-10 h-10 text-blue-600" />
                    </div>
                    <p className="text-lg font-medium text-slate-700 mb-1">Drop your file here or click to browse</p>
                    <p className="text-sm text-slate-500">CSV, JSON, or Excel files from your POS export</p>
                  </>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-5 h-5" />
                      Upload & Process
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              <div className={`p-6 rounded-xl border-2 mb-5 ${
                result.status === 'success' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {result.status === 'success' ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {result.status === 'success' ? 'Upload Complete' : 'Upload Completed with Errors'}
                    </h3>
                    <p className="text-sm text-slate-600">{file?.name}</p>
                  </div>
                </div>

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

                {(result.price_changes ?? 0) === 0 && (result.new_products_added ?? 0) === 0 && (result.removed_products ?? 0) === 0 && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                    <span>No changes detected — all {result.rows_processed} products match existing data.</span>
                  </div>
                )}

                {result.rows_failed > 0 && (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <span className="text-red-700 font-medium">{result.rows_failed} failed</span>
                  </div>
                )}
              </div>

              {/* Expandable Price Changes */}
              {result.price_change_details?.length > 0 && (
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
                      {result.price_change_details.map((item: PriceChangeDetail, idx: number) => {
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
              {result.new_product_details?.length > 0 && (
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
                      {result.new_product_details.map((item: NewProductDetail, idx: number) => (
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
              {result.removed_product_details?.length > 0 && (
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
                      {result.removed_product_details.map((item: RemovedProductDetail, idx: number) => (
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

              {result.error_details.length > 0 && (
                <div className="mb-5">
                  <h4 className="font-semibold text-slate-900 mb-3">Error Details</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {result.error_details.map((err: any, idx: number) => (
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

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setFile(null); setResult(null); setExpandedSection(null); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Upload Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="text-xs text-slate-400">Powered by WAND Digital</p>
          {step === 'upload' && (
            <p className="text-xs text-slate-400">Logged in as {emailInput}</p>
          )}
        </div>
      </div>
    </div>
  );
}

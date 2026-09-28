import { useState, useEffect, useRef } from 'react';
import { Link2, Copy, Check, Mail, Plus, Trash2, Power, PowerOff, Users, Clock, ExternalLink, Key, Eye, EyeOff, RefreshCw, Server, AlertTriangle, MoreVertical, Globe, FolderUp } from 'lucide-react';
import { IntegrationMagicLinkService, MagicLink, AuthorizedEmail } from '../lib/integrationMagicLinkService';

type EndpointProtocol = 'http' | 'ftp';
type FileNaming = 'auto' | 'fixed';

interface MagicLinkManagerProps {
  configId: string;
}

export default function MagicLinkManager({ configId }: MagicLinkManagerProps) {
  const [magicLink, setMagicLink] = useState<MagicLink | null>(null);
  const [emails, setEmails] = useState<AuthorizedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Endpoint state
  const [endpointConfigured, setEndpointConfigured] = useState(false);
  const [endpointProtocol, setEndpointProtocol] = useState<EndpointProtocol>('http');
  const [endpointUrl, setEndpointUrl] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [generatingEndpoint, setGeneratingEndpoint] = useState(false);

  // FTP state
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState('21');
  const [ftpUsername, setFtpUsername] = useState('');
  const [ftpPassword, setFtpPassword] = useState('');
  const [ftpRemoteFolder, setFtpRemoteFolder] = useState('');
  const [ftpFileNaming, setFtpFileNaming] = useState<FileNaming>('auto');
  const [savingFtp, setSavingFtp] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    load();
  }, [configId]);

  const load = async () => {
    setLoading(true);
    const link = await IntegrationMagicLinkService.getMagicLink(configId);
    setMagicLink(link);
    if (link) {
      const [emailList, creds] = await Promise.all([
        IntegrationMagicLinkService.getAuthorizedEmails(link.id),
        IntegrationMagicLinkService.getEndpointCredentials(configId),
      ]);
      setEmails(emailList);
      setEndpointProtocol(creds.endpointProtocol);
      setEndpointUrl(creds.endpointUrl);
      setClientId(creds.clientId);
      setClientSecret(creds.clientSecret);
      setFtpHost(creds.ftpHost ?? '');
      setFtpPort(creds.ftpPort?.toString() ?? '21');
      setFtpUsername(creds.ftpUsername ?? '');
      setFtpPassword(creds.ftpPassword ?? '');
      setFtpRemoteFolder(creds.ftpRemoteFolder ?? '');
      setFtpFileNaming(creds.ftpFileNaming);
      const isConfigured = creds.endpointProtocol === 'ftp'
        ? !!creds.ftpHost
        : !!creds.endpointUrl;
      setEndpointConfigured(isConfigured);
    }
    setLoading(false);
  };

  const handleCreateLink = async () => {
    const link = await IntegrationMagicLinkService.createMagicLink(configId);
    if (link) {
      setMagicLink(link);
      setEmails([]);
    }
  };

  const handleToggleLink = async () => {
    if (!magicLink) return;
    const success = await IntegrationMagicLinkService.toggleMagicLink(magicLink.id, !magicLink.is_active);
    if (success) {
      setMagicLink({ ...magicLink, is_active: !magicLink.is_active });
      setConfirmingRemove(false);
      setMenuOpen(false);
    }
  };

  const handleRemoveLink = async () => {
    if (!magicLink) return;
    const success = await IntegrationMagicLinkService.removeMagicLink(magicLink.id);
    if (success) {
      setMagicLink(null);
      setEmails([]);
      setConfirmingRemove(false);
    }
  };

  const handleAddEmail = async () => {
    if (!magicLink || !newEmail.trim()) return;
    const added = await IntegrationMagicLinkService.addAuthorizedEmail(magicLink.id, newEmail);
    if (added) {
      setEmails([added, ...emails]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = async (emailId: string) => {
    const success = await IntegrationMagicLinkService.removeAuthorizedEmail(emailId);
    if (success) {
      setEmails(emails.filter(e => e.id !== emailId));
    }
  };

  const handleToggleEmail = async (emailId: string, currentActive: boolean) => {
    const success = await IntegrationMagicLinkService.toggleAuthorizedEmail(emailId, !currentActive);
    if (success) {
      setEmails(emails.map(e => e.id === emailId ? { ...e, is_active: !currentActive } : e));
    }
  };

  const handleCopyLink = () => {
    if (!magicLink) return;
    const url = `${window.location.origin}/upload/${magicLink.link_token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyEndpoint = () => {
    if (!endpointUrl) return;
    navigator.clipboard.writeText(endpointUrl);
    setCopiedEndpoint(true);
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  const handleGenerateEndpoint = async () => {
    setGeneratingEndpoint(true);
    const creds = await IntegrationMagicLinkService.generateEndpointCredentials(configId);
    if (creds) {
      setEndpointUrl(creds.endpointUrl);
      setClientId(creds.clientId);
      setClientSecret(creds.clientSecret);
      setEndpointConfigured(true);
    }
    setGeneratingEndpoint(false);
  };

  const handleProtocolChange = async (protocol: EndpointProtocol) => {
    setEndpointProtocol(protocol);
    await IntegrationMagicLinkService.setEndpointProtocol(configId, protocol);
  };

  const handleSaveFtp = async () => {
    if (!ftpHost.trim() || !ftpUsername.trim()) return;
    setSavingFtp(true);
    const success = await IntegrationMagicLinkService.saveFtpCredentials(configId, {
      host: ftpHost.trim(),
      port: parseInt(ftpPort) || 21,
      username: ftpUsername.trim(),
      password: ftpPassword,
      remoteFolder: ftpRemoteFolder.trim(),
      fileNaming: ftpFileNaming,
    });
    if (success) {
      setEndpointConfigured(true);
    }
    setSavingFtp(false);
  };

  const handleRemoveEndpoint = async () => {
    const success = await IntegrationMagicLinkService.removeEndpoint(configId);
    if (success) {
      setEndpointConfigured(false);
      setEndpointUrl(null);
      setClientId(null);
      setClientSecret(null);
      setEndpointProtocol('http');
      setFtpHost('');
      setFtpPort('21');
      setFtpUsername('');
      setFtpPassword('');
      setFtpRemoteFolder('');
      setFtpFileNaming('auto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Magic Link Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Magic Link</h3>
            </div>
            {magicLink && (
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  magicLink.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {magicLink.is_active
                    ? <Power className="w-4 h-4" />
                    : <PowerOff className="w-4 h-4" />}
                  {magicLink.is_active ? 'Active' : 'Suspended'}
                </span>

                {confirmingRemove ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRemoveLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Confirm Removal
                    </button>
                    <button
                      onClick={() => setConfirmingRemove(false)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                      title="Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                        {magicLink.is_active ? (
                          <button
                            onClick={handleToggleLink}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <PowerOff className="w-4 h-4 text-amber-600" />
                            Suspend
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleToggleLink}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Power className="w-4 h-4 text-green-600" />
                              Activate
                            </button>
                            <button
                              onClick={() => { setConfirmingRemove(true); setMenuOpen(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-5">
          {!magicLink ? (
            <div className="text-center py-6">
              <Link2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-1">No magic link created yet</p>
              <p className="text-sm text-slate-500 mb-4">Generate a link to allow external users to upload data files</p>
              <button
                onClick={handleCreateLink}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Generate Magic Link
              </button>
            </div>
          ) : magicLink.is_active ? (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-sm text-slate-600 font-mono truncate">
                      {`${window.location.origin}/upload/${magicLink.link_token.substring(0, 12)}...`}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Share this link with authorized users. They will need to verify their email address to upload files.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-slate-500" />
                  <h4 className="text-sm font-semibold text-slate-700">Authorized Emails</h4>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                    {emails.filter(e => e.is_active).length} active
                  </span>
                </div>

                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                      placeholder="Add email address..."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={handleAddEmail}
                    disabled={!newEmail.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                {emails.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No authorized emails yet. Add emails to allow users to upload via the magic link.</p>
                ) : (
                  <div className="space-y-2">
                    {emails.map(email => (
                      <div key={email.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg ${email.is_active ? 'bg-green-100' : 'bg-slate-200'}`}>
                            <Mail className={`w-4 h-4 ${email.is_active ? 'text-green-600' : 'text-slate-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{email.email}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>Added {new Date(email.created_at).toLocaleDateString()}</span>
                              {email.last_used_at && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Last used {new Date(email.last_used_at).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleEmail(email.id, email.is_active)}
                            className={`p-1.5 rounded-lg transition-colors ${email.is_active ? 'hover:bg-green-100 text-green-600' : 'hover:bg-amber-100 text-amber-600'}`}
                            title={email.is_active ? 'Suspend' : 'Reactivate'}
                          >
                            {email.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleRemoveEmail(email.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">This magic link is suspended</p>
                <p className="text-sm text-amber-700 mt-1">
                  The upload page is inaccessible while suspended. You can reactivate the link to restore access, or remove it permanently. Removing the link also deletes all authorized emails. A new link can be generated afterward.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Automated Endpoint Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Automated Delivery</h3>
            </div>
            {endpointConfigured && (
              <button
                onClick={handleRemoveEndpoint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {!endpointConfigured ? (
            <div className="space-y-5">
              {/* Protocol selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleProtocolChange('http')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    endpointProtocol === 'http'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <Globe className={`w-7 h-7 ${endpointProtocol === 'http' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${endpointProtocol === 'http' ? 'text-blue-900' : 'text-slate-600'}`}>HTTP API</span>
                  <span className="text-xs text-slate-500 text-center">Receive files via PUT request with auth headers</span>
                </button>
                <button
                  onClick={() => handleProtocolChange('ftp')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    endpointProtocol === 'ftp'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <FolderUp className={`w-7 h-7 ${endpointProtocol === 'ftp' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${endpointProtocol === 'ftp' ? 'text-blue-900' : 'text-slate-600'}`}>FTP</span>
                  <span className="text-xs text-slate-500 text-center">Deliver files to an FTP server folder</span>
                </button>
              </div>

              {/* HTTP setup */}
              {endpointProtocol === 'http' && (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-600 mb-4">Generate a unique HTTP endpoint URL with client credentials for automated file uploads.</p>
                  <button
                    onClick={handleGenerateEndpoint}
                    disabled={generatingEndpoint}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {generatingEndpoint ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Generate HTTP Endpoint
                  </button>
                </div>
              )}

              {/* FTP setup form */}
              {endpointProtocol === 'ftp' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">FTP Host</label>
                      <input
                        type="text"
                        value={ftpHost}
                        onChange={(e) => setFtpHost(e.target.value)}
                        placeholder="ftp.example.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Port</label>
                      <input
                        type="text"
                        value={ftpPort}
                        onChange={(e) => setFtpPort(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="21"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Username</label>
                      <input
                        type="text"
                        value={ftpUsername}
                        onChange={(e) => setFtpUsername(e.target.value)}
                        placeholder="FTP username"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5">Password</label>
                      <input
                        type="password"
                        value={ftpPassword}
                        onChange={(e) => setFtpPassword(e.target.value)}
                        placeholder="FTP password"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Remote Folder (optional)</label>
                    <input
                      type="text"
                      value={ftpRemoteFolder}
                      onChange={(e) => setFtpRemoteFolder(e.target.value)}
                      placeholder="/uploads/"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Target directory where files are deposited. Leave empty for the FTP root.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">File Naming</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFtpFileNaming('auto')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          ftpFileNaming === 'auto'
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Auto (timestamped)
                      </button>
                      <button
                        onClick={() => setFtpFileNaming('fixed')}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          ftpFileNaming === 'fixed'
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Fixed name
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {ftpFileNaming === 'auto'
                        ? 'Files are named automatically with a timestamp to prevent collisions.'
                        : 'Each upload overwrites the previous file with the same name.'}
                    </p>
                  </div>

                  <button
                    onClick={handleSaveFtp}
                    disabled={!ftpHost.trim() || !ftpUsername.trim() || savingFtp}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {savingFtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Save FTP Configuration
                  </button>
                </div>
              )}
            </div>
          ) : endpointProtocol === 'http' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 font-mono truncate">{endpointUrl}</span>
                  </div>
                  <button
                    onClick={handleCopyEndpoint}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    {copiedEndpoint ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Send a PUT request with your CSV or JSON file to this URL. Include the Client ID and Secret in the request headers.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Client ID
                  </label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <code className="text-sm text-slate-700 font-mono break-all">{clientId}</code>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                    <Key className="w-3.5 h-3.5" />
                    Client Secret
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <code className="text-sm text-slate-700 font-mono break-all">
                        {showSecret ? clientSecret : '••••••••••••••••••••••••••••••'}
                      </code>
                    </div>
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <FolderUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-900">FTP Delivery Configured</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Host</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <code className="text-sm text-slate-700 font-mono">{ftpHost}:{ftpPort}</code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Username</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <code className="text-sm text-slate-700 font-mono">{ftpUsername}</code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Remote Folder</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <code className="text-sm text-slate-700 font-mono">{ftpRemoteFolder || '/'}</code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">File Naming</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-sm text-slate-700">{ftpFileNaming === 'auto' ? 'Auto (timestamped)' : 'Fixed name'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEndpointConfigured(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                >
                  Edit Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

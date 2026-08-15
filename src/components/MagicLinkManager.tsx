import { useState, useEffect } from 'react';
import { Link2, Copy, Check, Mail, Plus, Trash2, Power, PowerOff, Users, Clock, ExternalLink, Key, Eye, EyeOff, RefreshCw, Server } from 'lucide-react';
import { IntegrationMagicLinkService, MagicLink, AuthorizedEmail } from '../lib/integrationMagicLinkService';

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
  const [endpointUrl, setEndpointUrl] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [generatingEndpoint, setGeneratingEndpoint] = useState(false);

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
      setEndpointUrl(creds.endpointUrl);
      setClientId(creds.clientId);
      setClientSecret(creds.clientSecret);
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
    }
    setGeneratingEndpoint(false);
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
              <button
                onClick={handleToggleLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  magicLink.is_active
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {magicLink.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                {magicLink.is_active ? 'Active' : 'Suspended'}
              </button>
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
          ) : (
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
          )}
        </div>
      </div>

      {/* Authorized Emails Section */}
      {magicLink && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Authorized Emails</h3>
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {emails.filter(e => e.is_active).length} active
              </span>
            </div>
          </div>

          <div className="p-5">
            {/* Add Email */}
            <div className="flex gap-2 mb-4">
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

            {/* Email List */}
            {emails.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No authorized emails yet. Add emails to allow users to upload via the magic link.</p>
            ) : (
              <div className="space-y-2">
                {emails.map(email => (
                  <div key={email.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
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
      )}

      {/* Endpoint Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Automated Endpoint</h3>
            </div>
            {!endpointUrl && (
              <button
                onClick={handleGenerateEndpoint}
                disabled={generatingEndpoint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {generatingEndpoint ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate Endpoint
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {!endpointUrl ? (
            <div className="text-center py-6">
              <Server className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-1">No endpoint configured</p>
              <p className="text-sm text-slate-500">Generate a per-integration endpoint for software-driven automated uploads</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

import { supabase } from './supabase';

export interface MagicLink {
  id: string;
  integration_config_id: string;
  link_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedEmail {
  id: string;
  magic_link_id: string;
  email: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface UploadHistoryEntry {
  id: string;
  integration_config_id: string;
  source_type: 'magic_link' | 'in_app' | 'endpoint';
  uploader_email: string | null;
  file_name: string;
  file_type: string;
  rows_processed: number;
  rows_succeeded: number;
  rows_failed: number;
  products_updated: number;
  new_products_added: number;
  products_unchanged?: number;
  price_changes?: number;
  error_details: any[];
  status: 'success' | 'partial' | 'failed';
  created_at: string;
}

export interface SimulatedUploadResult {
  rows_processed: number;
  rows_succeeded: number;
  rows_failed: number;
  products_updated: number;
  new_products_added: number;
  error_details: Array<{ row: number; message: string; data?: string }>;
  status: 'success' | 'partial' | 'failed';
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class IntegrationMagicLinkService {
  static async getMagicLink(configId: string): Promise<MagicLink | null> {
    const { data, error } = await supabase
      .from('integration_magic_links')
      .select('*')
      .eq('integration_config_id', configId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching magic link:', error);
      return null;
    }
    return data as MagicLink | null;
  }

  static async createMagicLink(configId: string): Promise<MagicLink | null> {
    const token = generateToken();
    const { data, error } = await supabase
      .from('integration_magic_links')
      .insert({
        integration_config_id: configId,
        link_token: token,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating magic link:', error);
      return null;
    }
    return data as MagicLink;
  }

  static async toggleMagicLink(linkId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('integration_magic_links')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', linkId);

    if (error) {
      console.error('Error toggling magic link:', error);
      return false;
    }
    return true;
  }

  static async getAuthorizedEmails(linkId: string): Promise<AuthorizedEmail[]> {
    const { data, error } = await supabase
      .from('integration_authorized_emails')
      .select('*')
      .eq('magic_link_id', linkId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching authorized emails:', error);
      return [];
    }
    return (data || []) as AuthorizedEmail[];
  }

  static async addAuthorizedEmail(linkId: string, email: string): Promise<AuthorizedEmail | null> {
    const { data, error } = await supabase
      .from('integration_authorized_emails')
      .insert({
        magic_link_id: linkId,
        email: email.toLowerCase().trim(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.error('Email already authorized for this link');
      } else {
        console.error('Error adding authorized email:', error);
      }
      return null;
    }
    return data as AuthorizedEmail;
  }

  static async toggleAuthorizedEmail(emailId: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('integration_authorized_emails')
      .update({ is_active: isActive })
      .eq('id', emailId);

    if (error) {
      console.error('Error toggling authorized email:', error);
      return false;
    }
    return true;
  }

  static async removeAuthorizedEmail(emailId: string): Promise<boolean> {
    const { error } = await supabase
      .from('integration_authorized_emails')
      .delete()
      .eq('id', emailId);

    if (error) {
      console.error('Error removing authorized email:', error);
      return false;
    }
    return true;
  }

  static async sendVerificationCode(emailId: string): Promise<{ success: boolean; code?: string; error?: string }> {
    const code = generateCode();
    const { error } = await supabase
      .from('integration_verification_codes')
      .insert({
        authorized_email_id: emailId,
        code: code,
        is_used: false,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (error) {
      console.error('Error creating verification code:', error);
      return { success: false, error: error.message };
    }

    // In a real system, this would send an email. For demo, we return the code.
    return { success: true, code };
  }

  static async verifyCode(emailId: string, code: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('integration_verification_codes')
      .select('*')
      .eq('authorized_email_id', emailId)
      .eq('code', code)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    if (new Date(data.expires_at) < new Date()) {
      return false;
    }

    await supabase
      .from('integration_verification_codes')
      .update({ is_used: true })
      .eq('id', data.id);

    return true;
  }

  static async getMagicLinkByToken(token: string): Promise<{ link: MagicLink; configName: string; integrationType: string } | null> {
    const { data, error } = await supabase
      .from('integration_magic_links')
      .select(`
        *,
        integration_source_configs (
          id,
          config_name,
          wand_integration_sources (
            name,
            integration_type
          )
        )
      `)
      .eq('link_token', token)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const config = data.integration_source_configs as any;
    return {
      link: {
        id: data.id,
        integration_config_id: data.integration_config_id,
        link_token: data.link_token,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
      configName: config?.config_name || 'Unknown',
      integrationType: config?.wand_integration_sources?.integration_type || 'unknown',
    };
  }

  static async getAuthorizedEmailByLinkAndEmail(linkId: string, email: string): Promise<AuthorizedEmail | null> {
    const { data, error } = await supabase
      .from('integration_authorized_emails')
      .select('*')
      .eq('magic_link_id', linkId)
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return data as AuthorizedEmail;
  }

  static async updateEmailLastUsed(emailId: string): Promise<void> {
    await supabase
      .from('integration_authorized_emails')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', emailId);
  }

  static async logUpload(entry: Omit<UploadHistoryEntry, 'id' | 'created_at'>): Promise<UploadHistoryEntry | null> {
    const { data, error } = await supabase
      .from('integration_upload_history')
      .insert(entry)
      .select()
      .single();

    if (error) {
      console.error('Error logging upload:', error);
      return null;
    }
    return data as UploadHistoryEntry;
  }

  static async getUploadHistory(configId: string, limit: number = 20): Promise<UploadHistoryEntry[]> {
    const { data, error } = await supabase
      .from('integration_upload_history')
      .select('*')
      .eq('integration_config_id', configId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching upload history:', error);
      return [];
    }
    return (data || []) as UploadHistoryEntry[];
  }

  static simulateUploadResult(_fileName: string, _fileType: string): SimulatedUploadResult {
    const rowsProcessed = Math.floor(Math.random() * 80) + 20;
    const rowsFailed = Math.floor(Math.random() * 4);
    const rowsSucceeded = rowsProcessed - rowsFailed;
    const productsUpdated = Math.floor(rowsSucceeded * 0.65);
    const newProductsAdded = rowsSucceeded - productsUpdated;

    const errorDetails: Array<{ row: number; message: string; data?: string }> = [];
    for (let i = 0; i < rowsFailed; i++) {
      errorDetails.push({
        row: Math.floor(Math.random() * rowsProcessed) + 1,
        message: ['Missing required field: price', 'Invalid category reference', 'Duplicate product ID', 'Empty product name'][i % 4],
        data: `Row ${Math.floor(Math.random() * rowsProcessed) + 1}`,
      });
    }

    return {
      rows_processed: rowsProcessed,
      rows_succeeded: rowsSucceeded,
      rows_failed: rowsFailed,
      products_updated: productsUpdated,
      new_products_added: newProductsAdded,
      error_details: errorDetails,
      status: rowsFailed === 0 ? 'success' : 'partial',
    };
  }

  static async generateEndpointCredentials(configId: string): Promise<{ endpointUrl: string; clientId: string; clientSecret: string } | null> {
    const clientId = 'wd_' + generateToken().substring(0, 16);
    const clientSecret = 'ws_' + generateToken().substring(0, 24);
    const endpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-upload-endpoint`;

    const { error } = await supabase
      .from('integration_source_configs')
      .update({
        endpoint_url: endpointUrl,
        client_id: clientId,
        client_secret: clientSecret,
      })
      .eq('id', configId);

    if (error) {
      console.error('Error saving endpoint credentials:', error);
      return null;
    }

    return { endpointUrl, clientId, clientSecret };
  }

  static async getEndpointCredentials(configId: string): Promise<{ endpointUrl: string | null; clientId: string | null; clientSecret: string | null }> {
    const { data, error } = await supabase
      .from('integration_source_configs')
      .select('endpoint_url, client_id, client_secret')
      .eq('id', configId)
      .maybeSingle();

    if (error || !data) {
      return { endpointUrl: null, clientId: null, clientSecret: null };
    }

    return {
      endpointUrl: data.endpoint_url,
      clientId: data.client_id,
      clientSecret: data.client_secret,
    };
  }
}

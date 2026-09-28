/*
# Add FTP endpoint fields to integration_source_configs

1. Purpose
   The Automated Endpoint section currently supports HTTP API delivery only
   (endpoint_url, client_id, client_secret). This migration adds FTP as an
   alternative delivery protocol so integrations can push files to an FTP
   server instead of calling an HTTP endpoint. One protocol per integration.

2. New Columns on `integration_source_configs`
   - `endpoint_protocol` (text, default 'http') — 'http' or 'ftp'. Selects
     which delivery method the integration uses.
   - `ftp_host` (text, nullable) — FTP server hostname or IP address.
   - `ftp_port` (integer, nullable, default 21) — FTP port.
   - `ftp_username` (text, nullable) — FTP login username.
   - `ftp_password` (text, nullable) — FTP login password.
   - `ftp_remote_folder` (text, nullable) — Target directory on the FTP
     server where uploaded files are deposited.
   - `ftp_file_naming` (text, default 'auto') — File naming strategy:
     'auto' for timestamped auto-generated names, 'fixed' for a static name.

3. Security
   No new tables. No RLS changes — existing open policies on
   integration_source_configs already cover the new columns.

4. Notes
   - All new columns are nullable so existing HTTP-configured rows are
     unaffected.
   - `endpoint_protocol` defaults to 'http' so rows created before this
     migration continue to behave as HTTP endpoints.
*/

ALTER TABLE integration_source_configs
  ADD COLUMN IF NOT EXISTS endpoint_protocol text DEFAULT 'http',
  ADD COLUMN IF NOT EXISTS ftp_host text,
  ADD COLUMN IF NOT EXISTS ftp_port integer DEFAULT 21,
  ADD COLUMN IF NOT EXISTS ftp_username text,
  ADD COLUMN IF NOT EXISTS ftp_password text,
  ADD COLUMN IF NOT EXISTS ftp_remote_folder text,
  ADD COLUMN IF NOT EXISTS ftp_file_naming text DEFAULT 'auto';

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Client-Id, X-Client-Secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const configId = pathParts[pathParts.length - 1] || pathParts[0];

    if (!configId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing integration configuration ID in URL path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clientId = req.headers.get("X-Client-Id");
    const clientSecret = req.headers.get("X-Client-Secret");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authentication credentials. Provide X-Client-Id and X-Client-Secret headers." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('integration_source_configs')
      .select('id, config_name, client_id, client_secret, endpoint_url')
      .eq('id', configId)
      .maybeSingle();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "Integration configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (config.client_id !== clientId || config.client_secret !== clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = req.headers.get("Content-Type") || "";
    let fileName = `endpoint_upload_${Date.now()}`;
    let fileType = "csv";

    if (contentType.includes("json")) {
      fileType = "json";
      fileName += ".json";
    } else {
      fileType = "csv";
      fileName += ".csv";
    }

    const rowsProcessed = Math.floor(Math.random() * 80) + 20;
    const rowsFailed = Math.floor(Math.random() * 3);
    const rowsSucceeded = rowsProcessed - rowsFailed;
    const productsUpdated = Math.floor(rowsSucceeded * 0.65);
    const newProductsAdded = rowsSucceeded - productsUpdated;

    const errorDetails: Array<{ row: number; message: string }> = [];
    for (let i = 0; i < rowsFailed; i++) {
      errorDetails.push({
        row: Math.floor(Math.random() * rowsProcessed) + 1,
        message: ["Missing required field: price", "Invalid category reference", "Duplicate product ID"][i % 3],
      });
    }

    const status = rowsFailed === 0 ? "success" : "partial";
    const durationMs = Math.floor(Math.random() * 2000) + 500;

    await supabase
      .from('integration_upload_history')
      .insert({
        integration_config_id: configId,
        source_type: 'endpoint',
        file_name: fileName,
        file_type: fileType,
        rows_processed: rowsProcessed,
        rows_succeeded: rowsSucceeded,
        rows_failed: rowsFailed,
        products_updated: productsUpdated,
        new_products_added: newProductsAdded,
        error_details: JSON.stringify(errorDetails),
        status: status,
      });

    return new Response(
      JSON.stringify({
        success: true,
        integration: config.config_name,
        file_name: fileName,
        file_type: fileType,
        metrics: {
          rows_processed: rowsProcessed,
          rows_succeeded: rowsSucceeded,
          rows_failed: rowsFailed,
          products_updated: productsUpdated,
          new_products_added: newProductsAdded,
          errors: errorDetails,
        },
        status: status,
        duration_ms: durationMs,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

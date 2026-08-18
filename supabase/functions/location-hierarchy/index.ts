import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ConceptRow {
  id: number;
  name: string;
  ccgs_key: number | null;
  icon: string | null;
  logo_url: string | null;
  description: string | null;
}

interface CompanyRow {
  id: number;
  name: string;
  concept_id: number | null;
  ccgs_key: number | null;
  description: string | null;
}

interface StoreRow {
  id: number;
  name: string;
  company_id: number | null;
  ccgs_key: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  timezone: string | null;
  operation_status: string | null;
}

function jsonError(status: number, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonError(405, "Method not allowed. Use GET.");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const level = (url.searchParams.get("level") || "full").toLowerCase();
    const conceptIdParam = url.searchParams.get("concept_id");
    const companyIdParam = url.searchParams.get("company_id");
    const search = (url.searchParams.get("search") || "").trim();
    const includeCount = url.searchParams.get("include_count") === "true";

    const conceptId = conceptIdParam ? parseInt(conceptIdParam, 10) : null;
    const companyId = companyIdParam ? parseInt(companyIdParam, 10) : null;

    if (
      (conceptId !== null && Number.isNaN(conceptId)) ||
      (companyId !== null && Number.isNaN(companyId))
    ) {
      return jsonError(400, "concept_id and company_id must be integers.");
    }

    // LEVEL: concepts — list concepts only (with optional company counts)
    if (level === "concepts") {
      let query = supabase
        .from("concepts")
        .select("id, name, ccgs_key, icon, logo_url, description")
        .order("name");

      if (search) query = query.ilike("name", `%${search}%`);

      const { data, error } = await query;
      if (error) return jsonError(500, "Failed to fetch concepts", error.message);

      let concepts: ConceptRow[] = data || [];

      if (includeCount) {
        const { data: counts, error: countErr } = await supabase
          .from("companies")
          .select("concept_id")
          .not("concept_id", "is", null);

        if (!countErr && counts) {
          const countMap = new Map<number, number>();
          for (const row of counts) {
            const cid = row.concept_id as number;
            countMap.set(cid, (countMap.get(cid) || 0) + 1);
          }
          concepts = concepts.map((c) => ({ ...c, company_count: countMap.get(c.id) || 0 } as ConceptRow & { company_count: number }));
          void countMap;
        }
      }

      return new Response(
        JSON.stringify({ level: "concepts", concepts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEVEL: companies — list companies, optionally scoped to a concept
    if (level === "companies") {
      let query = supabase
        .from("companies")
        .select("id, name, concept_id, ccgs_key, description")
        .order("name");

      if (conceptId !== null) query = query.eq("concept_id", conceptId);
      if (search) query = query.ilike("name", `%${search}%`);

      const { data, error } = await query;
      if (error) return jsonError(500, "Failed to fetch companies", error.message);

      let companies: CompanyRow[] = data || [];

      if (includeCount) {
        let storeQuery = supabase.from("stores").select("company_id").not("company_id", "is", null);
        if (conceptId !== null) {
          const { data: companyIds } = await supabase
            .from("companies")
            .select("id")
            .eq("concept_id", conceptId);
          const ids = (companyIds || []).map((c) => c.id);
          storeQuery = ids.length
            ? storeQuery.in("company_id", ids)
            : storeQuery.eq("company_id", -1);
        }
        const { data: storeCounts, error: storeCountErr } = await storeQuery;
        if (!storeCountErr && storeCounts) {
          const countMap = new Map<number, number>();
          for (const row of storeCounts) {
            const coid = row.company_id as number;
            countMap.set(coid, (countMap.get(coid) || 0) + 1);
          }
          companies = companies.map((c) => ({ ...c, store_count: countMap.get(c.id) || 0 } as CompanyRow & { store_count: number }));
        }
      }

      return new Response(
        JSON.stringify({ level: "companies", concept_id: conceptId, companies }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEVEL: stores — list stores, optionally scoped to a company or concept
    if (level === "stores") {
      let query = supabase
        .from("stores")
        .select(
          "id, name, company_id, ccgs_key, address, city, state, zip_code, timezone, operation_status"
        )
        .order("name");

      if (companyId !== null) {
        query = query.eq("company_id", companyId);
      } else if (conceptId !== null) {
        const { data: companyIds } = await supabase
          .from("companies")
          .select("id")
          .eq("concept_id", conceptId);
        const ids = (companyIds || []).map((c) => c.id);
        if (ids.length) {
          query = query.in("company_id", ids);
        } else {
          return new Response(
            JSON.stringify({ level: "stores", concept_id: conceptId, stores: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (search) query = query.ilike("name", `%${search}%`);

      const { data, error } = await query;
      if (error) return jsonError(500, "Failed to fetch stores", error.message);

      return new Response(
        JSON.stringify({
          level: "stores",
          concept_id: conceptId,
          company_id: companyId,
          stores: (data || []) as StoreRow[],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEVEL: full — nested hierarchy (concepts -> companies -> stores)
    // Only returns the full tree when no concept_id/company_id filter is set.
    if (level === "full") {
      if (conceptId !== null) {
        // Scoped full tree for a single concept: concept + companies + stores
        const { data: concept } = await supabase
          .from("concepts")
          .select("id, name, ccgs_key, icon, logo_url, description")
          .eq("id", conceptId)
          .maybeSingle();

        if (!concept) return jsonError(404, "Concept not found.");

        const { data: companies } = await supabase
          .from("companies")
          .select("id, name, concept_id, ccgs_key, description")
          .eq("concept_id", conceptId)
          .order("name");

        const companyIds = (companies || []).map((c) => c.id);
        let storesByCompany: Record<number, StoreRow[]> = {};
        if (companyIds.length) {
          const { data: stores } = await supabase
            .from("stores")
            .select(
              "id, name, company_id, ccgs_key, address, city, state, zip_code, timezone, operation_status"
            )
            .in("company_id", companyIds)
            .order("name");
          for (const s of stores || []) {
            const coid = s.company_id as number;
            if (!storesByCompany[coid]) storesByCompany[coid] = [];
            storesByCompany[coid].push(s as StoreRow);
          }
        }

        const tree = {
          ...concept,
          companies: (companies || []).map((c) => ({
            ...c,
            stores: storesByCompany[c.id] || [],
          })),
        };

        return new Response(
          JSON.stringify({ level: "full", scope: "concept", concept: tree }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Unscoped full tree — fetch everything in three queries.
      const { data: concepts, error: cErr } = await supabase
        .from("concepts")
        .select("id, name, ccgs_key, icon, logo_url, description")
        .order("name");
      if (cErr) return jsonError(500, "Failed to fetch concepts", cErr.message);

      const { data: companies, error: compErr } = await supabase
        .from("companies")
        .select("id, name, concept_id, ccgs_key, description")
        .order("name");
      if (compErr) return jsonError(500, "Failed to fetch companies", compErr.message);

      const { data: stores, error: sErr } = await supabase
        .from("stores")
        .select(
          "id, name, company_id, ccgs_key, address, city, state, zip_code, timezone, operation_status"
        )
        .order("name");
      if (sErr) return jsonError(500, "Failed to fetch stores", sErr.message);

      const storesByCompany = new Map<number, StoreRow[]>();
      for (const s of stores || []) {
        const coid = s.company_id as number;
        if (!storesByCompany.has(coid)) storesByCompany.set(coid, []);
        storesByCompany.get(coid)!.push(s as StoreRow);
      }

      const companiesByConcept = new Map<number, CompanyRow[]>();
      for (const c of companies || []) {
        const cid = c.concept_id as number;
        if (!companiesByConcept.has(cid)) companiesByConcept.set(cid, []);
        companiesByConcept.get(cid)!.push({
          ...c,
          stores: storesByCompany.get(c.id) || [],
        } as CompanyRow & { stores: StoreRow[] });
      }

      const tree = (concepts || []).map((concept) => ({
        ...concept,
        companies: companiesByConcept.get(concept.id) || [],
      }));

      return new Response(
        JSON.stringify({
          level: "full",
          scope: "all",
          concepts: tree,
          counts: {
            concepts: concepts?.length || 0,
            companies: companies?.length || 0,
            stores: stores?.length || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return jsonError(400, "Invalid 'level' parameter. Use: full | concepts | companies | stores.");
  } catch (err) {
    return jsonError(500, "Unexpected server error", err instanceof Error ? err.message : String(err));
  }
});

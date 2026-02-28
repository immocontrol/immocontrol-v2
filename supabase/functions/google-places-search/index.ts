import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, lat, lng, radius } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=de`;
    if (lat && lng) {
      url += `&location=${lat},${lng}&radius=${radius || 5000}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return new Response(JSON.stringify({ error: `Places API error: ${data.status}`, details: data.error_message }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get phone numbers for each place via Place Details
    const places = await Promise.all(
      (data.results || []).slice(0, 10).map(async (place: any) => {
        try {
          const detailRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,international_phone_number,website,opening_hours&key=${GOOGLE_MAPS_API_KEY}&language=de`
          );
          const detail = await detailRes.json();
          return {
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            types: place.types,
            rating: place.rating,
            phone: detail.result?.formatted_phone_number || detail.result?.international_phone_number || null,
            website: detail.result?.website || null,
            open_now: detail.result?.opening_hours?.open_now ?? null,
          };
        } catch {
          return {
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            types: place.types,
            rating: place.rating,
            phone: null,
            website: null,
            open_now: null,
          };
        }
      })
    );

    return new Response(JSON.stringify({ places }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

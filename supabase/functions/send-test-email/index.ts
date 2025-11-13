import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing Authorization header" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized - invalid session" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const url = new URL(req.url);
    let to = url.searchParams.get("to");

    if (!to && req.method === "POST") {
      try {
        const body = await req.json();
        to = body.to;
      } catch {
      }
    }

    if (!to) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing recipient email. Provide it via query param ?to=email or in request body."
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid email format" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Email service not configured (RESEND_API_KEY missing)",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const baseUrl = Deno.env.get("VITE_PUBLIC_BASE_URL") || "local";

    console.log("Sending test email via Resend:", { to, baseUrl, userId: user.id });

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: "noreply@notifications.a2display.fr",
      to: [to],
      subject: "Test Resend",
      html: `<p>Bonjour,<br/><br/>Ceci est un test depuis ${baseUrl}</p>`,
      text: "Test Resend OK",
      reply_to: "contact@a2display.fr",
    });

    await supabaseClient.from('email_test_logs').insert({
      user_id: user.id,
      to_email: to,
      status: error ? 'failed' : 'sent',
      response_json: data || error,
    });

    if (error) {
      console.error("Resend API error:", error);
      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message || String(error),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("Test email sent successfully:", { resendId: data?.id, to, userId: user.id });

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Email sent successfully",
        data: {
          id: data?.id,
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in send-test-email:", error);

    return new Response(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
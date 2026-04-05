import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "bootstrap-admin") {
      const { data: existingUser } = await supabaseAdmin
        .from("users")
        .select("id, auth_id, email")
        .eq("email", "hr@h-lens.co")
        .maybeSingle();

      if (existingUser?.auth_id) {
        return new Response(
          JSON.stringify({ message: "Admin already bootstrapped" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: "hr@h-lens.co",
          password: "12345678",
          email_confirm: true,
        });

      if (authError) {
        if (authError.message?.includes("already been registered")) {
          const { data: listData } =
            await supabaseAdmin.auth.admin.listUsers();
          const found = listData?.users?.find(
            (u: { email?: string }) => u.email === "hr@h-lens.co"
          );
          if (found && existingUser) {
            await supabaseAdmin
              .from("users")
              .update({ auth_id: found.id })
              .eq("id", existingUser.id);
            return new Response(
              JSON.stringify({ message: "Admin linked to existing auth user" }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        }
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingUser) {
        await supabaseAdmin
          .from("users")
          .update({ auth_id: authData.user.id })
          .eq("id", existingUser.id);
      }

      return new Response(
        JSON.stringify({ message: "Admin bootstrapped successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create-user") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user: callerAuth },
      } = await supabaseAdmin.auth.getUser(token);
      if (!callerAuth) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: callerProfile } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("auth_id", callerAuth.id)
        .maybeSingle();

      if (!callerProfile || callerProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const {
        email,
        password,
        full_name,
        role,
        job_title,
        department_id,
        manager_id,
        phone,
        employee_number,
      } = body;

      if (!email || !password || !full_name || !role) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .insert({
          email,
          password_hash: "supabase_auth",
          full_name,
          role,
          auth_id: authData.user.id,
        })
        .select()
        .single();

      if (userError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(JSON.stringify({ error: userError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role === "employee" || role === "manager") {
        const empData: Record<string, unknown> = {
          user_id: userData.id,
          employee_number: employee_number || `EMP${Date.now()}`,
          full_name,
          email,
          phone: phone || null,
          job_title: job_title || (role === "manager" ? "مدير قسم" : "موظف"),
          department_id: department_id || null,
          manager_id: manager_id || null,
        };

        if (role === "employee") {
          const { error: empError } = await supabaseAdmin
            .from("employees")
            .insert(empData);
          if (empError) {
            return new Response(
              JSON.stringify({
                warning: "User created but employee record failed",
                error: empError.message,
                user: userData,
              }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ message: "User created successfully", user: userData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-user") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user: callerAuth },
      } = await supabaseAdmin.auth.getUser(token);
      if (!callerAuth) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: callerProfile } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("auth_id", callerAuth.id)
        .maybeSingle();

      if (!callerProfile || callerProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { user_id } = body;

      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "Missing user_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("id, auth_id, role")
        .eq("id", user_id)
        .maybeSingle();

      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (targetUser.role === "admin") {
        return new Response(
          JSON.stringify({ error: "Cannot delete admin account" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      await supabaseAdmin
        .from("employees")
        .delete()
        .eq("user_id", targetUser.id);

      await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", targetUser.id);

      if (targetUser.auth_id) {
        await supabaseAdmin.auth.admin.deleteUser(targetUser.auth_id);
      }

      return new Response(
        JSON.stringify({ message: "User deleted successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update-password") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: callerAuth } } = await supabaseAdmin.auth.getUser(token);
      if (!callerAuth) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: callerProfile } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("auth_id", callerAuth.id)
        .maybeSingle();

      if (!callerProfile || callerProfile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { auth_id, password } = body;

      if (!auth_id || !password) {
        return new Response(JSON.stringify({ error: "Missing auth_id or password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(auth_id, { password });

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ message: "Password updated successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

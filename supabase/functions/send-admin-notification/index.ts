import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'new_feedback' | 'status_change';
  complaint: {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    priority: string;
    author_name: string;
    author_email: string;
    created_at: string;
  };
  old_status?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { type, complaint, old_status }: NotificationRequest = await req.json();

    console.log(`Processing ${type} notification for complaint:`, complaint.id);

    // Fetch all admin users
    const { data: admins, error: adminError } = await supabaseClient
      .from("profiles")
      .select("email, name")
      .eq("role", "ADMIN");

    if (adminError) {
      console.error("Error fetching admins:", adminError);
      throw new Error(`Failed to fetch admin users: ${adminError.message}`);
    }

    if (!admins || admins.length === 0) {
      console.log("No admin users found");
      return new Response(
        JSON.stringify({ message: "No admin users to notify" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${admins.length} admin(s) to notify`);

    // Prepare email content based on notification type
    let subject: string;
    let htmlContent: string;

    if (type === 'new_feedback') {
      subject = `New Feedback: ${complaint.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Feedback Submitted</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">${complaint.title}</h3>
            <p style="color: #666;"><strong>Category:</strong> ${complaint.category}</p>
            <p style="color: #666;"><strong>Priority:</strong> ${complaint.priority}</p>
            <p style="color: #666;"><strong>Status:</strong> ${complaint.status}</p>
            <p style="color: #666;"><strong>Submitted by:</strong> ${complaint.author_name} (${complaint.author_email})</p>
            <p style="color: #666;"><strong>Description:</strong></p>
            <p style="color: #666; white-space: pre-wrap;">${complaint.description}</p>
          </div>
          <p style="color: #666;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '')}/complaint/${complaint.id}" 
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View Feedback
            </a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This is an automated notification from the Student Feedback Hub.
          </p>
        </div>
      `;
    } else {
      subject = `Feedback Status Updated: ${complaint.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Feedback Status Updated</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #555;">${complaint.title}</h3>
            <p style="color: #666;"><strong>Status Changed:</strong> 
              <span style="text-decoration: line-through;">${old_status || 'Unknown'}</span> 
              → <span style="color: #4CAF50; font-weight: bold;">${complaint.status}</span>
            </p>
            <p style="color: #666;"><strong>Category:</strong> ${complaint.category}</p>
            <p style="color: #666;"><strong>Priority:</strong> ${complaint.priority}</p>
            <p style="color: #666;"><strong>Submitted by:</strong> ${complaint.author_name} (${complaint.author_email})</p>
            <p style="color: #666;"><strong>Description:</strong></p>
            <p style="color: #666; white-space: pre-wrap;">${complaint.description}</p>
          </div>
          <p style="color: #666;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '')}/complaint/${complaint.id}" 
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
              View Feedback
            </a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This is an automated notification from the Student Feedback Hub.
          </p>
        </div>
      `;
    }

    // Send emails to all admins
    const emailPromises = admins.map(async (admin) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "Student Feedback Hub <onboarding@resend.dev>",
          to: [admin.email],
          subject: subject,
          html: htmlContent,
        });

        console.log(`Email sent to ${admin.email}:`, emailResponse);
        return { success: true, email: admin.email };
      } catch (error: any) {
        console.error(`Failed to send email to ${admin.email}:`, error);
        return { success: false, email: admin.email, error: error.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Email notification complete: ${successCount} succeeded, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: `Notifications sent to ${successCount} admin(s)`,
        results: results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-admin-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

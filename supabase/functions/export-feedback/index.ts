import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  format: 'csv' | 'pdf';
  filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
    priority?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Export feedback request received');

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'ADMIN') {
      throw new Error('Unauthorized: Admin access required');
    }

    const body: ExportRequest = await req.json();
    console.log('Export request:', body);

    // Build query with filters
    let query = supabase
      .from('complaints_with_stats')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (body.filters?.startDate) {
      query = query.gte('created_at', body.filters.startDate);
    }
    if (body.filters?.endDate) {
      query = query.lte('created_at', body.filters.endDate);
    }
    if (body.filters?.status && body.filters.status !== 'all') {
      query = query.eq('status', body.filters.status);
    }
    if (body.filters?.category && body.filters.category !== 'all') {
      query = query.eq('category', body.filters.category);
    }
    if (body.filters?.priority && body.filters.priority !== 'all') {
      query = query.eq('priority', body.filters.priority);
    }

    const { data: complaints, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Fetched ${complaints?.length || 0} complaints`);

    if (body.format === 'csv') {
      return generateCSV(complaints || []);
    } else if (body.format === 'pdf') {
      return generatePDF(complaints || []);
    } else {
      throw new Error('Invalid format');
    }

  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateCSV(complaints: any[]): Response {
  console.log('Generating CSV');

  // Define CSV headers
  const headers = [
    'ID',
    'Title',
    'Description',
    'Category',
    'Status',
    'Priority',
    'Author Name',
    'Author Email',
    'Upvotes',
    'Created At',
    'Updated At'
  ];

  // Create CSV rows
  const rows = complaints.map(c => [
    c.id,
    `"${(c.title || '').replace(/"/g, '""')}"`,
    `"${(c.description || '').replace(/"/g, '""')}"`,
    c.category,
    c.status,
    c.priority,
    `"${(c.author_name || '').replace(/"/g, '""')}"`,
    c.author_email,
    c.upvote_count || 0,
    c.created_at,
    c.updated_at
  ]);

  // Combine headers and rows
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const filename = `feedback-report-${new Date().toISOString().split('T')[0]}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function generatePDF(complaints: any[]): Response {
  console.log('Generating PDF');

  // Generate HTML that can be printed to PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Feedback Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .meta {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #f3f4f6;
      padding: 15px 20px;
      border-radius: 8px;
      flex: 1;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .complaint {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .complaint-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 10px;
    }
    .complaint-title {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      margin: 0;
    }
    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-status {
      background: #dbeafe;
      color: #1e40af;
    }
    .badge-category {
      background: #fef3c7;
      color: #92400e;
    }
    .badge-priority {
      background: #fee2e2;
      color: #991b1b;
    }
    .complaint-description {
      color: #4b5563;
      line-height: 1.6;
      margin: 10px 0;
    }
    .complaint-meta {
      display: flex;
      gap: 20px;
      font-size: 13px;
      color: #6b7280;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
    .upvotes {
      font-weight: 600;
      color: #2563eb;
    }
    @media print {
      body {
        margin: 20px;
      }
      .complaint {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <h1>Feedback Report</h1>
  <div class="meta">
    Generated on ${new Date().toLocaleString()} | Total Feedback: ${complaints.length}
  </div>
  
  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Total Feedback</div>
      <div class="stat-value">${complaints.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">New</div>
      <div class="stat-value">${complaints.filter(c => c.status === 'NEW').length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">In Progress</div>
      <div class="stat-value">${complaints.filter(c => c.status === 'IN_PROGRESS').length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Resolved</div>
      <div class="stat-value">${complaints.filter(c => c.status === 'RESOLVED').length}</div>
    </div>
  </div>

  ${complaints.map(c => `
    <div class="complaint">
      <div class="complaint-header">
        <h3 class="complaint-title">${escapeHtml(c.title)}</h3>
        <div class="badges">
          <span class="badge badge-status">${c.status.replace('_', ' ')}</span>
          <span class="badge badge-category">${c.category}</span>
          <span class="badge badge-priority">${c.priority}</span>
        </div>
      </div>
      <div class="complaint-description">${escapeHtml(c.description)}</div>
      <div class="complaint-meta">
        <div><strong>Author:</strong> ${escapeHtml(c.author_name)} (${c.author_email})</div>
        <div><strong>Created:</strong> ${new Date(c.created_at).toLocaleDateString()}</div>
        <div class="upvotes"><strong>Upvotes:</strong> ${c.upvote_count || 0}</div>
      </div>
    </div>
  `).join('')}

  <script>
    // Auto-trigger print dialog when opened
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html',
    },
  });
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return (text || '').replace(/[&<>"']/g, (m) => map[m]);
}

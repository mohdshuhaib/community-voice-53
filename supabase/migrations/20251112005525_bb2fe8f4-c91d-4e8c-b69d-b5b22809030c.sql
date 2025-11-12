-- Drop and recreate the complaints_with_stats view without security definer
DROP VIEW IF EXISTS public.complaints_with_stats;

CREATE VIEW public.complaints_with_stats AS
SELECT 
  c.id,
  c.title,
  c.description,
  c.category,
  c.status,
  c.priority,
  c.author_id,
  c.created_at,
  c.updated_at,
  count(DISTINCT u.id) AS upvote_count,
  p.name AS author_name,
  p.email AS author_email,
  p.avatar_url AS author_avatar_url
FROM complaints c
LEFT JOIN upvotes u ON c.id = u.complaint_id
LEFT JOIN profiles p ON c.author_id = p.id
GROUP BY c.id, p.name, p.email, p.avatar_url;
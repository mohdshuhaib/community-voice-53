-- Fix notify_admins functions to use hardcoded Supabase URL
-- The app.settings.supabase_url config parameter doesn't exist, so we'll use the project URL directly

CREATE OR REPLACE FUNCTION public.notify_admins_new_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  complaint_data jsonb;
  author_profile record;
BEGIN
  -- Get author profile information
  SELECT name, email INTO author_profile
  FROM profiles
  WHERE id = NEW.author_id;

  -- Build complaint data
  complaint_data := jsonb_build_object(
    'type', 'new_feedback',
    'complaint', jsonb_build_object(
      'id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'category', NEW.category,
      'status', NEW.status,
      'priority', NEW.priority,
      'author_name', author_profile.name,
      'author_email', author_profile.email,
      'created_at', NEW.created_at
    )
  );

  -- Call the backend function asynchronously using pg_net with hardcoded URL
  PERFORM extensions.http_post(
    'https://pjbynidvsihmjvhdypoj.supabase.co/functions/v1/send-admin-notification',
    complaint_data
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_admins_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  complaint_data jsonb;
  author_profile record;
BEGIN
  -- Only send notification if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get author profile information
    SELECT name, email INTO author_profile
    FROM profiles
    WHERE id = NEW.author_id;

    -- Build complaint data
    complaint_data := jsonb_build_object(
      'type', 'status_change',
      'complaint', jsonb_build_object(
        'id', NEW.id,
        'title', NEW.title,
        'description', NEW.description,
        'category', NEW.category,
        'status', NEW.status,
        'priority', NEW.priority,
        'author_name', author_profile.name,
        'author_email', author_profile.email,
        'created_at', NEW.created_at
      ),
      'old_status', OLD.status
    );

    -- Call the backend function asynchronously using pg_net with hardcoded URL
    PERFORM extensions.http_post(
      'https://pjbynidvsihmjvhdypoj.supabase.co/functions/v1/send-admin-notification',
      complaint_data
    );
  END IF;

  RETURN NEW;
END;
$function$;
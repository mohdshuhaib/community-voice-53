-- Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update function: notify_admins_new_feedback to use two-arg http_post (no headers)
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

  -- Call the backend function asynchronously using pg_net without headers
  PERFORM extensions.http_post(
    current_setting('app.settings.supabase_url') || '/functions/v1/send-admin-notification',
    complaint_data
  );

  RETURN NEW;
END;
$function$;

-- Update function: notify_admins_status_change to use two-arg http_post (no headers)
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

    -- Call the backend function asynchronously using pg_net without headers
    PERFORM extensions.http_post(
      current_setting('app.settings.supabase_url') || '/functions/v1/send-admin-notification',
      complaint_data
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure triggers are attached (idempotent)
DROP TRIGGER IF EXISTS trg_notify_admins_new_feedback ON public.complaints;
CREATE TRIGGER trg_notify_admins_new_feedback
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_feedback();

DROP TRIGGER IF EXISTS trg_notify_admins_status_change ON public.complaints;
CREATE TRIGGER trg_notify_admins_status_change
AFTER UPDATE OF status ON public.complaints
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_admins_status_change();
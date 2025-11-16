-- Enable pg_net extension (provides http_post) in the extensions schema
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Ensure function uses correct parameter mapping for pg_net.http_post
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

  -- Call the edge function asynchronously using pg_net
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-admin-notification',
    body := complaint_data,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );

  RETURN NEW;
END;
$function$;

-- Ensure function uses correct parameter mapping for pg_net.http_post
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

    -- Call the edge function asynchronously using pg_net
    PERFORM extensions.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-admin-notification',
      body := complaint_data,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
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
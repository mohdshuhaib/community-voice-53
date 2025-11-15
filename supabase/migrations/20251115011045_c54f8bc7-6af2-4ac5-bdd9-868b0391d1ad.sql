-- Fix function security: Set search_path for notify_admins_new_feedback
CREATE OR REPLACE FUNCTION notify_admins_new_feedback()
RETURNS TRIGGER AS $$
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
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-admin-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := complaint_data
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix function security: Set search_path for notify_admins_status_change
CREATE OR REPLACE FUNCTION notify_admins_status_change()
RETURNS TRIGGER AS $$
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
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-admin-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := complaint_data
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
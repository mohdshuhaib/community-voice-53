-- Enable HTTP extension for outgoing requests from Postgres
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Ensure trigger for new feedback notifications
DROP TRIGGER IF EXISTS trg_notify_admins_new_feedback ON public.complaints;
CREATE TRIGGER trg_notify_admins_new_feedback
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_feedback();

-- Ensure trigger for status change notifications
DROP TRIGGER IF EXISTS trg_notify_admins_status_change ON public.complaints;
CREATE TRIGGER trg_notify_admins_status_change
AFTER UPDATE OF status ON public.complaints
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_admins_status_change();
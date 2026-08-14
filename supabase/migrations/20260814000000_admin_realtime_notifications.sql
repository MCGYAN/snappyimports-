-- Live admin notifications for orders and payment activity.
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_per_user_idx
  ON public.notifications (
    user_id,
    type,
    ((data ->> 'entity_id'))
  )
  WHERE data ->> 'entity_id' IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$$;

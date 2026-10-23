-- Run only in an authorized environment with Supabase Cron enabled.
-- Jobs run at 00:05 America/Bahia (03:05 UTC); names make registration idempotent.
select cron.schedule('bitaria-weekly-achievements','5 3 * * 0','select public.process_recurring_achievements();');
select cron.schedule('bitaria-monthly-achievements','5 3 1 * *','select public.process_recurring_achievements();');

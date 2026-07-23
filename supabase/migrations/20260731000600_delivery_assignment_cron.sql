-- Feature 2: run the assignment worker every 15s (proposal timeouts, new ready
-- orders missed by the instant admin trigger, and queue retries as livreurs free
-- up). Same cadence/model as the existing expire-stale-orders job.
select cron.schedule('process-delivery-assignments-15s', '15 seconds',
                     $$select public.process_delivery_assignments();$$);

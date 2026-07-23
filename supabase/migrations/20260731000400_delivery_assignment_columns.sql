-- Feature 2: delivery auto-assignment state on orders.
--   pending_assignment    : ready order with no free livreur, queued for retry
--   assignment_expires_at : deadline for the current 2-min acceptance proposal
--   tried_livreur_ids     : livreurs already offered this order (rotation on timeout)
alter table public.orders
  add column if not exists pending_assignment    boolean not null default false,
  add column if not exists assignment_expires_at timestamptz,
  add column if not exists tried_livreur_ids      uuid[]  not null default '{}';

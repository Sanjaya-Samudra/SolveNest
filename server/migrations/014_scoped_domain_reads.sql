-- Support tenant-scoped domain reads without loading the full platform state.
create index if not exists domain_records_conversation_idx
  on public.domain_records (collection, ((payload->>'conversationId')));

create index if not exists domain_records_status_idx
  on public.domain_records (collection, ((payload->>'status')));

create index if not exists domain_records_plan_idx
  on public.domain_records (collection, ((payload->>'planId')));

create index if not exists domain_records_payment_intent_idx
  on public.domain_records (collection, ((payload->>'paymentIntentId')));

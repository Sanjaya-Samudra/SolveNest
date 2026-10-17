ALTER TABLE public.domain_records DROP CONSTRAINT IF EXISTS domain_records_collection_check;
ALTER TABLE public.domain_records ADD CONSTRAINT domain_records_collection_check CHECK (collection IN (
    'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
    'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
    'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
    'supportTickets', 'refundRequests', 'payoutRequests', 'idempotency',
    'activity', 'notifications', 'adminAudit'));
CREATE INDEX IF NOT EXISTS domain_records_payout_expert_idx
  ON public.domain_records (((payload->>'expertId')), ((payload->>'status')))
  WHERE collection = 'payoutRequests';

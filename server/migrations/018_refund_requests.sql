-- Add durable refund cases to the record-level domain store.
ALTER TABLE public.domain_records DROP CONSTRAINT IF EXISTS domain_records_collection_check;
ALTER TABLE public.domain_records ADD CONSTRAINT domain_records_collection_check CHECK (collection IN (
    'tasks', 'files', 'deliveryFiles', 'analyses', 'reviews', 'drafts',
    'guestTransfers', 'conversations', 'messages', 'payments', 'plans',
    'scopeChanges', 'explainSessions', 'explainArtifacts', 'explainRequests',
    'supportTickets', 'refundRequests', 'idempotency', 'activity',
    'notifications', 'adminAudit'));

CREATE INDEX IF NOT EXISTS domain_records_refund_student_idx
  ON public.domain_records (((payload->>'studentId')), ((payload->>'status')))
  WHERE collection = 'refundRequests';

CREATE INDEX IF NOT EXISTS domain_records_refund_payment_idx
  ON public.domain_records (((payload->>'paymentId')))
  WHERE collection = 'refundRequests';

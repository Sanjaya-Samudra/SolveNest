-- Extend durable domain collections for governance and expert operations.
ALTER TABLE public.domain_records DROP CONSTRAINT IF EXISTS domain_records_collection_check;
ALTER TABLE public.domain_records ADD CONSTRAINT domain_records_collection_check CHECK (collection = ANY (ARRAY[
  'tasks','files','deliveryFiles','analyses','reviews','drafts','guestTransfers',
  'conversations','messages','payments','plans','scopeChanges','explainSessions',
  'explainArtifacts','explainRequests','supportTickets','refundRequests','payoutRequests',
  'solvyJobs','expertRequests','legalHolds','securityEvents','retentionRuns','policies',
  'emailSuppressions','idempotency','activity','notifications','adminAudit'
]));

Rollback:
  - Run: DROP TABLE IF EXISTS "stripe_events";
  - Data loss: all stored Stripe event records are permanently deleted
  - Duration estimate: < 1 second (table is new, no rows in production at time of this migration)

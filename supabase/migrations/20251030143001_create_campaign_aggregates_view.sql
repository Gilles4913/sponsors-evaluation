/*
  # Create materialized view for campaign aggregates

  1. Materialized View
    - campaign_aggregates - Pre-computed campaign statistics
    - Includes: total_pledged, yes_count, maybe_count, no_count, progress_percentage
    - Refresh on demand for performance optimization

  2. Benefits
    - Fast dashboard queries without real-time aggregation
    - Reduced database load for read-heavy operations
    - Consistent performance even with large datasets

  3. Usage
    - Query: SELECT * FROM campaign_aggregates WHERE campaign_id = ?
    - Refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_aggregates
*/

CREATE MATERIALIZED VIEW IF NOT EXISTS campaign_aggregates AS
SELECT 
  c.id AS campaign_id,
  c.tenant_id,
  c.title,
  c.objective_amount,
  c.deadline,
  c.created_at,
  COALESCE(SUM(CASE WHEN p.status = 'yes' THEN p.amount ELSE 0 END), 0) AS total_pledged,
  COALESCE(COUNT(*) FILTER (WHERE p.status = 'yes'), 0)::integer AS yes_count,
  COALESCE(COUNT(*) FILTER (WHERE p.status = 'maybe'), 0)::integer AS maybe_count,
  COALESCE(COUNT(*) FILTER (WHERE p.status = 'no'), 0)::integer AS no_count,
  COALESCE(COUNT(*), 0)::integer AS total_responses,
  CASE 
    WHEN c.objective_amount > 0 THEN 
      ROUND((COALESCE(SUM(CASE WHEN p.status = 'yes' THEN p.amount ELSE 0 END), 0) / c.objective_amount * 100)::numeric, 2)
    ELSE 0 
  END AS progress_percentage,
  MAX(p.created_at) AS last_response_at
FROM 
  campaigns c
  LEFT JOIN pledges p ON c.id = p.campaign_id
GROUP BY 
  c.id, c.tenant_id, c.title, c.objective_amount, c.deadline, c.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_aggregates_campaign_id 
  ON campaign_aggregates(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_aggregates_tenant_id 
  ON campaign_aggregates(tenant_id);

CREATE INDEX IF NOT EXISTS idx_campaign_aggregates_progress 
  ON campaign_aggregates(progress_percentage DESC);

COMMENT ON MATERIALIZED VIEW campaign_aggregates IS 
'Pre-computed campaign statistics for fast dashboard queries. Refresh using: REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_aggregates';

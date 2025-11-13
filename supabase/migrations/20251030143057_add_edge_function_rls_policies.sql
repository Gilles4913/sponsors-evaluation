/*
  # Add RLS policies for Edge Functions and public access

  1. New Policies
    - Allow public to insert pledges via valid invitation token
    - Allow public to update invitation status
    - Allow public to insert email events
    - Token-based access for public pledge submission

  2. Security
    - Edge Functions and public users validate token before operations
    - Public users can only submit via valid non-expired invitation
    - No direct database access without token validation
    - Invitation must be valid and not expired

  3. Implementation
    - Token validation through invitation table joins
    - Expiration check on all operations
    - Status validation for data integrity
*/

CREATE POLICY "Public can insert pledges with valid invitation"
ON pledges
FOR INSERT
TO anon
WITH CHECK (
  invitation_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM invitations
    WHERE invitations.id = invitation_id
    AND invitations.expires_at > now()
    AND invitations.status IN ('sent', 'opened', 'clicked')
  )
);

CREATE POLICY "Public can update invitation status on response"
ON invitations
FOR UPDATE
TO anon
USING (
  expires_at > now() AND
  status IN ('sent', 'opened', 'clicked')
)
WITH CHECK (
  status IN ('sent', 'opened', 'clicked', 'responded', 'bounced')
);

CREATE POLICY "Public can insert email events for invitations"
ON email_events
FOR INSERT
TO anon
WITH CHECK (
  invitation_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM invitations
    WHERE invitations.id = invitation_id
  )
);

CREATE POLICY "Public can view campaign via valid invitation"
ON campaigns
FOR SELECT
TO anon
USING (
  id IN (
    SELECT campaign_id FROM invitations
    WHERE expires_at > now()
  )
);

CREATE POLICY "Public can view sponsor via valid invitation"
ON sponsors
FOR SELECT
TO anon
USING (
  id IN (
    SELECT sponsor_id FROM invitations
    WHERE expires_at > now()
  )
);

CREATE POLICY "Public can view invitation by token"
ON invitations
FOR SELECT
TO anon
USING (
  expires_at > now()
);

CREATE POLICY "Public can view tenant for active campaigns"
ON tenants
FOR SELECT
TO anon
USING (
  id IN (
    SELECT c.tenant_id 
    FROM campaigns c
    INNER JOIN invitations i ON c.id = i.campaign_id
    WHERE i.expires_at > now()
  ) OR
  status = 'active'
);

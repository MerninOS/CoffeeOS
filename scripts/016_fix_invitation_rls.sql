-- Allow invited users to read invitations addressed to their email
-- This uses auth.jwt() to get the email from the JWT token without querying profiles

-- Users can read invitations sent to their email
DROP POLICY IF EXISTS "team_invitations_select_invitee" ON public.team_invitations;
CREATE POLICY "team_invitations_select_invitee" ON public.team_invitations 
  FOR SELECT USING (
    email = (SELECT auth.jwt() ->> 'email')
  );

-- Users can update invitations sent to their email (to accept them)
DROP POLICY IF EXISTS "team_invitations_update_invitee" ON public.team_invitations;
CREATE POLICY "team_invitations_update_invitee" ON public.team_invitations 
  FOR UPDATE USING (
    email = (SELECT auth.jwt() ->> 'email')
  );

-- Also allow admins (via get_my_owner_id) to manage invitations for their team
DROP POLICY IF EXISTS "team_invitations_select_admin" ON public.team_invitations;
CREATE POLICY "team_invitations_select_admin" ON public.team_invitations 
  FOR SELECT USING (
    owner_id = public.get_my_owner_id()
  );

DROP POLICY IF EXISTS "team_invitations_insert_admin" ON public.team_invitations;
CREATE POLICY "team_invitations_insert_admin" ON public.team_invitations 
  FOR INSERT WITH CHECK (
    owner_id = auth.uid() OR owner_id = public.get_my_owner_id()
  );

DROP POLICY IF EXISTS "team_invitations_delete_admin" ON public.team_invitations;
CREATE POLICY "team_invitations_delete_admin" ON public.team_invitations 
  FOR DELETE USING (
    owner_id = auth.uid() OR owner_id = public.get_my_owner_id()
  );

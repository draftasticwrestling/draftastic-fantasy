-- Trade flow: accept → awaiting_gm_approval; GM approves or rejects.
-- Keep 'accepted' for backwards compatibility (legacy executed trades).

alter table public.league_trade_proposals
  drop constraint if exists league_trade_proposals_status_check;

alter table public.league_trade_proposals
  add constraint league_trade_proposals_status_check
  check (status in (
    'pending',
    'rejected',
    'accepted',
    'awaiting_gm_approval',
    'gm_approved',
    'gm_rejected'
  ));

comment on column public.league_trade_proposals.status is 'pending=waiting on other owner; rejected=declined; awaiting_gm_approval=accepted, needs GM; gm_approved=executed; gm_rejected=GM declined; accepted=legacy executed.';

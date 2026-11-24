-- Inquiries are deleted for good 12 months after they arrive (the retention period in the privacy notice).
create function public.purge_expired_inquiries() returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.inquiries where created_at < now() - interval '12 months';
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.audit_log (actor_id, action, entity_type, metadata)
      values (null, 'inquiry.purge_expired', 'inquiry', jsonb_build_object('count', v_count));
  end if;
  return v_count;
end;
$$;

revoke execute on function public.purge_expired_inquiries() from public, anon, authenticated;
grant execute on function public.purge_expired_inquiries() to service_role;

select cron.schedule(
  'purge-expired-inquiries',
  '45 3 * * *',
  $$select public.purge_expired_inquiries()$$
);

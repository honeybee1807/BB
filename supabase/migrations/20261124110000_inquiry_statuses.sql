alter type public.inquiry_status rename value 'in_progress' to 'claimed';
alter type public.inquiry_status rename value 'actioned' to 'answered';
alter type public.inquiry_status add value 'closed';

-- Placeholder listings and journal posts. Text is replaced through the admin once the client
-- sends real descriptions and photos. Safe to run more than once.

insert into public.regions (slug, name, description, sort_order) values
  ('umhlanga', 'Umhlanga', 'Warm sea, long walks on the promenade and easy access to Durban. Ideal for families who want the beach on their doorstep.', 1),
  ('drakensberg', 'Drakensberg', 'Mountain air, clear rivers and quiet nights under big skies. A restful break a few hours from Durban.', 2)
on conflict (slug) do nothing;

insert into public.estates (region_id, slug, name, description, sort_order)
select r.id, e.slug, e.name, e.description, e.sort_order
from (values
  ('umhlanga', 'breakers-resort', 'Breakers Resort', 'Self-catering apartments on the beachfront, with pools and direct access to the sand.', 1),
  ('umhlanga', 'umhlanga-rocks', 'Umhlanga Rocks', 'Private villas a short walk from the lighthouse, the promenade and the village.', 2),
  ('drakensberg', 'champagne-valley', 'Champagne Valley', 'Spacious villas in the Central Drakensberg, close to hiking trails, rivers and family activities.', 1)
) as e(region_slug, slug, name, description, sort_order)
join public.regions r on r.slug = e.region_slug
on conflict (slug) do nothing;

insert into public.properties (
  estate_id, slug, name, summary, description, property_type, town,
  max_guests, bedrooms, bathrooms, is_halal, halal_details, is_featured, featured_sort_order, is_published
)
select e.id, p.slug, p.name, p.summary, p.description, p.property_type::public.property_type, p.town,
  p.max_guests, p.bedrooms, p.bathrooms, true,
  'No alcohol or pork on the premises. Qibla direction and prayer times available on request.',
  p.is_featured, p.featured_sort_order, true
from (values
  ('breakers-resort', 'breakers-sea-view-apartment', 'Breakers Sea View Apartment',
    'Two-bedroom apartment with a balcony facing the sea.',
    'A bright two-bedroom apartment with an open-plan lounge, a full kitchen and a balcony that looks straight out to sea. The resort pools and the beach are a short walk away.',
    'resort', 'Umhlanga', 6, 2, 2, true, 1),
  ('breakers-resort', 'breakers-family-apartment', 'Breakers Family Apartment',
    'Three bedrooms with room for the whole family.',
    'Three bedrooms, two bathrooms and a large lounge, with space for the whole family. Close to the resort pools, braai areas and the beach path.',
    'resort', 'Umhlanga', 8, 3, 2, false, 0),
  ('breakers-resort', 'breakers-garden-apartment', 'Breakers Garden Apartment',
    'Ground-floor apartment with a private garden patio.',
    'A ground-floor apartment that opens onto a small private garden. Easy for little ones and older guests, with no stairs between the parking and the front door.',
    'resort', 'Umhlanga', 4, 2, 1, false, 0),
  ('umhlanga-rocks', 'lighthouse-villa', 'Lighthouse Villa',
    'Four-bedroom villa with a pool, near the lighthouse.',
    'A four-bedroom villa with a private pool and a covered patio, a few minutes on foot from the lighthouse and the promenade.',
    'holiday_home', 'Umhlanga', 8, 4, 3, true, 2),
  ('umhlanga-rocks', 'promenade-villa', 'Promenade Villa',
    'Five-bedroom villa for larger families and groups.',
    'Five bedrooms and generous living areas for larger families travelling together. The village shops and restaurants are close by.',
    'holiday_home', 'Umhlanga', 10, 5, 4, false, 0),
  ('champagne-valley', 'cathkin-view-villa', 'Cathkin View Villa',
    'Mountain villa with views of Cathkin Peak.',
    'A four-bedroom villa with wide views of Cathkin Peak, a fireplace for cold evenings and a large deck for long breakfasts outside.',
    'holiday_home', 'Champagne Valley', 8, 4, 3, true, 3),
  ('champagne-valley', 'riverside-villa', 'Riverside Villa',
    'Three-bedroom villa a short walk from the river.',
    'Three bedrooms and an open-plan living area, with a path down to the river for swimming and picnics in summer.',
    'holiday_home', 'Champagne Valley', 6, 3, 2, false, 0),
  ('champagne-valley', 'mountain-family-villa', 'Mountain Family Villa',
    'Six bedrooms with space for two families.',
    'Six bedrooms across two wings, so two families can share without getting in each other''s way. Close to hiking trails and the valley''s family activities.',
    'holiday_home', 'Champagne Valley', 12, 6, 4, false, 0),
  ('champagne-valley', 'valley-retreat-villa', 'Valley Retreat Villa',
    'Quiet two-bedroom villa for a restful break.',
    'A quiet two-bedroom villa for couples or small families who want a restful break, with a fireplace and a garden facing the mountains.',
    'holiday_home', 'Champagne Valley', 4, 2, 2, false, 0)
) as p(estate_slug, slug, name, summary, description, property_type, town, max_guests, bedrooms, bathrooms,
  is_featured, featured_sort_order)
join public.estates e on e.slug = p.estate_slug
on conflict (slug) do nothing;

insert into public.blog_posts (slug, title, excerpt, body_md, is_published, published_at) values
  ('placeholder-planning-a-halal-friendly-beach-holiday', 'Placeholder: planning a halal-friendly beach holiday',
    'Placeholder post. Replace or delete it from the admin before launch.',
    E'This is a placeholder post so the Journal has something to show while the site is being built.\n\nReplace it with a real post from the admin, or delete it, before launch.',
    true, now() - interval '2 days'),
  ('placeholder-a-family-weekend-in-the-berg', 'Placeholder: a family weekend in the Berg',
    'Placeholder post. Replace or delete it from the admin before launch.',
    E'This is a placeholder post so the Journal has something to show while the site is being built.\n\nReplace it with a real post from the admin, or delete it, before launch.',
    true, now() - interval '1 day')
on conflict (slug) do nothing;

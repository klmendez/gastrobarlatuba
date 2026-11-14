-- Fotos públicas del catálogo; solo administradores de La Tuba pueden modificarlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('la-tuba-catalog-images', 'la-tuba-catalog-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "La Tuba admins upload catalog images" on storage.objects;
create policy "La Tuba admins upload catalog images" on storage.objects
for insert to authenticated with check (bucket_id = 'la-tuba-catalog-images' and public.is_la_tuba_admin());
drop policy if exists "La Tuba admins remove catalog images" on storage.objects;
create policy "La Tuba admins remove catalog images" on storage.objects
for delete to authenticated using (bucket_id = 'la-tuba-catalog-images' and public.is_la_tuba_admin());

-- =========================================================
-- HYENA FUEL — Storage de imágenes de producto (ADR 0007)
--
-- Bucket público `product-images` (subida directa del browser, admin-only) +
-- políticas RLS sobre storage.objects. Idempotente: bucket por upsert
-- (on conflict), políticas por drop + create.
-- =========================================================

-- Bucket idempotente (crea o actualiza límites)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true,
  5242880,                                   -- 5 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas sobre storage.objects (idempotentes: drop + create)
drop policy if exists "product_images_public_read"   on storage.objects;
drop policy if exists "product_images_admin_insert"  on storage.objects;
drop policy if exists "product_images_admin_update"  on storage.objects;
drop policy if exists "product_images_admin_delete"  on storage.objects;

-- Lectura pública (el bucket es público; explícito para la API JS SELECT)
create policy "product_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

-- Escritura: solo admin (reusa public.is_admin() del 0001_init)
create policy "product_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

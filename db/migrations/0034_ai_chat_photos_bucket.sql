-- 0034 — Storage bucket for AI chat photos (operator-uploaded images
-- attached to messages). Public read so we can render via <Image src=publicUrl>
-- without signed URLs. Write restricted by RLS on storage.objects.
--
-- Apply AFTER 0032b. Independent of 0033.
--
-- Idempotent.

insert into storage.buckets (id, name, public)
values ('ai-chat-photos', 'ai-chat-photos', true)
on conflict (id) do nothing;

-- Path convention: <conversation_id>/<timestamp>-<filename>
-- Read: anyone authenticated (public bucket, but only links shared in-app)
-- Write: only the conversation's operator
drop policy if exists ai_chat_photos_read on storage.objects;
create policy ai_chat_photos_read on storage.objects
  for select using (bucket_id = 'ai-chat-photos');

drop policy if exists ai_chat_photos_write on storage.objects;
create policy ai_chat_photos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ai-chat-photos'
    and exists (
      select 1 from public.ai_conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.operator_id = auth.uid()
    )
  );

drop policy if exists ai_chat_photos_delete on storage.objects;
create policy ai_chat_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ai-chat-photos'
    and exists (
      select 1 from public.ai_conversations c
      where c.id::text = (storage.foldername(name))[1]
        and c.operator_id = auth.uid()
    )
  );

-- ============================================================
-- 留言板「关联家庭」数据库迁移
-- 用法：打开 Supabase Dashboard → SQL Editor → 粘贴本文件全部内容 → Run
-- 作用：给 message_board_messages 增加 baby_id，并开启 RLS 按家庭隔离
-- ============================================================

-- 1. 新增 baby_id 字段（关联 babies 表，宝宝删除时留言级联删除）
--    注意：若你的 babies.id 不是 uuid 类型（例如 bigint），
--    请把下面的 "uuid" 改成对应类型，并去掉 REFERENCES 子句。
ALTER TABLE public.message_board_messages
  ADD COLUMN IF NOT EXISTS baby_id uuid REFERENCES public.babies(id) ON DELETE CASCADE;

-- 2. 为按家庭查询加索引
CREATE INDEX IF NOT EXISTS idx_message_board_messages_baby_id
  ON public.message_board_messages (baby_id);

-- 3. 启用行级安全（RLS）
ALTER TABLE public.message_board_messages ENABLE ROW LEVEL SECURITY;

-- 4. 清理旧公开策略（如果你之前给留言板建过“所有人可读写”的策略，
--    请在这里按实际策略名 DROP 掉，否则匿名用户仍能看/写全部留言）
DROP POLICY IF EXISTS "message_board_public_read" ON public.message_board_messages;
DROP POLICY IF EXISTS "message_board_public_insert" ON public.message_board_messages;
DROP POLICY IF EXISTS "message_board_public_all" ON public.message_board_messages;

-- 5. 读取策略：登录用户只能看到自己家庭的留言
DROP POLICY IF EXISTS "family_can_read_messages" ON public.message_board_messages;
CREATE POLICY "family_can_read_messages"
  ON public.message_board_messages
  FOR SELECT
  TO authenticated
  USING (
    baby_id IN (
      SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()
    )
  );

-- 6. 写入策略：登录用户只能给自己的家庭留言
DROP POLICY IF EXISTS "family_can_insert_messages" ON public.message_board_messages;
CREATE POLICY "family_can_insert_messages"
  ON public.message_board_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    baby_id IN (
      SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()
    )
  );

-- 7.（可选）删除策略：家庭成员可删除本家庭留言
--    前端暂时没有删除留言按钮，需要时再启用即可。
DROP POLICY IF EXISTS "family_can_delete_messages" ON public.message_board_messages;
CREATE POLICY "family_can_delete_messages"
  ON public.message_board_messages
  FOR DELETE
  TO authenticated
  USING (
    baby_id IN (
      SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()
    )
  );

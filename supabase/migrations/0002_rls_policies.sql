-- ============================================================
-- 数据隔离 RLS 策略（核心）
-- 用法：Supabase Dashboard → SQL Editor → 粘贴执行
-- 说明：本脚本只给 logs 和 growth_events 加「按家庭隔离」的 RLS。
--      这两张表的所有读写都发生在用户已关联家庭之后，策略安全且不会破坏现有流程。
--      babies / baby_users 涉及「创建/加入家庭」的写路径，改错了会导致无法注册/加入，
--      本脚本暂不执行，只在下文注释里给出建议。
--
-- ⚠️ 执行前：如果你之前给这两张表建过「所有人可读写」的公开策略，
--    请先把旧策略 DROP 掉，否则新策略无法阻止越权。
-- ============================================================

-- ---------- logs（护理记录：喂养/睡眠/尿布） ----------
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_read_logs" ON public.logs;
CREATE POLICY "family_read_logs" ON public.logs FOR SELECT TO authenticated
USING (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "family_insert_logs" ON public.logs;
CREATE POLICY "family_insert_logs" ON public.logs FOR INSERT TO authenticated
WITH CHECK (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "family_update_logs" ON public.logs;
CREATE POLICY "family_update_logs" ON public.logs FOR UPDATE TO authenticated
USING (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "family_delete_logs" ON public.logs;
CREATE POLICY "family_delete_logs" ON public.logs FOR DELETE TO authenticated
USING (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

-- ---------- growth_events（成长事件） ----------
ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_read_growth_events" ON public.growth_events;
CREATE POLICY "family_read_growth_events" ON public.growth_events FOR SELECT TO authenticated
USING (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "family_insert_growth_events" ON public.growth_events;
CREATE POLICY "family_insert_growth_events" ON public.growth_events FOR INSERT TO authenticated
WITH CHECK (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "family_update_growth_events" ON public.growth_events;
CREATE POLICY "family_update_growth_events" ON public.growth_events FOR UPDATE TO authenticated
USING (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "family_delete_growth_events" ON public.growth_events;
CREATE POLICY "family_delete_growth_events" ON public.growth_events FOR DELETE TO authenticated
USING (baby_id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));

-- ============================================================
-- babies / baby_users 说明（暂不执行）
-- ============================================================
-- babies 和 baby_users 的写路径（创建宝宝、加入家庭）依赖当前 RLS 状态，
-- 若贸然加严格策略，可能导致「无法创建宝宝 / 无法通过邀请码加入」。
--
-- 建议的读取策略（可选，相对安全，需要时再执行）：
--
--   ALTER TABLE public.babies ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "family_read_babies" ON public.babies
--     FOR SELECT TO authenticated
--     USING (id IN (SELECT baby_id FROM public.baby_users WHERE user_id = auth.uid()));
--
-- 注意：babies 的 INSERT 需要允许 authenticated（否则 welcome 无法创建宝宝），
-- 但直接 WITH CHECK(true) 有风险（任何登录用户都能建档案）。如需严格，
-- 建议配合「邀请码校验」或把创建/加入逻辑迁移到服务端函数（Supabase Edge Function）。
-- ============================================================

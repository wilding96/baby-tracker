// src/hooks/useBaby.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Baby {
  id: string;
  name: string;
  birthday: string | null;
  gender: string | null;
  invite_code: string;
}

export function useBaby() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBaby = async () => {
      // 1. 获取当前用户
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 2. 核心逻辑：查 baby_users 表，通过 user_id 找到 baby_id
      //    用 maybeSingle 兼容「一个账号加入多个家庭」的情况，取第一个即可
      const { data, error } = await supabase
        .from("baby_users")
        .select(
          `
          babies (
            id,
            name,
            birthday,
            gender,
            invite_code
          )
        `,
        )
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("查询宝宝关联失败:", error);
        setLoading(false);
        return;
      }

      const relation = data as {
        babies: Baby | Baby[] | null;
      } | null;
      const babyRaw = relation?.babies;
      const baby = Array.isArray(babyRaw) ? babyRaw[0] : babyRaw;

      if (baby) {
        setBaby(baby);
      }
      setLoading(false);
    };

    fetchBaby();
  }, []);

  return { baby, loading };
}

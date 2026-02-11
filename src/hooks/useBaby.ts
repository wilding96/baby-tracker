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
        .single(); // 假设目前一个用户只管一个宝宝

      if (data && data.babies) {
        // @ts-ignore
        setBaby(data.babies);
      } else {
        console.error("未找到关联宝宝:", error);
      }
      setLoading(false);
    };

    fetchBaby();
  }, []);

  return { baby, loading };
}

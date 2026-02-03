"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import avatar from "@/assets/images/avatar.png"

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // 表单数据状态
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    birthday: "",
    gender: "",
  });

  // 1. 页面加载时：获取宝宝信息
  useEffect(() => {
    const fetchBaby = async () => {
      const { data, error } = await supabase.from("babies").select("*").limit(1).single();
      
      if (data) {
        setFormData({
          id: data.id,
          name: data.name,
          birthday: data.birthday, // 数据库存的是 YYYY-MM-DD
          gender: data.gender || "男",
        });
      }
    };
    fetchBaby();
  }, []);

  // 2. 保存修改
  const handleSave = async () => {
    if (!formData.name) return alert("宝宝名字不能为空");
    setLoading(true);

    const { error } = await supabase
      .from("babies")
      .update({ 
        name: formData.name, 
        birthday: formData.birthday,
        gender: formData.gender 
      })
      .eq("id", formData.id); // ⚠️ 必须指定 ID，否则不知道更新谁

    setLoading(false);
    if (error) {
      alert("更新失败: " + error.message);
    } else {
      alert("保存成功！");
      router.refresh(); // 刷新数据
      router.push("/"); // 回到首页
    }
  };


  return (
    <main className="container mx-auto max-w-md p-4">
      {/* 图片，展示宝宝头像 */}
      <div className="flex justify-center mb-8">
        <Image
          src={avatar}
          alt="宝宝头像"
          width={128}
          height={128}
          className="rounded-full"
        />
      </div>
      {/* 顶部导航 */}
      <div className="flex items-center gap-2 mb-8">
        <Link href="/settings" className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">编辑宝宝资料</h1>
      </div>

      <div className="space-y-6">
        {/* 名字输入 */}
        <div className="space-y-2">
          <Label htmlFor="name">宝宝小名</Label>
          <Input 
            id="name" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="例如：毛豆" 
          />
        </div>

        {/* 生日选择 (使用原生 date picker，移动端体验最好) */}
        <div className="space-y-2">
          <Label htmlFor="birthday">出生日期</Label>
          <Input 
            id="birthday" 
            type="date"
            value={formData.birthday} 
            onChange={(e) => setFormData({...formData, birthday: e.target.value})}
          />
        </div>

        {/* 性别选择 (简单的两个按钮) */}
        <div className="space-y-2">
          <Label>性别</Label>
          <div className="flex gap-4">
            {["男", "女"].map((g) => (
              <div 
                key={g}
                onClick={() => setFormData({...formData, gender: g})}
                className={`
                  flex-1 py-3 text-center rounded-lg border cursor-pointer transition-all
                  ${formData.gender === g 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}
                `}
              >
                {g}
              </div>
            ))}
          </div>
        </div>

        {/* 保存按钮 */}
        <Button 
          className="w-full mt-8" 
          size="lg" 
          onClick={handleSave} 
          disabled={loading}
        >
          {loading ? "正在保存..." : "保存修改"}
        </Button>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import avatar from "@/assets/images/avatar.png";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // 表单数据状态
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    birthday: "",
    gender: "male", // 默认值，对应数据库的 male/female
  });

  // 1. 页面加载时：通过 baby_users 关联表获取正确的宝宝
  useEffect(() => {
    const fetchBaby = async () => {
      // A. 获取当前登录用户
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // B. 级联查询：查 baby_users 表，把关联的 babies 信息带出来
      const { data, error } = await supabase
        .from("baby_users")
        .select(
          `
          babies (
            id,
            name,
            birthday,
            gender
          )
        `,
        )
        .eq("user_id", user.id)
        .single();

      if (data && data.babies) {
        const baby = data.babies;
        // @ts-ignore
        setFormData({
          id: baby.id,
          name: baby.name || "",
          birthday: baby.birthday || "",
          gender: baby.gender || "male", // 确保回显正确
        });
      } else {
        console.error("未找到关联宝宝", error);
      }
      setPageLoading(false);
    };

    fetchBaby();
  }, [router]);

  // 2. 保存修改
  const handleSave = async () => {
    if (!formData.name) return alert("宝宝名字不能为空");
    setLoading(true);

    // 更新逻辑：只更新指定ID的宝宝
    const { error } = await supabase
      .from("babies")
      .update({
        name: formData.name,
        birthday: formData.birthday || null, // 如果空字符串转为null
        gender: formData.gender,
      })
      .eq("id", formData.id);

    setLoading(false);

    if (error) {
      alert("更新失败: " + error.message);
    } else {
      alert("保存成功！");
      router.refresh(); // 刷新数据
      router.back(); // 返回上一页
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        加载中...
      </div>
    );
  }

  return (
    <main className="container mx-auto max-w-md p-4 min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="flex items-center gap-2 mb-6 pt-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="-ml-2"
        >
          <ArrowLeft size={24} />
        </Button>
        <h1 className="text-xl font-bold">编辑宝宝资料</h1>
      </div>

      {/* 图片展示 */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md">
            <Image
              src={avatar}
              alt="宝宝头像"
              width={100}
              height={100}
              className="object-cover"
            />
          </div>
          {/* 这里是个装饰性的小图标，模拟“点击更换头像”的功能(暂未实现) */}
          <div className="absolute bottom-0 right-0 bg-blue-500 p-1.5 rounded-full border-2 border-white">
            <Save size={12} className="text-white" />
          </div>
        </div>
      </div>

      <div className="space-y-6 bg-white p-6 rounded-2xl shadow-sm">
        {/* 名字输入 */}
        <div className="space-y-2">
          <Label htmlFor="name">宝宝小名</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="例如：毛豆"
          />
        </div>

        {/* 生日选择 */}
        <div className="space-y-2">
          <Label htmlFor="birthday">出生日期 / 预产期</Label>
          <Input
            id="birthday"
            type="date"
            value={formData.birthday}
            onChange={(e) =>
              setFormData({ ...formData, birthday: e.target.value })
            }
          />
        </div>

        {/* 性别选择 */}
        <div className="space-y-2">
          <Label>性别</Label>
          <div className="flex gap-4">
            {/* 男宝按钮 */}
            <div
              onClick={() => setFormData({ ...formData, gender: "male" })}
              className={`
                flex-1 py-3 text-center rounded-xl border-2 cursor-pointer transition-all font-medium
                ${
                  formData.gender === "male"
                    ? "bg-blue-50 text-blue-600 border-blue-500"
                    : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                }
              `}
            >
              男宝 👦
            </div>

            {/* 女宝按钮 */}
            <div
              onClick={() => setFormData({ ...formData, gender: "female" })}
              className={`
                flex-1 py-3 text-center rounded-xl border-2 cursor-pointer transition-all font-medium
                ${
                  formData.gender === "female"
                    ? "bg-pink-50 text-pink-600 border-pink-500"
                    : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                }
              `}
            >
              女宝 👧
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <Button
          className="w-full mt-8 bg-black hover:bg-gray-800 text-white h-12 rounded-xl text-base"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "正在保存..." : "保存修改"}
        </Button>
      </div>
    </main>
  );
}

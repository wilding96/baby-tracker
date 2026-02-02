import Link from "next/link";
import { ChevronRight, User, Baby } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <main className="container mx-auto max-w-md p-4 space-y-6">
      <h1 className="text-2xl font-bold">设置</h1>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-500 ml-1">基础信息</p>
        
        <Link href="/settings/profile">
          <Card className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                <Baby size={20} />
              </div>
              <span className="font-medium text-gray-700">宝宝资料</span>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </Card>
        </Link>
      </div>
    </main>
  );
}
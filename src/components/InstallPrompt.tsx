"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Share, PlusSquare, X } from "lucide-react";

interface InstallPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallPrompt({ open, onOpenChange }: InstallPromptProps) {
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. 判断是不是 iOS 设备
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 2. 监听 Android 的安装事件
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加到主屏幕</DialogTitle>
          <DialogDescription>像原生 App 一样使用毛豆成长记录</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          {isIOS ? (
            /* iOS 引导教程 */
            <div className="space-y-4 text-sm text-gray-600">
              <p>由于 iOS 限制，请按照以下步骤手动添加：</p>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <div className="bg-white p-2 rounded-md shadow-sm text-blue-500">
                  <Share size={20} />
                </div>
                <span>
                  1. 点击浏览器底部的 <strong>分享</strong> 按钮
                </span>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                <div className="bg-white p-2 rounded-md shadow-sm text-gray-600">
                  <PlusSquare size={20} />
                </div>
                <span>
                  2. 下滑找到并点击 <strong>添加到主屏幕</strong>
                </span>
              </div>
            </div>
          ) : (
            /* Android / Chrome 安装按钮 */
            <div className="flex flex-col gap-3">
              {deferredPrompt ? (
                <Button
                  onClick={handleInstallClick}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  立即安装
                </Button>
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  <p>如果是微信打开，请点击右上角选择“在浏览器打开”</p>
                  <p className="mt-2">如果已安装，请直接在桌面打开~</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

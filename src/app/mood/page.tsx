"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { ArrowLeft, Loader2, Video, Pencil, X } from "lucide-react";
import * as htmlToImage from "html-to-image";

type EmotionMode = "faded" | "neon" | "fever";

const defaultContent: Record<EmotionMode, string> = {
  faded: `今天长辈又把客厅的窗户关上了，说是有穿堂风。\n\n我没说什么，只是默默把手里的茶杯放下。晚饭后，妻子在卧室里看剧，偶尔传来几声背景音。\n\n什么都没发生，只是觉得很疲惫。明天还要继续。`,
  neon: `客厅的窗户被长辈关严了，空气停止了流动。\n\n屏幕的幽光打在我的脸上，变成房间里唯一的焦距。卧室里妻子看剧的笑声像隔着一层水膜传过来，很遥远。\n\n我就坐在这里，像一个随时可以被拔掉电源的旁观者。`,
  fever: `窗户又被长辈锁死了，理由永远是该死的穿堂风。房间闷得像个封死的塑料盒。\n\n手里茶杯的温度烫得心烦。卧室里罐头笑声和主机风扇的嗡嗡声绞在一起，在大脑里来回撞击。\n\n明天又是这样。明天还是这样。`,
};

export default function MoodDemoPage() {
  const [emotion, setEmotion] = useState<EmotionMode>("faded");
  const [customText, setCustomText] = useState(defaultContent.faded);
  const [editingText, setEditingText] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const emotionContent = (text: string) => {
    return text.split("\n").flatMap((line, i, arr) => {
      if (line.trim() === "") return [<br key={`br-${i}`} />];
      return [
        <span key={`line-${i}`}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>,
      ];
    });
  };

  const handleEmotionChange = (mode: EmotionMode) => {
    setEmotion(mode);
    setCustomText(defaultContent[mode]);
  };

  const openEditor = () => {
    setEditingText(customText);
    setShowEditor(true);
  };

  const saveCustomText = () => {
    if (editingText.trim()) {
      setCustomText(editingText);
    }
    setShowEditor(false);
  };

  const cancelEditor = () => {
    setShowEditor(false);
  };

  const handleExportLive = async () => {
    if (!containerRef.current || isRecording) return;
    setIsRecording(true);

    const targetNode = containerRef.current;

    // 过滤函数：录制视频时，不录制底部的悬浮控制台和返回按钮
    const filterNodes = (node: HTMLElement) => {
      const exclusionClasses = ["floating-dock", "diary-back"];
      return !exclusionClasses.some((cls) => node.classList?.contains(cls));
    };

    try {
      // 1. 初始化第一帧
      let latestFrame = await htmlToImage.toCanvas(targetNode, {
        pixelRatio: 1,
        backgroundColor: emotion === "faded" ? "#e4e3df" : "#050a1f", // 给个底色防黑边
        filter: filterNodes,
      });

      const streamCanvas = document.createElement("canvas");
      const width = targetNode.offsetWidth;
      const height = targetNode.offsetHeight;
      streamCanvas.width = width;
      streamCanvas.height = height;
      const ctx = streamCanvas.getContext("2d");

      // 2. 配置 30FPS 视频流
      const stream = streamCanvas.captureStream(30);
      const supportedMimeTypes = [
        "video/webm;codecs=h264",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];
      const mimeType = supportedMimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );

      if (!mimeType) {
        throw new Error("当前浏览器不支持 MediaRecorder 视频录制");
      }

      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const canvasToBlob = (canvas: HTMLCanvasElement) =>
        new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("生成封面图片失败"));
              }
            },
            "image/jpeg",
            0.9,
          );
        });

      mediaRecorder.onstop = async () => {
        try {
          if (chunks.length === 0) {
            throw new Error("视频录制失败，没有生成有效片段");
          }

          const videoBlob = new Blob(chunks, { type: mimeType });
          const imageBlob = await canvasToBlob(latestFrame);

          const formData = new FormData();
          formData.append("image", imageBlob, "cover.jpg");
          formData.append("video", videoBlob, `live.${extension}`);

          const response = await fetch("/api/generate-live-photo", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            let message = errorText || "刻录接口报错了";

            try {
              const errorBody = JSON.parse(errorText) as { error?: string };
              message = errorBody.error || message;
            } catch {
              // 保留原始错误文本
            }

            throw new Error(message);
          }

          const contentType = response.headers.get("Content-Type") || "";
          if (!contentType.includes("application/zip")) {
            throw new Error("接口没有返回 ZIP 文件，请检查是否被登录页或中间件重定向");
          }

          const zipBlob = await response.blob();
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Emotion-Live-Photo-${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error("实况图刻录失败", error);
          alert(error instanceof Error ? error.message : "实况图刻录失败，请检查控制台");
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
        }
      };

      mediaRecorder.start();

      let isRecordingActive = true;
      let frameCount = 0;
      const maxFrames = 90; // 录制 3 秒 (30fps * 3s = 90帧)

      // ==========================================
      // 【黑科技核心】：高速渲染循环 (30 FPS)
      // 模拟摄像机物理抖动，彻底解决 DOM 渲染掉帧问题
      // ==========================================
      const renderLoop = setInterval(() => {
        if (!isRecordingActive || !ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.save();

        // 放大一点点画面 (2%)，防止镜头抖动时露出画布黑边
        const scale = 1.02;
        const offsetW = (width * scale - width) / 2;
        const offsetH = (height * scale - height) / 2;

        if (emotion === "fever") {
          // 焦躁模式：剧烈的随机摄像机抖动
          const dx = (Math.random() - 0.5) * 3; // X轴剧烈抖动
          const dy = (Math.random() - 0.5) * 3; // Y轴微弱抖动
          ctx.translate(dx, dy);
        } else if (emotion === "neon") {
          // 霓虹模式：缓慢的失重漂浮感
          const floatY = Math.sin(frameCount * 0.1) * 3;
          ctx.translate(0, floatY);
        }

        // 将最新截取的 DOM 画面画入视频流
        ctx.drawImage(
          latestFrame,
          -offsetW,
          -offsetH,
          width * scale,
          height * scale,
        );
        ctx.restore();

        frameCount++;
        if (frameCount >= maxFrames) {
          isRecordingActive = false;
          clearInterval(renderLoop);
          mediaRecorder.stop();
        }
      }, 33); // 33ms ≈ 30 FPS

      // ==========================================
      // 慢速抓取循环 (2 FPS)
      // 在后台缓慢更新 DOM 截图，用于捕获背景的渐变呼吸
      // ==========================================
      const captureLoop = async () => {
        if (!isRecordingActive) return;
        try {
          latestFrame = await htmlToImage.toCanvas(targetNode, {
            pixelRatio: 1,
            backgroundColor: undefined,
            filter: filterNodes,
          });
        } catch (e) {
          console.error("Capture loop error", e);
        }
        if (isRecordingActive) {
          setTimeout(captureLoop, 500); // 半秒截一次图足够了
        }
      };

      captureLoop();
    } catch (error) {
      console.error("Export failed:", error);
      setIsRecording(false);
    }
  };

  return (
    <>
      <main className={`diary-app ${emotion}`} ref={containerRef}>
        <div className="noise-overlay" />

        <Link href="/" className="diary-back" aria-label="返回首页">
          <ArrowLeft size={16} />
          返回
        </Link>

        <div className="content-wrapper">
          <p className="diary-text">{emotionContent(customText)}</p>
        </div>

        <div className="floating-dock">
          <div className="emotion-toggles">
            <button
              className={emotion === "faded" ? "active" : ""}
              onClick={() => handleEmotionChange("faded")}
            >
              褪色
            </button>
            <button
              className={emotion === "neon" ? "active" : ""}
              onClick={() => handleEmotionChange("neon")}
            >
              霓虹
            </button>
            <button
              className={emotion === "fever" ? "active" : ""}
              onClick={() => handleEmotionChange("fever")}
            >
              焦躁
            </button>
          </div>

          <div className="divider" />

          <button
            className="edit-text-btn"
            onClick={openEditor}
            disabled={isRecording}
            title="编辑文案"
          >
            <Pencil size={13} />
          </button>

          <div className="divider" />

          <button
            className="export-btn"
            onClick={handleExportLive}
            disabled={isRecording}
          >
            {isRecording ? (
              <>
                <Loader2 size={14} className="spin" /> 刻录中
              </>
            ) : (
              <>
                <Video size={14} /> 实况
              </>
            )}
          </button>
        </div>

        {/* 文案编辑浮层 */}
        {showEditor && (
          <div className="editor-overlay" onClick={cancelEditor}>
            <div className="editor-panel" onClick={(e) => e.stopPropagation()}>
              <div className="editor-header">
                <span className="editor-title">编辑文案</span>
                <button className="editor-close" onClick={cancelEditor}>
                  <X size={16} />
                </button>
              </div>
              <textarea
                className="editor-textarea"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                autoFocus
              />
              <div className="editor-footer">
                <button className="editor-cancel" onClick={cancelEditor}>
                  取消
                </button>
                <button className="editor-save" onClick={saveCustomText}>
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 这里的样式代码保持不变，请保留你之前文件里的 <style> 内容 */}
      <style>{`
        /* ... 保留原有的 CSS ... */
        .diary-app {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.8s ease-in-out, color 0.8s ease;
          position: relative;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
        }
        .diary-back { position: absolute; top: 30px; left: 30px; display: flex; align-items: center; gap: 6px; color: inherit; text-decoration: none; z-index: 20; opacity: 0.4; transition: opacity 0.3s; font-size: 14px; }
        .diary-back:hover { opacity: 0.8; }
        .noise-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.08"/%3E%3C/svg%3E'); }
        .content-wrapper { max-width: 520px; width: 90%; padding: 0 20px; z-index: 10; position: relative; margin-top: -50px; }
        .diary-text { font-size: 17px; line-height: 2.3; margin: 0; animation: text-fade-in 0.8s ease; }
        @keyframes text-fade-in { 0% { opacity: 0; transform: translateY(5px); } 100% { opacity: 1; transform: translateY(0); } }
        .floating-dock { position: fixed; bottom: 35px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: rgba(128, 128, 128, 0.12); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 100px; z-index: 20; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
        .emotion-toggles { display: flex; gap: 4px; }
        .divider { width: 1px; height: 18px; background: rgba(255, 255, 255, 0.15); margin: 0 4px; }
        .floating-dock button { background: transparent; border: none; color: inherit; padding: 8px 16px; border-radius: 100px; cursor: pointer; transition: all 0.3s ease; font-size: 13px; opacity: 0.6; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
        .floating-dock button:hover:not(:disabled) { opacity: 1; background: rgba(255, 255, 255, 0.06); }
        .floating-dock button:disabled { cursor: not-allowed; opacity: 0.8; }
        .export-btn { color: inherit; opacity: 0.8 !important; }
        .edit-text-btn { background: transparent; border: none; color: inherit; padding: 8px 10px; border-radius: 100px; cursor: pointer; transition: all 0.3s ease; font-size: 13px; opacity: 0.5; display: flex; align-items: center; }
        .edit-text-btn:hover:not(:disabled) { opacity: 1; background: rgba(255, 255, 255, 0.06); }
        .edit-text-btn:disabled { cursor: not-allowed; opacity: 0.3; }
        .editor-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; animation: fade-in 0.2s ease; }
        .editor-panel { background: #fff; border-radius: 20px; width: 100%; max-width: 480px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden; animation: slide-up 0.25s ease; }
        .editor-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eee; }
        .editor-title { font-size: 15px; font-weight: 700; color: #333; }
        .editor-close { background: transparent; border: none; cursor: pointer; color: #999; padding: 4px; border-radius: 6px; }
        .editor-close:hover { color: #333; background: #f5f5f5; }
        .editor-textarea { width: 100%; min-height: 200px; padding: 20px; border: none; outline: none; font-size: 15px; line-height: 1.8; resize: vertical; font-family: inherit; color: #333; }
        .editor-textarea:focus { outline: none; }
        .editor-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 20px; border-top: 1px solid #eee; }
        .editor-cancel { padding: 8px 20px; border-radius: 100px; border: 1px solid #ddd; background: #fff; color: #666; font-size: 13px; cursor: pointer; }
        .editor-cancel:hover { background: #f5f5f5; }
        .editor-save { padding: 8px 20px; border-radius: 100px; border: none; background: #5a7f38; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
        .editor-save:hover { background: #4a6f2e; }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes slide-up { 0% { opacity: 0; transform: translateY(20px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .diary-app.faded { background: linear-gradient(135deg, #e4e3df 0%, #f0efe9 100%); color: #6a6a6a; }
        .diary-app.faded .diary-text { letter-spacing: 1px; }
        .diary-app.faded .emotion-toggles button.active { background: rgba(0, 0, 0, 0.06); color: #333; opacity: 1; font-weight: 500; }
        .diary-app.faded .divider { background: rgba(0,0,0,0.1); }
        .diary-app.neon { background: linear-gradient(135deg, #050a1f 0%, #2a0845 50%, #640d5f 100%); background-size: 200% 200%; animation: gradient-breathe 8s ease infinite; color: #e0e7ff; }
        .diary-app.neon .diary-text { text-shadow: 0 0 10px rgba(224, 231, 255, 0.3), 2px 2px 0px rgba(255, 0, 128, 0.5), -2px -2px 0px rgba(0, 255, 255, 0.5); letter-spacing: 2px; }
        .diary-app.neon .emotion-toggles button.active { background: rgba(255, 255, 255, 0.15); color: #fff; opacity: 1; box-shadow: 0 0 12px rgba(255,0,128,0.2); }
        .diary-app.fever { background: radial-gradient(circle at center, #3a0e05 0%, #0a0100 100%); color: #d69887; }
        .diary-app.fever .diary-text { font-weight: 500; letter-spacing: -0.5px; text-shadow: 2px 0px 0px rgba(255, 0, 0, 0.4); animation: text-jitter 0.15s infinite alternate; }
        .diary-app.fever .emotion-toggles button.active { background: rgba(255, 0, 0, 0.2); color: #ffbba6; opacity: 1; }
        @keyframes gradient-breathe { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes text-jitter { 0% { transform: translate(0, 0) skewX(0deg); } 100% { transform: translate(-1px, 1px) skewX(-1deg); } }
      `}</style>
    </>
  );
}

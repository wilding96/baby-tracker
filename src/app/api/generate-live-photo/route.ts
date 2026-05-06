import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { exiftool } from "exiftool-vendored";
import archiver from "archiver";
import { PassThrough } from "stream";

// 配置 ffmpeg 使用我们安装的静态二进制文件
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(request: Request) {
  const tmpFiles: string[] = [];

  try {
    // 1. 获取前端传来的视频和图片
    const formData = await request.formData();
    const imageFile = formData.get("image") as File;
    const videoFile = formData.get("video") as File;

    if (!imageFile || !videoFile) {
      return NextResponse.json(
        { error: "缺少图片或视频文件" },
        { status: 400 },
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // 2. 准备基础数据：UUID 与临时路径
    const assetIdentifier = crypto.randomUUID().toUpperCase();
    const tmpDir = "/tmp";
    const baseName = `IMG_${Date.now()}`;

    const inJpg = path.join(tmpDir, `${baseName}_in.jpg`);
    const inWebm = path.join(tmpDir, `${baseName}_in.webm`);
    const outJpg = path.join(tmpDir, `${baseName}.JPG`); // 苹果实况图规范大写
    const outMov = path.join(tmpDir, `${baseName}.MOV`); // 苹果实况图规范大写

    tmpFiles.push(inJpg, inWebm, outJpg, outMov);

    // 写入原始文件到 Vercel 允许的 /tmp 目录
    await fs.writeFile(inJpg, imageBuffer);
    await fs.writeFile(inWebm, videoBuffer);

    // ==========================================
    // 核心手术 1：处理图片 (写入 EXIF UUID)
    // ==========================================
    // 先复制一份出来作为输出底板
    await fs.copyFile(inJpg, outJpg);
    // 强行注入苹果特有的 ContentIdentifier
    await exiftool.write(outJpg, { ContentIdentifier: assetIdentifier }, [
      "-overwrite_original",
    ]);

    // ==========================================
    // 核心手术 2：处理视频 (WebM转MOV + 注入 UUID)
    // ==========================================
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inWebm)
        .videoCodec("libx264")
        .outputOptions([
          "-pix_fmt yuv420p",
          // 灵魂注入：写入 QuickTime 轨道 UUID
          `-metadata com.apple.quicktime.content.identifier=${assetIdentifier}`,
        ])
        .save(outMov)
        .on("end", () => resolve())
        .on("error", (err) => reject(err));
    });

    // ==========================================
    // 核心手术 3：打包 ZIP 到内存中
    // ==========================================
    // 为了防止在流传输过程中清理了临时文件导致报错，我们把 ZIP 直接缓冲到内存里
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = new PassThrough();
      const archive = archiver("zip", { zlib: { level: 9 } });

      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", (err) => reject(err));

      archive.pipe(stream);
      // 注意：实况图的图片和视频必须同名
      archive.file(outJpg, { name: `${baseName}.JPG` });
      archive.file(outMov, { name: `${baseName}.MOV` });
      archive.finalize();
    });

    // ==========================================
    // 核心手术 4：彻底清理痕迹并返回
    // ==========================================
    // 必须调用 end 释放 exiftool 进程，防止 Vercel 内存泄露
    await exiftool.end();

    // 清理 /tmp 文件
    await Promise.all(tmpFiles.map((f) => fs.unlink(f).catch(() => {})));

    // 将存在内存里的 ZIP 返回给前端下载
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Emotion-Live-Photo-${baseName}.zip"`,
      },
    });
  } catch (error) {
    console.error("Live Photo 生成失败:", error);
    // 发生错误时也要尝试清理
    await exiftool.end().catch(() => {});
    await Promise.all(tmpFiles.map((f) => fs.unlink(f).catch(() => {})));
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}

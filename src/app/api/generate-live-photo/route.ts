import { randomUUID } from "node:crypto";
import { unlink, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { PassThrough, Readable } from "node:stream";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);

type FfmpegCommand = {
  videoCodec(codec: string): FfmpegCommand;
  audioCodec(codec: string): FfmpegCommand;
  outputOptions(options: string[]): FfmpegCommand;
  output(path: string): FfmpegCommand;
  format(format: string): FfmpegCommand;
  on(event: "end", listener: () => void): FfmpegCommand;
  on(
    event: "error",
    listener: (error: Error, stdout?: string, stderr?: string) => void,
  ): FfmpegCommand;
  run(): void;
};

type FfmpegFactory = ((input: string) => FfmpegCommand) & {
  setFfmpegPath(path: string): void;
};

type Archive = {
  pipe(stream: PassThrough): void;
  file(path: string, data: { name: string }): Archive;
  finalize(): Promise<void>;
  on(event: "error", listener: (error: Error) => void): Archive;
};

type ArchiverFactory = (
  format: "zip",
  options?: { zlib?: { level?: number } },
) => Archive;

type ExifToolInstance = {
  write(
    file: string,
    tags: { ContentIdentifier: string },
    args?: string[],
  ): Promise<void>;
  end(): Promise<void>;
};

type ExifToolConstructor = new () => ExifToolInstance;

const ffmpeg = require("fluent-ffmpeg") as FfmpegFactory;
const archiver = require("archiver") as ArchiverFactory;
const { ExifTool } = require("exiftool-vendored") as {
  ExifTool: ExifToolConstructor;
};

ffmpeg.setFfmpegPath(require("@ffmpeg-installer/ffmpeg").path);

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

async function cleanupTempFiles(paths: string[]) {
  await Promise.allSettled(paths.map((path) => unlink(path)));
}

function createCleanupOnce(paths: string[]) {
  let cleaned = false;

  return () => {
    if (cleaned) return;
    cleaned = true;
    void cleanupTempFiles(paths);
  };
}

function transcodeVideoToLivePhotoMov(
  inputPath: string,
  outputPath: string,
  contentIdentifier: string,
) {
  return new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .format("mov")
      .outputOptions([
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-metadata",
        `com.apple.quicktime.content.identifier=${contentIdentifier}`,
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (error, _stdout, stderr) => {
        reject(new Error(stderr || error.message));
      })
      .run();
  });
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "生成 Live Photo 失败";
}

export async function POST(request: Request) {
  const id = `${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const contentIdentifier = randomUUID().toUpperCase();
  const tempDir = "/tmp";

  const inputImagePath = join(tempDir, `${id}_in.jpg`);
  const inputVideoPath = join(tempDir, `${id}_in.webm`);
  const outputImageName = `IMG_${id}.JPG`;
  const outputVideoName = `IMG_${id}.MOV`;
  const outputImagePath = join(tempDir, outputImageName);
  const outputVideoPath = join(tempDir, outputVideoName);
  const tempFiles = [
    inputImagePath,
    inputVideoPath,
    outputImagePath,
    outputVideoPath,
  ];

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const video = formData.get("video");

    if (!isUploadFile(image) || !isUploadFile(video)) {
      return NextResponse.json(
        { error: "请上传 image 和 video 文件" },
        { status: 400 },
      );
    }

    await mkdir(tempDir, { recursive: true });
    await Promise.all([
      writeFile(inputImagePath, Buffer.from(await image.arrayBuffer())),
      writeFile(inputVideoPath, Buffer.from(await video.arrayBuffer())),
    ]);

    await transcodeVideoToLivePhotoMov(
      inputVideoPath,
      outputVideoPath,
      contentIdentifier,
    );

    const exiftool = new ExifTool();
    try {
      await exiftool.write(
        inputImagePath,
        { ContentIdentifier: contentIdentifier },
        ["-o", outputImagePath],
      );
    } finally {
      await exiftool.end();
    }

    const cleanupOnce = createCleanupOnce(tempFiles);
    const archive = archiver("zip", { zlib: { level: 9 } });
    const zipStream = new PassThrough();

    archive.on("error", (error) => {
      zipStream.destroy(error);
    });

    zipStream.on("close", cleanupOnce);
    zipStream.on("end", cleanupOnce);
    zipStream.on("error", cleanupOnce);

    archive.pipe(zipStream);
    archive.file(outputImagePath, { name: outputImageName });
    archive.file(outputVideoPath, { name: outputVideoName });

    void archive.finalize().catch((error: Error) => {
      zipStream.destroy(error);
    });

    const body = Readable.toWeb(zipStream) as ReadableStream<Uint8Array>;

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="Live-Photo.zip"',
      },
    });
  } catch (error) {
    await cleanupTempFiles(tempFiles);

    return NextResponse.json({ error: toErrorMessage(error) }, { status: 500 });
  }
}

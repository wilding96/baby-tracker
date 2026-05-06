declare module "fluent-ffmpeg" {
  interface FfmpegCommand {
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
  }

  interface FfmpegFactory {
    (input: string): FfmpegCommand;
    setFfmpegPath(path: string): void;
  }

  const ffmpeg: FfmpegFactory;
  export = ffmpeg;
}

declare module "@ffmpeg-installer/ffmpeg" {
  const ffmpegInstaller: {
    path: string;
    version?: string;
    url?: string;
  };

  export = ffmpegInstaller;
}

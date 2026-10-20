type PageLoadingProps = {
  /** 文案说明正在加载什么，避免整页只剩一个转圈 */
  label?: string;
  /** 整页占位：用于数据没到之前无法渲染的页面 */
  fullScreen?: boolean;
  /** 紧凑版：用于卡片内部或局部区块 */
  compact?: boolean;
};

/**
 * 全站统一的加载态。
 * 三个点用 island 主题色，样式定义在 globals.css 的 .island-loading-dots。
 */
export function PageLoading({
  label = "加载中…",
  fullScreen = false,
  compact = false,
}: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? "island-page flex min-h-screen items-center justify-center px-6 pb-20"
          : compact
            ? "flex flex-col items-center justify-center gap-2 py-6"
            : "flex flex-col items-center justify-center gap-3 py-16"
      }
    >
      <span className="island-loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <p className="text-sm font-semibold text-[#9f927d]">{label}</p>
    </div>
  );
}

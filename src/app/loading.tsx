import { PageLoading } from "@/components/ui/page-loading";

/** App Router 的路由级加载态：切页时先给反馈，避免白屏 */
export default function Loading() {
  return <PageLoading fullScreen label="正在加载…" />;
}

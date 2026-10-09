// ═══════════════════════════════════════════════════════════════════
// POP3D — 取景数学（纯函数，零依赖）
// 「容器尺寸 → 画布尺寸 → 相机取景范围」的唯一实现点。
// 不变量：任何视口下整个场地都必须完整可见，且画面不畸变。
// ═══════════════════════════════════════════════════════════════════

export interface FramingOptions {
  halfW: number; // 场地半宽（世界单位）
  halfH: number; // 场地半纵深（世界单位）
  marginY: number; // 纵向留白倍数
  coverX: number; // 横向最小覆盖倍数
  maxAspect: number; // 画布最大宽高比（超宽窗口下收成竖屏板）
}

export interface Framing {
  aspect: number; // 画布宽高比
  cssW: number; // 画布 CSS 宽（整数像素）
  cssH: number; // 画布 CSS 高（整数像素）
  halfViewW: number; // 相机可见半宽（世界单位）
  halfViewH: number; // 相机可见半高（世界单位）
}

export function computeFraming(
  containerW: number,
  containerH: number,
  o: FramingOptions,
): Framing {
  const cw = Math.max(1, containerW);
  const ch = Math.max(1, containerH);

  // 1) 画布收成竖屏板并居中：竖版场地填充画板，画板外的留白交给页面背景
  const aspect = Math.min(cw / ch, o.maxAspect);
  let cssW = ch * aspect;
  let cssH = ch;
  if (cssW > cw) {
    cssW = cw;
    cssH = cw / aspect;
  }
  cssW = Math.max(1, Math.floor(cssW));
  cssH = Math.max(1, Math.floor(cssH));

  // 2) 取景：同时覆盖纵向与横向，且保持 aspect 不畸变
  const a = cssW / cssH;
  const halfViewH = Math.max(o.halfH * o.marginY, (o.halfW * o.coverX) / a);
  const halfViewW = halfViewH * a;

  return { aspect: a, cssW, cssH, halfViewW, halfViewH };
}

/** 透视相机：让视锥半高恰好等于 halfViewH，反推相机到注视点的距离 */
export function perspectiveDistance(halfViewH: number, fovDeg: number): number {
  return halfViewH / Math.tan((fovDeg * Math.PI) / 360);
}

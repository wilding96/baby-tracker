import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "消灭小怪兽",
    short_name: "小怪兽",
    description: "把待办变成怪兽，一只只消灭",
    start_url: "/game/todo-monsters",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3df",
    theme_color: "#6fba2c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

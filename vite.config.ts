import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["icon.svg"],
			manifest: {
				name: "new todomate",
				short_name: "new todomate",
				description: "친구들과 오늘의 할 일과 루틴을 나누는 비공개 플래너",
				lang: "ko",
				start_url: "/",
				display: "standalone",
				background_color: "#F7F5FF",
				theme_color: "#6C4DFF",
				icons: [
					{
						src: "/icon.svg",
						sizes: "any",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
				],
			},
		}),
	],
	server: {
		host: "127.0.0.1",
		port: 5173,
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8787",
				changeOrigin: true,
				ws: true,
			},
		},
	},
	preview: {
		host: "127.0.0.1",
		port: 4173,
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8787",
				changeOrigin: true,
				ws: true,
			},
		},
	},
});

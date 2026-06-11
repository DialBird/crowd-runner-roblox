/**
 * ゲームバランス・コース構成の調整値（Web版 crowd-runner の config.ts を Roblox スケールに変換）。
 * 距離の単位は stud（キャラの幅が約4 stud）。
 */
export const CONFIG = {
	// コース
	bossOffset: 45,
	bossRatio: 0.8,
	enemyPlan: [
		{ afterGate: 1, ratio: 0.5 },
		{ afterGate: 3, ratio: 0.55 },
		{ afterGate: 5, ratio: 0.6 },
		{ afterGate: 7, ratio: 0.7 },
	],
	firstGateZ: 70,
	gateCount: 8,
	gateSpacing: 55,
	goalOffset: 30,

	// プレイヤー
	maxCount: 999,
	startCount: 3,
	walkSpeed: 28,

	// 描画
	maxRenderedUnits: 60,
	roadWidth: 22,
} as const;

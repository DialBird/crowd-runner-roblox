/**
 * コース生成と人数計算の純粋ロジック（Web版 course.ts の移植）。
 * 敵の人数は「最適プレイ時の人数 × ratio（最低でも1人下回る）」で生成され、
 * 全ゲート効果が人数に対して単調なため、各ゲートでの最大化＝大局的な最適となり、
 * 最適解を選び続ければ必ずゴールできることを構成的に保証する。
 */
import { CONFIG } from "shared/config";

export type OpKind = "add" | "div" | "mul" | "sub";
export interface Op {
	kind: OpKind;
	value: number;
}

export interface CourseEnemy {
	afterGate: number;
	count: number;
}

export interface Course {
	bossCount: number;
	enemies: CourseEnemy[];
	gateOps: [Op, Op][];
}

export function applyOp(count: number, op: Op): number {
	if (op.kind === "add") return count + op.value;
	if (op.kind === "div") return math.floor(count / op.value);
	if (op.kind === "mul") return count * op.value;
	return math.max(0, count - op.value);
}

export function formatOp(op: Op): string {
	if (op.kind === "add") return `+${op.value}`;
	if (op.kind === "div") return `÷${op.value}`;
	if (op.kind === "mul") return `×${op.value}`;
	return `-${op.value}`;
}

export function clampCount(count: number): number {
	return math.max(0, math.min(count, CONFIG.maxCount));
}

function round(value: number): number {
	return math.floor(value + 0.5);
}

function randomGoodOp(): Op {
	if (math.random() < 0.3) return { kind: "mul", value: 2 };
	return { kind: "add", value: math.random(4, 9) };
}

function randomBadOp(): Op {
	if (math.random() < 0.5) return { kind: "div", value: 2 };
	return { kind: "sub", value: math.random(3, 8) };
}

function makeOps(): [Op, Op] {
	const a = randomGoodOp();
	const b = math.random() < 0.45 ? randomBadOp() : randomGoodOp();
	return math.random() < 0.5 ? [a, b] : [b, a];
}

function bestAfterGate(count: number, ops: [Op, Op]): number {
	return clampCount(math.max(applyOp(count, ops[0]), applyOp(count, ops[1])));
}

function beatableCount(optimal: number, ratio: number): number {
	return math.max(1, math.min(optimal - 1, round(optimal * ratio)));
}

export function generateCourse(): Course {
	const gateOps = new Array<[Op, Op]>();
	for (let i = 0; i < CONFIG.gateCount; i++) {
		gateOps.push(makeOps());
	}
	const enemies = new Array<CourseEnemy>();
	let optimal: number = CONFIG.startCount;
	for (let i = 0; i < CONFIG.gateCount; i++) {
		optimal = bestAfterGate(optimal, gateOps[i]);
		for (const plan of CONFIG.enemyPlan) {
			if (plan.afterGate === i) {
				const count = beatableCount(optimal, plan.ratio);
				enemies.push({ afterGate: i, count });
				optimal -= count;
			}
		}
	}
	return { bossCount: beatableCount(optimal, CONFIG.bossRatio), enemies, gateOps };
}

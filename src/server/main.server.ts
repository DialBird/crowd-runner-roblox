/**
 * Crowd Runner サーバー本体。
 * コース生成（道路・ゲート・敵・ゴール）、仲間の追従、勝敗判定を担当する。
 * プレイヤーは自分のアバターで道路を走り、ゲート接触で人数が増減する。
 */
import { CONFIG } from "shared/config";
import { applyOp, clampCount, formatOp, generateCourse, Op, OpKind } from "shared/course";

const Players = game.GetService("Players");
const ReplicatedStorage = game.GetService("ReplicatedStorage");
const RunService = game.GetService("RunService");
const Workspace = game.GetService("Workspace");

const messageEvent = new Instance("RemoteEvent") as RemoteEvent<(text: string) => void>;
messageEvent.Name = "RoundMessage";
messageEvent.Parent = ReplicatedStorage;

const GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5));
const ROAD_TOP_Y = 0.2;
const UNIT_Y = 1.8;
const UNIT_SIZE = new Vector3(1.4, 3, 1.4);

const KIND_COLOR: Record<OpKind, Color3> = {
	add: Color3.fromRGB(46, 204, 113),
	div: Color3.fromRGB(231, 76, 60),
	mul: Color3.fromRGB(52, 152, 219),
	sub: Color3.fromRGB(230, 126, 34),
};

// --- 状態 ---
let crowdCount = 0;
let roundActive = false;
let currentRoot: BasePart | undefined;
let countLabel: TextLabel | undefined;
let courseFolder: Folder | undefined;
const followers = new Array<Part>();

const followersFolder = new Instance("Folder");
followersFolder.Name = "Followers";
followersFolder.Parent = Workspace;

// --- 汎用ヘルパー ---
function makePart(parent: Instance, size: Vector3, position: Vector3, color: Color3, material?: Enum.Material): Part {
	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.Size = size;
	part.Position = position;
	part.Color = color;
	part.Material = material ?? Enum.Material.SmoothPlastic;
	part.TopSurface = Enum.SurfaceType.Smooth;
	part.Parent = parent;
	return part;
}

function makeBillboard(
	parent: BasePart,
	text: string,
	width: number,
	height: number,
	offsetY: number,
	bg?: Color3,
): TextLabel {
	const gui = new Instance("BillboardGui");
	gui.Size = new UDim2(width, 0, height, 0);
	gui.StudsOffset = new Vector3(0, offsetY, 0);
	gui.AlwaysOnTop = true;
	gui.MaxDistance = 500;
	gui.Parent = parent;
	const label = new Instance("TextLabel");
	label.Size = new UDim2(1, 0, 1, 0);
	if (bg) {
		label.BackgroundColor3 = bg;
		label.BackgroundTransparency = 0.25;
	} else {
		label.BackgroundTransparency = 1;
	}
	label.TextColor3 = new Color3(1, 1, 1);
	label.TextStrokeTransparency = 0.2;
	label.TextScaled = true;
	label.Font = Enum.Font.GothamBold;
	label.Text = text;
	label.Parent = gui;
	return label;
}

function isPlayerCharacter(hit: BasePart): boolean {
	const character = hit.Parent;
	if (!character || !character.IsA("Model")) return false;
	return Players.GetPlayerFromCharacter(character) !== undefined;
}

function unitOffset(index: number): Vector3 {
	if (index === 0) return new Vector3(0, 0, 4);
	const radius = 1.4 * math.sqrt(index);
	const angle = index * GOLDEN_ANGLE;
	return new Vector3(math.cos(angle) * radius, 0, math.sin(angle) * radius + 4);
}

// --- 仲間（群衆） ---
function updateCrowd(): void {
	const shown = math.min(crowdCount, CONFIG.maxRenderedUnits);
	while (followers.size() < shown) {
		const part = new Instance("Part");
		part.Anchored = true;
		part.CanCollide = false;
		part.Size = UNIT_SIZE;
		part.Color = Color3.fromRGB(59, 130, 246);
		part.Material = Enum.Material.SmoothPlastic;
		part.Position = new Vector3(0, UNIT_Y, 0);
		part.Parent = followersFolder;
		followers.push(part);
	}
	followers.forEach((part, i) => {
		part.Transparency = i < shown ? 0 : 1;
	});
	if (countLabel) countLabel.Text = `${crowdCount}人`;
}

RunService.Heartbeat.Connect((dt) => {
	const root = currentRoot;
	if (!root) return;
	const shown = math.min(crowdCount, CONFIG.maxRenderedUnits);
	const alpha = math.min(1, dt * 10);
	for (let i = 0; i < shown; i++) {
		const part = followers[i];
		if (!part) break;
		const target = root.CFrame.PointToWorldSpace(unitOffset(i));
		part.Position = part.Position.Lerp(new Vector3(target.X, UNIT_Y, target.Z), alpha);
	}
});

// --- 勝敗 ---
function lose(reason: string): void {
	roundActive = false;
	messageEvent.FireAllClients(`💀 ${reason}`);
	const character = currentRoot?.Parent;
	if (character && character.IsA("Model")) {
		const humanoid = character.FindFirstChildOfClass("Humanoid");
		if (humanoid) humanoid.Health = 0;
	}
}

// --- コース構築 ---
function gateZ(i: number): number {
	return -(CONFIG.firstGateZ + i * CONFIG.gateSpacing);
}

function buildEnemy(parent: Folder, count: number, z: number, isBoss: boolean): void {
	const group = new Instance("Folder");
	group.Name = isBoss ? "Boss" : "Enemy";
	group.Parent = parent;

	const shown = math.min(count, CONFIG.maxRenderedUnits);
	const scale = isBoss ? 1.4 : 1;
	let anchorPart: Part | undefined;
	for (let i = 0; i < shown; i++) {
		const offset = unitOffset(i);
		const part = makePart(
			group,
			UNIT_SIZE.mul(scale),
			new Vector3(offset.X * 1.2, UNIT_Y * scale, z - (offset.Z - 4) * 1.2),
			Color3.fromRGB(231, 76, 60),
		);
		if (i === 0) anchorPart = part;
	}
	if (anchorPart) {
		makeBillboard(anchorPart, `${count}人`, 8, 3, 6, Color3.fromRGB(185, 28, 28));
	}

	const trigger = makePart(group, new Vector3(CONFIG.roadWidth, 10, 2), new Vector3(0, 5, z + 8), new Color3(1, 1, 1));
	trigger.Transparency = 1;
	let triggered = false;
	trigger.Touched.Connect((hit) => {
		if (triggered || !roundActive || !isPlayerCharacter(hit)) return;
		triggered = true;
		if (crowdCount > count) {
			crowdCount -= count;
			updateCrowd();
			group.Destroy();
		} else {
			lose(`${count}人 vs ${crowdCount}人 で押し負けた…`);
		}
	});
}

function buildGatePair(parent: Folder, ops: [Op, Op], z: number, index: number): void {
	const pairFolder = new Instance("Folder");
	pairFolder.Name = `Gate${index}`;
	pairFolder.Parent = parent;
	let consumed = false;
	const half = CONFIG.roadWidth / 2;
	ops.forEach((op, side) => {
		const xCenter = (side === 0 ? -1 : 1) * (half / 2);
		const panel = makePart(
			pairFolder,
			new Vector3(half - 1, 9, 1),
			new Vector3(xCenter, ROAD_TOP_Y + 4.5, z),
			KIND_COLOR[op.kind],
			Enum.Material.Neon,
		);
		panel.Transparency = 0.5;
		makeBillboard(panel, formatOp(op), 8, 3, 7);
		panel.Touched.Connect((hit) => {
			if (consumed || !roundActive || !isPlayerCharacter(hit)) return;
			consumed = true;
			crowdCount = clampCount(applyOp(crowdCount, op));
			updateCrowd();
			if (crowdCount === 0) {
				lose("仲間がいなくなってしまった…");
			}
			pairFolder.Destroy();
		});
	});
}

function buildCourse(): void {
	courseFolder?.Destroy();
	const folder = new Instance("Folder");
	folder.Name = "Course";
	folder.Parent = Workspace;
	courseFolder = folder;

	const course = generateCourse();
	const bossZ = gateZ(CONFIG.gateCount - 1) - CONFIG.bossOffset;
	const goalZ = bossZ - CONFIG.goalOffset;

	// 道路
	const roadLength = -goalZ + 60;
	const road = makePart(
		folder,
		new Vector3(CONFIG.roadWidth, 0.4, roadLength),
		new Vector3(0, ROAD_TOP_Y - 0.2, -(roadLength / 2) + 20),
		Color3.fromRGB(154, 160, 166),
		Enum.Material.Concrete,
	);
	road.CanCollide = true;

	// ゲート・敵・ゴール
	course.gateOps.forEach((ops, i) => buildGatePair(folder, ops, gateZ(i), i));
	for (const enemy of course.enemies) {
		buildEnemy(folder, enemy.count, gateZ(enemy.afterGate) - CONFIG.gateSpacing / 2, false);
	}
	buildEnemy(folder, course.bossCount, bossZ, true);

	const goalPad = makePart(
		folder,
		new Vector3(CONFIG.roadWidth, 0.5, 6),
		new Vector3(0, ROAD_TOP_Y + 0.1, goalZ),
		Color3.fromRGB(255, 224, 102),
		Enum.Material.Neon,
	);
	makeBillboard(goalPad, "GOAL", 10, 4, 8);
	let goalDone = false;
	goalPad.Touched.Connect((hit) => {
		if (goalDone || !roundActive || !isPlayerCharacter(hit)) return;
		goalDone = true;
		roundActive = false;
		messageEvent.FireAllClients(`🎉 ${crowdCount}人でゴール！`);
		task.delay(3, () => {
			const player = Players.GetPlayers()[0];
			player?.LoadCharacter();
		});
	});
}

// --- プレイヤー ---
function onCharacterAdded(character: Model): void {
	const humanoid = character.WaitForChild("Humanoid") as Humanoid;
	const root = character.WaitForChild("HumanoidRootPart") as BasePart;
	const head = character.WaitForChild("Head") as BasePart;
	humanoid.WalkSpeed = CONFIG.walkSpeed;
	currentRoot = root;
	countLabel = makeBillboard(head, "", 6, 2.4, 3, Color3.fromRGB(29, 78, 216));

	// ラウンド開始（リスポーンのたびにコースを作り直す）
	crowdCount = CONFIG.startCount;
	roundActive = true;
	buildCourse();
	updateCrowd();
	for (const part of followers) {
		part.Position = root.Position.add(new Vector3(0, 0, 4));
	}
}

Players.RespawnTime = 2;
Players.PlayerAdded.Connect((player) => {
	player.CharacterAdded.Connect((character) => onCharacterAdded(character));
	if (player.Character) onCharacterAdded(player.Character);
});

print("Crowd Runner server ready");

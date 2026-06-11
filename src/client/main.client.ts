/**
 * Crowd Runner クライアント。
 * サーバーからのラウンド結果メッセージ（クリア / ゲームオーバー）を画面中央に表示する。
 */
const Players = game.GetService("Players");
const ReplicatedStorage = game.GetService("ReplicatedStorage");

const messageEvent = ReplicatedStorage.WaitForChild("RoundMessage") as RemoteEvent<(text: string) => void>;
const playerGui = Players.LocalPlayer.WaitForChild("PlayerGui") as PlayerGui;

const screenGui = new Instance("ScreenGui");
screenGui.ResetOnSpawn = false;
screenGui.Parent = playerGui;

const label = new Instance("TextLabel");
label.AnchorPoint = new Vector2(0.5, 0.5);
label.Position = new UDim2(0.5, 0, 0.35, 0);
label.Size = new UDim2(0.6, 0, 0.12, 0);
label.BackgroundColor3 = new Color3(0, 0, 0);
label.BackgroundTransparency = 0.4;
label.TextColor3 = new Color3(1, 1, 1);
label.TextScaled = true;
label.Font = Enum.Font.GothamBold;
label.Visible = false;
label.Parent = screenGui;

let token = 0;
messageEvent.OnClientEvent.Connect((text) => {
	token += 1;
	const current = token;
	label.Text = text;
	label.Visible = true;
	task.delay(3, () => {
		if (token === current) label.Visible = false;
	});
});

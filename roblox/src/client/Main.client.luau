--!strict
-- Sunset Runner client entry (marker-0098) — keyboard input -> intents, receives
-- per-seat views, and drives the 3D-Parts renderer + chase camera. The server is
-- authoritative (it runs the deterministic reducer); this only sends intents and
-- renders what comes back. Mirrors client/input.js + the render loop of main.js.

local RS = game:GetService("ReplicatedStorage")
local UIS = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local Render = require(script.Parent:WaitForChild("Render"))

print("[SunsetRunner] client script running — waiting for RemoteEvents…")
local inputEvent = RS:WaitForChild("SunsetInput")
local viewEvent = RS:WaitForChild("SunsetView")

Render.init()

local gotFirstView = false
viewEvent.OnClientEvent:Connect(function()
	if not gotFirstView then
		gotFirstView = true
		print("[SunsetRunner] first server view received — race is live")
	end
end)

-- Held input, reduced to the intent the reducer expects. Steer is a signed
-- magnitude (±256 = full lock), matching shared/constants.js STEER_UNIT. Keyboard
-- and on-screen touch controls are merged so either works.
local held = { steer = 0, accel = 0, brake = 0 }
local touch = { steer = 0, accel = 0, brake = 0 } -- set by the mobile buttons

local function computeIntent()
	local left = UIS:IsKeyDown(Enum.KeyCode.A) or UIS:IsKeyDown(Enum.KeyCode.Left)
	local right = UIS:IsKeyDown(Enum.KeyCode.D) or UIS:IsKeyDown(Enum.KeyCode.Right)
	local up = UIS:IsKeyDown(Enum.KeyCode.W) or UIS:IsKeyDown(Enum.KeyCode.Up)
	local down = UIS:IsKeyDown(Enum.KeyCode.S) or UIS:IsKeyDown(Enum.KeyCode.Down)
	local kbSteer = ((right and 1 or 0) - (left and 1 or 0)) * 256
	return {
		steer = (kbSteer ~= 0) and kbSteer or touch.steer,
		accel = math.max(up and 1 or 0, touch.accel),
		brake = math.max(down and 1 or 0, touch.brake),
	}
end

local function sendIfChanged()
	local i = computeIntent()
	if i.steer ~= held.steer or i.accel ~= held.accel or i.brake ~= held.brake then
		held = i
		inputEvent:FireServer(i)
	end
end

-- Pre-race selection (marker-0129): a CENTRED panel shown only during the lobby.
-- Step 1 pick the TRACK, step 2 pick the CAR (miniature previews + ◄ ► arrows +
-- a title), then START to ready-up. Hidden once the race is on.
local Players = game:GetService("Players")
local plr = Players.LocalPlayer
local pgui = plr:WaitForChild("PlayerGui")

local COURSE_NAMES = { "COAST", "CANYON", "MIRROR", "GRAND TOUR" }
local COURSE_COLORS = {
	Color3.fromRGB(40, 150, 180), Color3.fromRGB(200, 120, 60),
	Color3.fromRGB(150, 80, 200), Color3.fromRGB(70, 160, 80),
}
local CAR_NAMES = { "CORSA", "STRADA", "VELOCE", "TARGA" }
local CAR_COLORS = {
	Color3.fromRGB(224, 72, 48), Color3.fromRGB(72, 132, 224),
	Color3.fromRGB(72, 200, 96), Color3.fromRGB(240, 196, 64),
}

local selCar, selCourse = 1, 4
local selSynced = false
local step = "course" -- "course" | "car"

local gui = Instance.new("ScreenGui")
gui.Name = "SunsetUI"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = pgui

local function corner(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end
local function txt(parent, pos, size, aln)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Position, l.Size = pos, size
	l.Font = Enum.Font.GothamBold
	l.TextColor3 = Color3.fromRGB(255, 255, 255)
	l.TextScaled = true
	l.TextXAlignment = aln or Enum.TextXAlignment.Center
	l.Text = ""
	l.Parent = parent
	return l
end
local function button(parent, pos, size, color, text)
	local b = Instance.new("TextButton")
	b.Position, b.Size = pos, size
	b.BackgroundColor3, b.BackgroundTransparency = color, 0.1
	b.TextScaled, b.Font = true, Enum.Font.GothamBold
	b.TextColor3, b.Text, b.BorderSizePixel = Color3.fromRGB(255, 255, 255), text, 0
	b.Parent = parent
	corner(b, 8)
	return b
end

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.new(0.5, 0, 0.46, 0)
panel.Size = UDim2.new(0.52, 0, 0.66, 0)
panel.BackgroundColor3 = Color3.fromRGB(20, 14, 34)
panel.BackgroundTransparency = 0.15
panel.BorderSizePixel = 0
panel.Visible = false
panel.Parent = gui
corner(panel, 14)

local title = txt(panel, UDim2.new(0.05, 0, 0.04, 0), UDim2.new(0.9, 0, 0.12, 0))
title.TextColor3 = Color3.fromRGB(255, 210, 90)
local nameLbl = txt(panel, UDim2.new(0.15, 0, 0.17, 0), UDim2.new(0.7, 0, 0.1, 0))
local hint = txt(panel, UDim2.new(0.05, 0, 0.9, 0), UDim2.new(0.9, 0, 0.06, 0))
hint.TextColor3 = Color3.fromRGB(150, 220, 150)

-- Track thumbnail: biome colour + a stylised road.
local trackThumb = Instance.new("Frame")
trackThumb.AnchorPoint = Vector2.new(0.5, 0.5)
trackThumb.Position = UDim2.new(0.5, 0, 0.5, 0)
trackThumb.Size = UDim2.new(0.52, 0, 0.44, 0)
trackThumb.BorderSizePixel = 0
trackThumb.Parent = panel
corner(trackThumb, 10)
local roadImg = Instance.new("Frame")
roadImg.AnchorPoint = Vector2.new(0.5, 1)
roadImg.Position = UDim2.new(0.5, 0, 1, 0)
roadImg.Size = UDim2.new(0.34, 0, 0.82, 0)
roadImg.BackgroundColor3 = Color3.fromRGB(48, 48, 56)
roadImg.BorderSizePixel = 0
roadImg.Parent = trackThumb
for i = 0, 3 do
	local dash = Instance.new("Frame")
	dash.AnchorPoint = Vector2.new(0.5, 0)
	dash.Position = UDim2.new(0.5, 0, i * 0.26 + 0.05, 0)
	dash.Size = UDim2.new(0.06, 0, 0.12, 0)
	dash.BackgroundColor3 = Color3.fromRGB(255, 214, 60)
	dash.BorderSizePixel = 0
	dash.Parent = roadImg
end

-- Car preview: a rotating 3D car in a ViewportFrame, tinted to the selected colour.
local vp = Instance.new("ViewportFrame")
vp.AnchorPoint = Vector2.new(0.5, 0.5)
vp.Position = UDim2.new(0.5, 0, 0.5, 0)
vp.Size = UDim2.new(0.52, 0, 0.44, 0)
vp.BackgroundColor3 = Color3.fromRGB(28, 22, 42)
vp.BorderSizePixel = 0
vp.Visible = false
vp.Ambient = Color3.fromRGB(180, 170, 190)
vp.LightColor = Color3.fromRGB(255, 244, 230)
vp.LightDirection = Vector3.new(-0.4, -1, -0.6)
vp.Parent = panel
corner(vp, 10)
local vpCam = Instance.new("Camera")
vpCam.Parent = vp
vp.CurrentCamera = vpCam
local vpOrbit = 0
local carModel = Instance.new("Model")
carModel.Parent = vp
local previewBody = {}
local function ppart(size, color, cf, shape, isBody)
	local p = Instance.new("Part")
	p.Size, p.Color, p.CFrame, p.Anchored, p.CanCollide = size, color, cf, true, false
	if shape then
		p.Shape = shape
	end
	p.Parent = carModel
	if isBody then
		table.insert(previewBody, p)
	end
	return p
end
ppart(Vector3.new(6, 1.4, 12), CAR_COLORS[1], CFrame.new(0, 0, 0), nil, true) -- hull
ppart(Vector3.new(4.2, 1.3, 4.2), Color3.fromRGB(28, 28, 34), CFrame.new(0, 1.1, 0.8)) -- cabin
ppart(Vector3.new(4, 0.18, 3), Color3.fromRGB(150, 195, 225), CFrame.new(0, 1.35, -1.2) * CFrame.Angles(math.rad(-32), 0, 0)) -- screen
do
	local hoodW = Instance.new("WedgePart")
	hoodW.Size, hoodW.Anchored, hoodW.CanCollide = Vector3.new(5.4, 1, 4), true, false
	hoodW.CFrame = CFrame.new(0, 0.85, -4)
	hoodW.Parent = carModel
	table.insert(previewBody, hoodW)
end
ppart(Vector3.new(5.8, 0.26, 1.4), Color3.fromRGB(30, 30, 34), CFrame.new(0, 1.35, 5)) -- wing
for _, wx in ipairs({ -3, 3 }) do
	for _, wz in ipairs({ -3.4, 3.4 }) do
		ppart(Vector3.new(1.4, 2.6, 2.6), Color3.fromRGB(22, 22, 26), CFrame.new(wx, -0.9, wz), Enum.PartType.Cylinder)
	end
end

local leftBtn = button(panel, UDim2.new(0.02, 0, 0.45, 0), UDim2.new(0.1, 0, 0.14, 0), Color3.fromRGB(50, 40, 70), "◄")
local rightBtn = button(panel, UDim2.new(0.88, 0, 0.45, 0), UDim2.new(0.1, 0, 0.14, 0), Color3.fromRGB(50, 40, 70), "►")
local backBtn = button(panel, UDim2.new(0.05, 0, 0.79, 0), UDim2.new(0.28, 0, 0.08, 0), Color3.fromRGB(70, 56, 90), "◄ TRACK")
local nextBtn = button(panel, UDim2.new(0.67, 0, 0.79, 0), UDim2.new(0.28, 0, 0.08, 0), Color3.fromRGB(60, 150, 80), "CAR ►")

-- Three steps: TRACK -> CAR -> READY (a race-start screen where all humans press
-- READY). Arrows only on the two pick steps.
local function refreshSelect()
	local arrows = step ~= "ready"
	leftBtn.Visible, rightBtn.Visible = arrows, arrows
	if step == "course" then
		title.Text = "SELECT TRACK"
		nameLbl.Text = COURSE_NAMES[selCourse] or ("COURSE " .. selCourse)
		trackThumb.Visible, vp.Visible = true, false
		trackThumb.BackgroundColor3 = COURSE_COLORS[selCourse] or Color3.fromRGB(60, 60, 80)
		backBtn.Visible = false
		nextBtn.Text = "CAR ►"
	elseif step == "car" then
		title.Text = "SELECT CAR"
		nameLbl.Text = CAR_NAMES[selCar] or ("CAR " .. selCar)
		trackThumb.Visible, vp.Visible = false, true
		for _, bp in ipairs(previewBody) do
			bp.Color = CAR_COLORS[selCar] or Color3.fromRGB(200, 200, 200)
		end
		backBtn.Visible = true
		backBtn.Text = "◄ TRACK"
		nextBtn.Text = "CONFIRM ►"
	else -- ready
		title.Text = "READY TO RACE?"
		nameLbl.Text = "TRACK  " .. (COURSE_NAMES[selCourse] or "?") .. "     CAR  " .. (CAR_NAMES[selCar] or "?")
		trackThumb.Visible, vp.Visible = false, true -- keep the chosen car on show
		backBtn.Visible = true
		backBtn.Text = "◄ CAR"
		nextBtn.Text = "READY ✔"
	end
end
local function cycle(dir)
	if step == "course" then
		selCourse = ((selCourse - 1 + dir) % 4 + 4) % 4 + 1
		inputEvent:FireServer({ select = "course", courseId = selCourse })
	elseif step == "car" then
		selCar = ((selCar - 1 + dir) % 4 + 4) % 4 + 1
		inputEvent:FireServer({ select = "car", carId = selCar })
	end
	refreshSelect()
end
leftBtn.MouseButton1Click:Connect(function()
	cycle(-1)
end)
rightBtn.MouseButton1Click:Connect(function()
	cycle(1)
end)
backBtn.MouseButton1Click:Connect(function()
	step = (step == "ready") and "car" or "course"
	refreshSelect()
end)
nextBtn.MouseButton1Click:Connect(function()
	if step == "course" then
		step = "car"
	elseif step == "car" then
		step = "ready"
	else
		inputEvent:FireServer({ select = "ready" }) -- all humans ready -> server starts
	end
	refreshSelect()
end)
refreshSelect()

-- SPECTATE button (marker-0122): shown once your own race ends; toggles between
-- watching the leader and your own score panel.
local spectateBtn = Instance.new("TextButton")
spectateBtn.Name = "SunsetSpectate"
spectateBtn.AnchorPoint = Vector2.new(0.5, 0.5)
spectateBtn.Position = UDim2.new(0.5, 0, 0.9, 0)
spectateBtn.Size = UDim2.new(0.22, 0, 0.08, 0)
spectateBtn.BackgroundColor3 = Color3.fromRGB(60, 110, 170)
spectateBtn.TextScaled = true
spectateBtn.Font = Enum.Font.GothamBold
spectateBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
spectateBtn.Text = "SPECTATE"
spectateBtn.Visible = false
spectateBtn.Parent = gui
spectateBtn.MouseButton1Click:Connect(function()
	inputEvent:FireServer({ select = "spectate" })
end)

UIS.InputBegan:Connect(function(input, gpe)
	if gpe then
		return
	end
	if input.KeyCode == Enum.KeyCode.Q then
		inputEvent:FireServer({ steer = held.steer, accel = held.accel, brake = held.brake, fork = -1 })
	elseif input.KeyCode == Enum.KeyCode.E then
		inputEvent:FireServer({ steer = held.steer, accel = held.accel, brake = held.brake, fork = 1 })
	else
		sendIfChanged()
	end
end)
UIS.InputEnded:Connect(function(_input, gpe)
	if not gpe then
		sendIfChanged()
	end
end)

viewEvent.OnClientEvent:Connect(function(view)
	Render.update(view)
	if not selSynced and view.car then
		selCar = view.car
		selCourse = view.courseId or selCourse
		refreshSelect()
		selSynced = true
	end
	-- Pre-race panel: lobby only, until you've readied. Reset to the track step once
	-- the race starts so it re-opens at track select for the next race.
	local inLobby = view.phase == "lobby"
	panel.Visible = inLobby and not view.ready
	if inLobby then
		hint.Text = "LOBBY  " .. (view.lobbyIn or 0) .. "s    " .. (view.readyCount or 0) .. "/" .. (view.playerCount or 0) .. " ready"
	elseif step ~= "course" then
		step = "course"
		refreshSelect()
	end
	spectateBtn.Visible = view.raceOver == true
	spectateBtn.Text = view.watching and "MY SCORE" or "SPECTATE"
end)

RunService.RenderStepped:Connect(function(dt)
	Render.step(dt) -- interpolate + render at ~60 fps from the 20 Hz views
	workspace.CurrentCamera.CFrame = Render.cameraCFrame()
	if vp.Visible then -- orbit the car preview
		vpOrbit += dt * 0.7
		local r = 17
		vpCam.CFrame = CFrame.lookAt(Vector3.new(math.sin(vpOrbit) * r, 6, math.cos(vpOrbit) * r), Vector3.new(0, 0.4, 0))
	end
end)

-- On-screen touch controls (marker-0111): steer pad bottom-left, gas/brake
-- bottom-right, fork buttons top corners. Only built on touch devices.
if UIS.TouchEnabled then
	local gui = Instance.new("ScreenGui")
	gui.Name = "SunsetTouch"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")

	local function btn(text, pos, size, color)
		local b = Instance.new("TextButton")
		b.Position = pos
		b.Size = size
		b.BackgroundColor3 = color
		b.BackgroundTransparency = 0.35
		b.AutoButtonColor = true
		b.Text = text
		b.TextScaled = true
		b.Font = Enum.Font.GothamBold
		b.TextColor3 = Color3.fromRGB(255, 255, 255)
		b.Parent = gui
		return b
	end
	local function hold(b, onDown, onUp)
		b.MouseButton1Down:Connect(function()
			onDown()
			sendIfChanged()
		end)
		b.MouseButton1Up:Connect(function()
			onUp()
			sendIfChanged()
		end)
	end

	local steerCol = Color3.fromRGB(60, 90, 150)
	local goCol = Color3.fromRGB(60, 150, 80)
	local stopCol = Color3.fromRGB(160, 60, 60)
	local forkCol = Color3.fromRGB(120, 90, 160)

	local bl = btn("◄", UDim2.new(0.02, 0, 0.66, 0), UDim2.new(0.13, 0, 0.16, 0), steerCol)
	local br = btn("►", UDim2.new(0.17, 0, 0.66, 0), UDim2.new(0.13, 0, 0.16, 0), steerCol)
	local gas = btn("▲", UDim2.new(0.85, 0, 0.62, 0), UDim2.new(0.13, 0, 0.16, 0), goCol)
	local brk = btn("▼", UDim2.new(0.7, 0, 0.62, 0), UDim2.new(0.13, 0, 0.16, 0), stopCol)
	local fl = btn("Q", UDim2.new(0.02, 0, 0.04, 0), UDim2.new(0.1, 0, 0.11, 0), forkCol)
	local fr = btn("E", UDim2.new(0.88, 0, 0.04, 0), UDim2.new(0.1, 0, 0.11, 0), forkCol)

	hold(bl, function() touch.steer = -256 end, function() if touch.steer < 0 then touch.steer = 0 end end)
	hold(br, function() touch.steer = 256 end, function() if touch.steer > 0 then touch.steer = 0 end end)
	hold(gas, function() touch.accel = 1 end, function() touch.accel = 0 end)
	hold(brk, function() touch.brake = 1 end, function() touch.brake = 0 end)
	fl.MouseButton1Down:Connect(function()
		inputEvent:FireServer({ steer = held.steer, accel = held.accel, brake = held.brake, fork = -1 })
	end)
	fr.MouseButton1Down:Connect(function()
		inputEvent:FireServer({ steer = held.steer, accel = held.accel, brake = held.brake, fork = 1 })
	end)
end

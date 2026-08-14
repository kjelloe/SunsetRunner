--!strict
-- Sunset Runner client entry (marker-0098) — keyboard input -> intents, receives
-- per-seat views, and drives the 3D-Parts renderer + chase camera. The server is
-- authoritative (it runs the deterministic reducer); this only sends intents and
-- renders what comes back. Mirrors client/input.js + the render loop of main.js.

local RS = game:GetService("ReplicatedStorage")
local UIS = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local Render = require(script.Parent:WaitForChild("Render"))

-- Course data for the top-down track thumbnail (marker-0135).
local Shared = RS:WaitForChild("Shared")
local GameData = RS:WaitForChild("GameData")
local roadData = require(Shared:WaitForChild("road_data"))
local courseSet = roadData.loadCourseSet(require(GameData:WaitForChild("roads")))

-- Walk the default path of a course accumulating the lateral curve (double integral,
-- same as the road renderer) to get a top-down (lateral X vs forward Z) polyline,
-- downsampled to ~70 points and normalised to 0..1.
local function coursePath(courseId: number)
	local raw = {}
	local ok, startId = pcall(function()
		return roadData.getCourse(courseSet, courseId).startSegment
	end)
	if not ok then
		return raw
	end
	local id = startId
	local curveX, curveDx, dz = 0, 0, 0
	local guard = 0
	while id and id ~= -1 and guard < 4000 do
		local seg = roadData.getSegment(courseSet, id)
		local cm = #seg.curveProfile
		for s = 0, seg.stripCount - 1 do
			local curve = seg.curveProfile[math.floor(s * cm / seg.stripCount) + 1] or 0
			curveDx += curve
			curveX += curveDx
			dz += 1
			if dz % 30 == 0 then
				table.insert(raw, { curveX, dz })
			end
		end
		id = roadData.nextSegment(courseSet, id, 0)
		guard += 1
	end
	if #raw < 2 then
		return raw
	end
	local step = math.max(1, math.floor(#raw / 70))
	local pts, minX, maxX = {}, math.huge, -math.huge
	for i = 1, #raw, step do
		table.insert(pts, raw[i])
		minX = math.min(minX, raw[i][1])
		maxX = math.max(maxX, raw[i][1])
	end
	local spanX = math.max(1, maxX - minX)
	local spanZ = math.max(1, pts[#pts][2])
	for _, p in ipairs(pts) do
		p[1] = (p[1] - minX) / spanX -- 0..1 left/right
		p[2] = p[2] / spanZ -- 0..1 start..finish
	end
	return pts
end

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

-- Track thumbnail: biome colour + a TOP-DOWN snapshot of the actual course curve.
local trackThumb = Instance.new("Frame")
trackThumb.AnchorPoint = Vector2.new(0.5, 0.5)
trackThumb.Position = UDim2.new(0.5, 0, 0.5, 0)
trackThumb.Size = UDim2.new(0.52, 0, 0.44, 0)
trackThumb.BorderSizePixel = 0
trackThumb.Parent = panel
corner(trackThumb, 10)
local pathHolder = Instance.new("Frame")
pathHolder.BackgroundTransparency = 1
pathHolder.Size = UDim2.new(0.86, 0, 0.86, 0)
pathHolder.Position = UDim2.new(0.07, 0, 0.07, 0)
pathHolder.Parent = trackThumb
local pathCourse = -1 -- last course whose path was drawn (rebuild-gated)
local function drawTrackPath(courseId)
	if courseId == pathCourse then
		return
	end
	pathCourse = courseId
	pathHolder:ClearAllChildren()
	local pts = coursePath(courseId)
	-- plot forward (Z) UP the thumbnail (finish at top), curve left/right by X
	for _, p in ipairs(pts) do
		local dot = Instance.new("Frame")
		dot.AnchorPoint = Vector2.new(0.5, 0.5)
		dot.Position = UDim2.new(p[1], 0, 1 - p[2], 0)
		dot.Size = UDim2.new(0, 7, 0, 7)
		dot.BackgroundColor3 = Color3.fromRGB(245, 245, 250)
		dot.BorderSizePixel = 0
		dot.Parent = pathHolder
		corner(dot, 4)
	end
	if #pts > 0 then -- start (green) and finish (chequered-ish white) markers
		local function marker(p, col, sz)
			local m = Instance.new("Frame")
			m.AnchorPoint = Vector2.new(0.5, 0.5)
			m.Position = UDim2.new(p[1], 0, 1 - p[2], 0)
			m.Size = UDim2.new(0, sz, 0, sz)
			m.BackgroundColor3 = col
			m.BorderSizePixel = 0
			m.Parent = pathHolder
			corner(m, 3)
		end
		marker(pts[1], Color3.fromRGB(80, 220, 100), 12)
		marker(pts[#pts], Color3.fromRGB(255, 220, 74), 12)
	end
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
vpCam.FieldOfView = 40 -- narrower = the car fills the frame (was tiny at default 70)
vpCam.Parent = vp
vp.CurrentCamera = vpCam
local vpOrbit = 0
local carModel = Instance.new("Model")
carModel.Parent = vp
-- The preview mirrors the in-race sculpted supercar (makeCarRig variant 3) so what
-- you pick is what you drive. L/rideY match that rig.
local previewBody = {}
local PL, PRIDE = 12.0, -0.15
local PBW = 1.16 -- widen in X to match the in-race car (marker-0151)
local function ppart(size, color, cf, shape, isBody, material)
	local p = Instance.new("Part")
	size = Vector3.new(size.X * PBW, size.Y, size.Z)
	local pos = cf.Position
	cf = CFrame.new(pos.X * PBW, pos.Y, pos.Z) * cf.Rotation
	p.Size, p.Color, p.CFrame, p.Anchored, p.CanCollide = size, color, cf, true, false
	p.Material = material or Enum.Material.SmoothPlastic
	if shape then
		p.Shape = shape
	end
	p.Parent = carModel
	if isBody then
		table.insert(previewBody, p)
	end
	return p
end
local function pwedge(size, cf, isBody)
	local p = Instance.new("WedgePart")
	size = Vector3.new(size.X * PBW, size.Y, size.Z)
	local pos = cf.Position
	cf = CFrame.new(pos.X * PBW, pos.Y, pos.Z) * cf.Rotation
	p.Size, p.Anchored, p.CanCollide, p.CFrame = size, true, false, cf
	p.Color = CAR_COLORS[1]
	p.Parent = carModel
	if isBody then
		table.insert(previewBody, p)
	end
	return p
end
local trim = Color3.fromRGB(30, 30, 36)
local glassC = Color3.fromRGB(150, 195, 225)
ppart(Vector3.new(6.2, 1.5, PL), CAR_COLORS[1], CFrame.new(0, PRIDE, 0), nil, true) -- hull
ppart(Vector3.new(4.3, 1.15, 4.4), trim, CFrame.new(0, PRIDE + 1.15, 0.4)) -- cabin
pwedge(Vector3.new(5.7, 1.0, PL * 0.34), CFrame.new(0, PRIDE + 0.85, -PL * 0.28), true) -- hood
pwedge(Vector3.new(4.3, 1.15, PL * 0.3), CFrame.new(0, PRIDE + 1.1, 0.4 + PL * 0.24) * CFrame.Angles(0, math.rad(180), 0)) -- fastback
ppart(Vector3.new(4.0, 0.18, 2.7), glassC, CFrame.new(0, PRIDE + 1.55, -1.8) * CFrame.Angles(math.rad(-32), 0, 0)) -- screen
ppart(Vector3.new(6.3, 0.5, PL * 0.9), trim, CFrame.new(0, PRIDE - 0.55, 0)) -- belt
ppart(Vector3.new(0.4, 0.5, PL * 0.7), Color3.fromRGB(24, 24, 28), CFrame.new(-3.05, PRIDE - 0.5, 0.3)) -- skirt
ppart(Vector3.new(0.4, 0.5, PL * 0.7), Color3.fromRGB(24, 24, 28), CFrame.new(3.05, PRIDE - 0.5, 0.3))
pwedge(Vector3.new(1.3, 0.9, 3.2), CFrame.new(-2.7, PRIDE + 0.35, PL * 0.22) * CFrame.Angles(0, math.rad(180), 0), true) -- haunch
pwedge(Vector3.new(1.3, 0.9, 3.2), CFrame.new(2.7, PRIDE + 0.35, PL * 0.22) * CFrame.Angles(0, math.rad(180), 0), true)
ppart(Vector3.new(6, 0.3, 1.1), Color3.fromRGB(28, 28, 32), CFrame.new(0, PRIDE - 0.75, -PL * 0.5 + 0.4)) -- splitter
ppart(Vector3.new(1.3, 0.45, 0.35), Color3.fromRGB(255, 248, 220), CFrame.new(-1.9, PRIDE + 0.15, -PL * 0.5 + 0.2), nil, false, Enum.Material.Neon) -- headlights
ppart(Vector3.new(1.3, 0.45, 0.35), Color3.fromRGB(255, 248, 220), CFrame.new(1.9, PRIDE + 0.15, -PL * 0.5 + 0.2), nil, false, Enum.Material.Neon)
ppart(Vector3.new(5.2, 0.45, 0.3), Color3.fromRGB(235, 42, 42), CFrame.new(0, PRIDE + 0.35, PL * 0.5 - 0.2), nil, false, Enum.Material.Neon) -- tail bar
ppart(Vector3.new(6.0, 0.28, 1.5), trim, CFrame.new(0, PRIDE + 1.6, PL * 0.45)) -- wing
ppart(Vector3.new(0.4, 1.1, 0.5), Color3.fromRGB(28, 28, 32), CFrame.new(-2.4, PRIDE + 0.9, PL * 0.45))
ppart(Vector3.new(0.4, 1.1, 0.5), Color3.fromRGB(28, 28, 32), CFrame.new(2.4, PRIDE + 0.9, PL * 0.45))
ppart(Vector3.new(0.5, 0.4, 1.0), trim, CFrame.new(-3.0, PRIDE + 1.15, 0.4 - 2.3)) -- wing mirrors
ppart(Vector3.new(0.5, 0.4, 1.0), trim, CFrame.new(3.0, PRIDE + 1.15, 0.4 - 2.3))
ppart(Vector3.new(1.6, 0.14, 2.4), Color3.fromRGB(28, 28, 32), CFrame.new(0, PRIDE + 1.0, -PL * 0.26)) -- hood vent
ppart(Vector3.new(0.7, 0.5, 0.5), Color3.fromRGB(70, 70, 78), CFrame.new(-1.3, PRIDE - 0.7, PL * 0.5 + 0.1), Enum.PartType.Cylinder) -- exhausts
ppart(Vector3.new(0.7, 0.5, 0.5), Color3.fromRGB(70, 70, 78), CFrame.new(1.3, PRIDE - 0.7, PL * 0.5 + 0.1), Enum.PartType.Cylinder)
for _, wx in ipairs({ -3.05, 3.05 }) do
	for _, wz in ipairs({ -PL * 0.3, PL * 0.3 }) do
		ppart(Vector3.new(1.5, 2.7, 2.7), Color3.fromRGB(22, 22, 26), CFrame.new(wx, PRIDE - 0.85, wz), Enum.PartType.Cylinder)
		ppart(Vector3.new(1.55, 1.2, 1.2), Color3.fromRGB(180, 182, 190), CFrame.new(wx, PRIDE - 0.85, wz), Enum.PartType.Cylinder)
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
		drawTrackPath(selCourse)
		backBtn.Visible = false
		nextBtn.Text = "CONFIRM TRACK ►"
	elseif step == "car" then
		title.Text = "SELECT CAR"
		nameLbl.Text = CAR_NAMES[selCar] or ("CAR " .. selCar)
		trackThumb.Visible, vp.Visible = false, true
		for _, bp in ipairs(previewBody) do
			bp.Color = CAR_COLORS[selCar] or Color3.fromRGB(200, 200, 200)
		end
		backBtn.Visible = true
		backBtn.Text = "◄ TRACK"
		nextBtn.Text = "CONFIRM CAR ►"
	else -- ready / race lineup
		title.Text = "RACE LINEUP"
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
	if vp.Visible then -- orbit the car preview (close + narrow FOV so it fills the frame)
		vpOrbit += dt * 0.7
		local r = 15
		vpCam.CFrame = CFrame.lookAt(Vector3.new(math.sin(vpOrbit) * r, 4.5, math.cos(vpOrbit) * r), Vector3.new(0, 0.3, 0))
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

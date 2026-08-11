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

-- Car + course select (marker-0115): cycle buttons top-left. Car applies to your
-- seat now (and each race); course is the SHARED course, applied at the next race.
local selCar, selCourse = 1, 4
local selSynced = false
local COURSE_NAMES = { "COAST", "CANYON", "MIRROR", "GRAND TOUR" }
local carLbl: TextButton? = nil
local courseLbl: TextButton? = nil
local function refreshSelect()
	if carLbl then
		carLbl.Text = "CAR " .. selCar
	end
	if courseLbl then
		courseLbl.Text = COURSE_NAMES[selCourse] or ("COURSE " .. selCourse)
	end
end
do
	local gui = Instance.new("ScreenGui")
	gui.Name = "SunsetSelect"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")
	local function b(text, x, y, w)
		local btn = Instance.new("TextButton")
		btn.Position = UDim2.new(x, 0, y, 0)
		btn.Size = UDim2.new(w, 0, 0.06, 0)
		btn.BackgroundColor3 = Color3.fromRGB(40, 30, 60)
		btn.BackgroundTransparency = 0.35
		btn.TextScaled = true
		btn.Font = Enum.Font.GothamBold
		btn.TextColor3 = Color3.fromRGB(255, 255, 255)
		btn.Text = text
		btn.Parent = gui
		return btn
	end
	local function mkRow(y, onChange)
		b("◄", 0.02, y, 0.045).MouseButton1Click:Connect(function()
			onChange(-1)
		end)
		local lbl = b("", 0.07, y, 0.17)
		b("►", 0.25, y, 0.045).MouseButton1Click:Connect(function()
			onChange(1)
		end)
		return lbl
	end
	carLbl = mkRow(0.17, function(dir)
		selCar = ((selCar - 1 + dir) % 4 + 4) % 4 + 1
		refreshSelect()
		inputEvent:FireServer({ select = "car", carId = selCar })
	end)
	courseLbl = mkRow(0.25, function(dir)
		selCourse = ((selCourse - 1 + dir) % 4 + 4) % 4 + 1
		refreshSelect()
		inputEvent:FireServer({ select = "course", courseId = selCourse })
	end)
	refreshSelect()
end

-- READY button (marker-0116): shown only in the lobby; starts sooner when everyone
-- is ready (else the lobby timer starts it).
local readyBtn = Instance.new("TextButton")
readyBtn.Name = "SunsetReady"
readyBtn.AnchorPoint = Vector2.new(0.5, 0.5)
readyBtn.Position = UDim2.new(0.5, 0, 0.86, 0)
readyBtn.Size = UDim2.new(0.22, 0, 0.09, 0)
readyBtn.BackgroundColor3 = Color3.fromRGB(60, 160, 80)
readyBtn.TextScaled = true
readyBtn.Font = Enum.Font.GothamBold
readyBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
readyBtn.Text = "READY"
readyBtn.Visible = false
do
	local g = Instance.new("ScreenGui")
	g.Name = "SunsetReadyGui"
	g.ResetOnSpawn = false
	g.IgnoreGuiInset = true
	g.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")
	readyBtn.Parent = g
end
readyBtn.MouseButton1Click:Connect(function()
	inputEvent:FireServer({ select = "ready" })
end)

-- SPECTATE button (marker-0122): shown once your own race ends (finished / timed
-- out). Toggles between watching the leader race and your own score panel, so you
-- are never just frozen at time 0 waiting for the AI field to finish.
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
spectateBtn.Parent = readyBtn.Parent
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
	readyBtn.Visible = view.phase == "lobby" and not view.ready
	spectateBtn.Visible = view.raceOver == true
	spectateBtn.Text = view.watching and "MY SCORE" or "SPECTATE"
end)

RunService.RenderStepped:Connect(function(dt)
	Render.step(dt) -- interpolate + render at ~60 fps from the 20 Hz views
	workspace.CurrentCamera.CFrame = Render.cameraCFrame()
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

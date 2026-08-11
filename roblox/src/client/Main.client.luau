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

-- Held-key input, reduced to the intent the reducer expects. Steer is a signed
-- magnitude (±256 = full lock), matching shared/constants.js STEER_UNIT.
local held = { steer = 0, accel = 0, brake = 0 }

local function computeIntent()
	local left = UIS:IsKeyDown(Enum.KeyCode.A) or UIS:IsKeyDown(Enum.KeyCode.Left)
	local right = UIS:IsKeyDown(Enum.KeyCode.D) or UIS:IsKeyDown(Enum.KeyCode.Right)
	local up = UIS:IsKeyDown(Enum.KeyCode.W) or UIS:IsKeyDown(Enum.KeyCode.Up)
	local down = UIS:IsKeyDown(Enum.KeyCode.S) or UIS:IsKeyDown(Enum.KeyCode.Down)
	return {
		steer = ((right and 1 or 0) - (left and 1 or 0)) * 256,
		accel = up and 1 or 0,
		brake = down and 1 or 0,
	}
end

local function sendIfChanged()
	local i = computeIntent()
	if i.steer ~= held.steer or i.accel ~= held.accel or i.brake ~= held.brake then
		held = i
		inputEvent:FireServer(i)
	end
end

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
end)

RunService.RenderStepped:Connect(function(dt)
	Render.step(dt) -- interpolate + render at ~60 fps from the 20 Hz views
	workspace.CurrentCamera.CFrame = Render.cameraCFrame()
end)

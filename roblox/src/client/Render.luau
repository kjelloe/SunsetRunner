--!strict
-- Sunset Runner client renderer (marker-0098) — a 3D-Parts "treadmill": the car
-- stays near the origin and the road/traffic/pads scroll toward it, built from the
-- SAME course data (ReplicatedStorage.GameData) the engine uses. Presentation only.

local RS = game:GetService("ReplicatedStorage")
local Shared = RS:WaitForChild("Shared")
local GameData = RS:WaitForChild("GameData")

local road = require(Shared:WaitForChild("road_data"))
local constants = require(Shared:WaitForChild("constants"))
local ROAD_UNIT = constants.ROAD_UNIT

local courseSet = road.loadCourseSet(require(GameData:WaitForChild("roads")))
-- Same per-biome palettes the browser uses (data/scenery.json), read raw.
local sceneryCfg = require(GameData:WaitForChild("scenery"))

local function hexToColor3(hex)
	if type(hex) ~= "string" then
		return nil
	end
	hex = string.gsub(hex, "#", "")
	local r = tonumber(string.sub(hex, 1, 2), 16) or 0
	local g = tonumber(string.sub(hex, 3, 4), 16) or 0
	local b = tonumber(string.sub(hex, 5, 6), 16) or 0
	return Color3.fromRGB(r, g, b)
end

local function themeFor(scenerySet: number)
	local themes = sceneryCfg.themes or {}
	return themes[tostring(scenerySet)] or themes[tostring(sceneryCfg.default or 1)] or {}
end

-- Engine-units -> studs.
local SX = 14 / 256 -- lateral (one lane = 14 studs)
local SZ = 9 / 256 -- forward depth per road unit
local SY = 0.7 -- hill height
local ROAD_HALF = 512 -- engine off-road edge
local N = 80 -- strips drawn ahead
local STRIP_LEN = ROAD_UNIT * SZ
local BASE_Y = 50 -- lift the whole world above any baseplate so it's clearly visible

local Render = {}
local strips: { Part } = {}
local traffic: { Part } = {}
local pads: { Part } = {}
local ghosts: { Part } = {}
local ghostTags: { TextLabel } = {}
local dashes: { Part } = {} -- scrolling centre-line dashes (speed cue)
local props: { Part } = {} -- pooled roadside scenery
local ground: Part
local car: Part

local DASH_SPACING = ROAD_UNIT * 3 -- one centre dash every 3 road units
local PROP_SPACING = ROAD_UNIT * 6 -- a roadside prop slot every 6 road units
local hud: { speed: TextLabel, timer: TextLabel, banner: TextLabel }

-- Accumulate curve (double integral, like the browser road renderer) + read hill,
-- walking segments forward from the seat's position. Presentation-only shape.
local function buildStrips(segmentId: number, roadZ: number, count: number, forkChoice: number)
	local out = {}
	if segmentId == -1 then
		return out
	end
	local segId, seg = segmentId, road.getSegment(courseSet, segmentId)
	local stripIdx = math.floor(roadZ / ROAD_UNIT)
	local curveX, curveDx = 0, 0
	for k = 1, count do
		while stripIdx >= seg.stripCount do
			local nxt = road.nextSegment(courseSet, segId, forkChoice or 0)
			if nxt == -1 then
				return out
			end
			segId, seg, stripIdx = nxt, road.getSegment(courseSet, nxt), 0
		end
		local cm, hm = #seg.curveProfile, #seg.hillProfile
		local curve = seg.curveProfile[math.floor(stripIdx * cm / seg.stripCount) + 1] or 0
		local hill = seg.hillProfile[math.floor(stripIdx * hm / seg.stripCount) + 1] or 0
		curveDx += curve
		curveX += curveDx
		out[k] = { curveX = curveX, hill = hill, dz = (k - 1) * ROAD_UNIT, seg = seg }
		stripIdx += 1
	end
	return out
end

local function mkPart(name, size, color, parent, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Size = size
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Parent = parent
	return p
end

-- Sunset mood (marker-0102): warm dusk lighting + haze, no textures. Global +
-- one-time; fog fades the end of the treadmill draw distance into the horizon.
local function setupLighting()
	local L = game:GetService("Lighting")
	L.ClockTime = 17.3
	L.GeographicLatitude = 20
	L.Brightness = 2.4
	L.Ambient = Color3.fromRGB(74, 56, 66)
	L.OutdoorAmbient = Color3.fromRGB(158, 112, 92)
	L.FogColor = Color3.fromRGB(255, 150, 104)
	L.FogStart = 340
	L.FogEnd = 720 -- == N strips * STRIP_LEN, so the road fades right at the horizon
	L.EnvironmentDiffuseScale = 0.4
	L.EnvironmentSpecularScale = 0.35
	local atmo = L:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmo.Density = 0.34
	atmo.Offset = 0.2
	atmo.Color = Color3.fromRGB(220, 152, 112)
	atmo.Decay = Color3.fromRGB(255, 120, 80)
	atmo.Glare = 0.35
	atmo.Haze = 2
	atmo.Parent = L
	local cc = L:FindFirstChildOfClass("ColorCorrectionEffect") or Instance.new("ColorCorrectionEffect")
	cc.TintColor = Color3.fromRGB(255, 236, 222)
	cc.Saturation = 0.08
	cc.Contrast = 0.06
	cc.Parent = L
end

function Render.init()
	setupLighting()
	local world = Instance.new("Folder")
	world.Name = "SunsetWorld"
	world.Parent = workspace

	-- A big biome-coloured ground plane under the road (recoloured per segment).
	ground = mkPart("ground", Vector3.new(4000, 2, 4000), Color3.fromRGB(47, 120, 60), world, Enum.Material.Grass)
	ground.CFrame = CFrame.new(0, BASE_Y - 2.2, -300)

	local roadW = ROAD_HALF * 2 * SX
	for k = 1, N do
		local shade = (k % 2 == 0) and Color3.fromRGB(58, 58, 66) or Color3.fromRGB(48, 48, 56)
		strips[k] = mkPart("strip", Vector3.new(roadW, 1, STRIP_LEN + 0.4), shade, world)
	end
	for i = 1, 14 do
		local t = mkPart("traffic", Vector3.new(6, 3, 10), Color3.fromRGB(224, 192, 64), world)
		t.Transparency = 1
		traffic[i] = t
	end
	for i = 1, 8 do
		local p = mkPart("pad", Vector3.new(roadW * 0.5, 0.4, 6), Color3.fromRGB(40, 224, 255), world, Enum.Material.Neon)
		p.Transparency = 1
		pads[i] = p
	end
	for i = 1, 28 do
		local d = mkPart("dash", Vector3.new(2, 0.3, 8), Color3.fromRGB(240, 240, 220), world)
		d.Transparency = 1
		dashes[i] = d
	end
	for i = 1, 24 do
		local pr = mkPart("prop", Vector3.new(8, 12, 8), Color3.fromRGB(60, 120, 60), world)
		pr.Shape = Enum.PartType.Ball -- foliage/rock blob, recoloured + scaled per slot
		pr.Transparency = 1
		props[i] = pr
	end
	local RIVAL_COLORS = { Color3.fromRGB(224, 72, 48), Color3.fromRGB(72, 132, 224), Color3.fromRGB(72, 200, 96), Color3.fromRGB(224, 192, 64) }
	for i = 1, 8 do
		local gp = mkPart("rival", Vector3.new(7, 3.5, 12), RIVAL_COLORS[(i % 4) + 1], world)
		gp.Transparency = 1
		ghosts[i] = gp
		local bb = Instance.new("BillboardGui")
		bb.Size = UDim2.new(0, 100, 0, 26)
		bb.StudsOffset = Vector3.new(0, 3, 0)
		bb.AlwaysOnTop = true
		bb.Adornee = gp
		bb.Parent = gp
		local tl = Instance.new("TextLabel")
		tl.BackgroundTransparency = 1
		tl.Size = UDim2.new(1, 0, 1, 0)
		tl.Font = Enum.Font.GothamBold
		tl.TextColor3 = Color3.fromRGB(255, 255, 255)
		tl.TextStrokeTransparency = 0.3
		tl.TextScaled = true
		tl.Text = ""
		tl.Parent = bb
		ghostTags[i] = tl
	end
	car = mkPart("car", Vector3.new(7, 3.5, 12), Color3.fromRGB(224, 72, 48), world)

	local gui = Instance.new("ScreenGui")
	gui.Name = "SunsetHUD"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")
	local function label(pos, size, aln, sz)
		local l = Instance.new("TextLabel")
		l.BackgroundTransparency = 1
		l.Position = pos
		l.Size = size
		l.Font = Enum.Font.GothamBold
		l.TextColor3 = Color3.fromRGB(255, 255, 255)
		l.TextStrokeTransparency = 0.4
		l.TextScaled = true
		l.TextXAlignment = aln
		l.Text = ""
		l.Parent = gui
		return l
	end
	hud = {
		speed = label(UDim2.new(0.62, 0, 0.82, 0), UDim2.new(0.36, 0, 0.14, 0), Enum.TextXAlignment.Right),
		timer = label(UDim2.new(0.02, 0, 0.03, 0), UDim2.new(0.3, 0, 0.1, 0), Enum.TextXAlignment.Left),
		banner = label(UDim2.new(0.25, 0, 0.4, 0), UDim2.new(0.5, 0, 0.12, 0), Enum.TextXAlignment.Center),
	}

	-- Lay a straight flat road immediately so SOMETHING is visible before the first
	-- server view arrives (a straight road that never moves = server not sending;
	-- an empty world = this script never ran).
	for k = 1, N do
		strips[k].CFrame = CFrame.new(0, BASE_Y, -(k - 1) * STRIP_LEN)
	end
	car.CFrame = CFrame.new(0, BASE_Y + 2.2, 4)
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Scriptable
	cam.CFrame = CFrame.lookAt(Vector3.new(0, BASE_Y + 7, 17), Vector3.new(0, BASE_Y + 2, -40))
	print("[SunsetRunner] client render initialised — road built at y=" .. BASE_Y)
end

-- Reposition everything from a fresh view. Returns the car's world position so the
-- camera loop can follow it every RenderStepped (smoother than the 20 Hz updates).
function Render.update(view)
	local seat = view.seat
	local built = buildStrips(seat.segmentId, seat.roadZ, N, seat.forkChoice)

	-- Recolour the ground to the current segment's biome (grass/sand/snow/etc).
	if seat.segmentId ~= -1 then
		local theme = themeFor(road.getSegment(courseSet, seat.segmentId).scenerySet)
		ground.Color = hexToColor3(theme.grassA) or Color3.fromRGB(47, 120, 60)
	end
	local gc = ground.Color
	local foliage = Color3.new(gc.R * 0.5, gc.G * 0.7, gc.B * 0.5) -- roadside greenery from the biome
	local drawDz = (N - 1) * ROAD_UNIT

	-- Road strips, with a scrolling asphalt band pattern so the surface reads speed.
	local bandPhase = math.floor(seat.roadZ / ROAD_UNIT)
	for k = 1, N do
		local s = built[k]
		local p = strips[k]
		if s then
			p.Transparency = 0
			p.Color = ((bandPhase + k) % 2 == 0) and Color3.fromRGB(54, 54, 62) or Color3.fromRGB(44, 44, 52)
			p.CFrame = CFrame.new(s.curveX * SX, BASE_Y + s.hill * SY, -s.dz * SZ)
		else
			p.Transparency = 1
		end
	end

	-- Scrolling centre-line dashes (the clearest speed cue).
	local dashOff = seat.roadZ % DASH_SPACING
	for i = 1, #dashes do
		local d = (i - 1) * DASH_SPACING - dashOff
		if d >= 0 and d <= drawDz then
			local s = built[math.min(math.floor(d / ROAD_UNIT) + 1, N)]
			if s then
				dashes[i].Transparency = 0
				dashes[i].CFrame = CFrame.new(s.curveX * SX, BASE_Y + s.hill * SY + 0.6, -d * SZ)
			else
				dashes[i].Transparency = 1
			end
		else
			dashes[i].Transparency = 1
		end
	end

	-- Pooled roadside props (foliage / rocks), stable per world slot so they don't jitter.
	local roadEdge = ROAD_HALF * SX + 6
	local propOff = seat.roadZ % PROP_SPACING
	local baseSlot = math.floor(seat.roadZ / PROP_SPACING)
	for i = 1, #props do
		local pr = props[i]
		local d = (i - 1) * PROP_SPACING - propOff
		if d >= 0 and d <= drawDz then
			local s = built[math.min(math.floor(d / ROAD_UNIT) + 1, N)]
			if s then
				local worldSlot = baseSlot + (i - 1)
				local side = if worldSlot % 2 == 0 then -1 else 1
				pr.Transparency = 0
				if worldSlot % 3 == 0 then
					pr.Color = Color3.fromRGB(120, 116, 110) -- rock
					pr.Size = Vector3.new(7, 4, 7)
				else
					pr.Color = foliage
					pr.Size = Vector3.new(8, 12, 8)
				end
				pr.CFrame = CFrame.new(s.curveX * SX + side * roadEdge, BASE_Y + s.hill * SY + pr.Size.Y / 2, -d * SZ)
			else
				pr.Transparency = 1
			end
		else
			pr.Transparency = 1
		end
	end

	local near = built[1]
	local baseHill = near and near.hill * SY or 0
	local carX = seat.laneX * SX
	local boosting = seat.boostTicks > 0
	car.Color = boosting and Color3.fromRGB(120, 240, 255)
		or (seat.crashedTicks > 0 and Color3.fromRGB(255, 255, 255) or Color3.fromRGB(224, 72, 48))
	car.CFrame = CFrame.new(carX, BASE_Y + baseHill + 2.2, 4)

	-- Same-segment traffic ahead.
	local ti = 0
	for _, t in ipairs(view.traffic) do
		local dz = t.roadZ - seat.roadZ
		if dz >= 0 then
			local k = math.floor(dz / ROAD_UNIT) + 1
			local s = built[math.min(k, N)]
			if s and ti < #traffic then
				ti += 1
				local part = traffic[ti]
				part.Transparency = 0
				part.Color = (t.kind == 2 or t.kind == 3) and Color3.fromRGB(58, 110, 165) or Color3.fromRGB(224, 192, 64)
				part.CFrame = CFrame.new((s.curveX + t.laneX) * SX, BASE_Y + s.hill * SY + 1.5, -dz * SZ)
			end
		end
	end
	for i = ti + 1, #traffic do
		traffic[i].Transparency = 1
	end

	-- Rival AI ghosts (same-segment) with a name tag.
	local gi = 0
	for _, g in ipairs(view.ghosts or {}) do
		local dz = g.roadZ - seat.roadZ
		if dz >= 0 and gi < #ghosts then
			local k = math.floor(dz / ROAD_UNIT) + 1
			local s = built[math.min(k, N)]
			if s then
				gi += 1
				local part = ghosts[gi]
				part.Transparency = 0
				part.CFrame = CFrame.new((s.curveX + g.laneX) * SX, BASE_Y + s.hill * SY + 2, -dz * SZ)
				ghostTags[gi].Text = g.name or ("P" .. g.seatId)
			end
		end
	end
	for i = gi + 1, #ghosts do
		ghosts[i].Transparency = 1
	end

	-- Boost pads on the current segment.
	local pi = 0
	local seg = seat.segmentId ~= -1 and road.getSegment(courseSet, seat.segmentId) or nil
	local padList = seg and seg.boostPads
	if padList then
		for _, pad in ipairs(padList) do
			local dz = pad.roadZ - seat.roadZ
			if dz >= 0 and pi < #pads then
				local k = math.floor(dz / ROAD_UNIT) + 1
				local s = built[math.min(k, N)]
				if s then
					pi += 1
					local part = pads[pi]
					part.Transparency = 0.15
					part.CFrame = CFrame.new((s.curveX + pad.laneX) * SX, BASE_Y + s.hill * SY + 0.3, -dz * SZ)
				end
			end
		end
	end
	for i = pi + 1, #pads do
		pads[i].Transparency = 1
	end

	hud.speed.Text = tostring(math.floor(seat.speed / 256 * 12)) .. " mph"
	hud.timer.Text = string.format("TIME %0.1f", math.max(0, seat.timerTicks) / 20)
	hud.banner.Text = boosting and "BOOST!" or (seat.finishTicks >= 0 and "FINISH!" or (seat.timedOut ~= 0 and "TIME UP" or ""))
	hud.banner.TextColor3 = boosting and Color3.fromRGB(120, 240, 255) or Color3.fromRGB(255, 220, 74)

	return car.Position
end

-- Chase camera derived from the car Part each RenderStepped (smoother than 20 Hz).
function Render.cameraCFrame(): CFrame
	if not car then
		return workspace.CurrentCamera.CFrame
	end
	local cp = car.Position
	local eye = Vector3.new(cp.X * 0.4, cp.Y + 7, cp.Z + 17)
	local look = Vector3.new(cp.X * 0.15, cp.Y + 2, cp.Z - 40)
	return CFrame.lookAt(eye, look)
end

return Render

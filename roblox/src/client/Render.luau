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

-- Recognizable terrain per biome (marker-0122): a real Roblox surface material so
-- the ground/verge reads as sand/rock/snow/grass rather than flat plastic.
local BIOME_MAT: { [number]: Enum.Material } = {
	[2] = Enum.Material.Sand, -- beach
	[3] = Enum.Material.Sandstone, -- canyon
	[5] = Enum.Material.Concrete, -- city
	[9] = Enum.Material.Ground, -- autumn
	[11] = Enum.Material.Snow, -- alpine
}

-- Client-side stage index for the HUD, by walking the default path from the start
-- (approximate at forks). Rebuilt when the room's selected course changes.
local stageOf, STAGE_TOTAL = {}, 0
local curCourse = 0
local function rebuildStageMap(courseId: number)
	stageOf, STAGE_TOTAL = {}, 0
	local id = road.getCourse(courseSet, courseId).startSegment
	local guard = 0
	while id and id ~= -1 and not stageOf[id] and guard < 500 do
		STAGE_TOTAL += 1
		stageOf[id] = STAGE_TOTAL
		id = road.nextSegment(courseSet, id, 0)
		guard += 1
	end
	curCourse = courseId
end
rebuildStageMap(4)
local lastStage = 1
local prevCd, goFrames = 0, 0 -- countdown -> GO! edge (marker-0109)

-- Car livery palette (marker-0113): rivals + traffic pick a colour by identity,
-- shifted by the biome so the field looks varied AND different across biomes.
local CAR_PALETTE = {
	Color3.fromRGB(224, 72, 48),
	Color3.fromRGB(72, 132, 224),
	Color3.fromRGB(72, 200, 96),
	Color3.fromRGB(240, 196, 64),
	Color3.fromRGB(210, 96, 220),
	Color3.fromRGB(64, 210, 210),
	Color3.fromRGB(240, 140, 60),
	Color3.fromRGB(232, 232, 240),
}
local function carColor(id: number, scenerySet: number): Color3
	return CAR_PALETTE[((id + scenerySet) % #CAR_PALETTE) + 1]
end

-- Engine-units -> studs.
local SX = 14 / 256 -- lateral (one lane = 14 studs)
local SZ = 9 / 256 -- forward depth per road unit
local SY = 0.7 -- hill height
local ROAD_HALF = 512 -- engine off-road edge
local N = 80 -- strips drawn ahead
local STRIP_LEN = ROAD_UNIT * SZ
local BASE_Y = 50 -- lift the whole world above any baseplate so it's clearly visible
local ZSHIFT = 14 -- push the whole road toward the camera so it reaches the bottom
-- of the screen (behind the car), not just start at the car's depth

local Render = {}
local strips: { Part } = {}
local rumbleL: { Part } = {} -- red/white kerb, left edge
local rumbleR: { Part } = {} -- red/white kerb, right edge
local sideL: { Part } = {} -- per-biome side ground (water/sand), left
local sideR: { Part } = {} -- per-biome side ground, right
local traffic = {} -- traffic car rigs (marker-0107)
local signs = {} -- roadside billboards { post, panel }
local pads: { Part } = {}
local ghostRigs = {} -- rival car rigs (marker-0104)
local ghostTags: { TextLabel } = {}
local dashes: { Part } = {} -- scrolling centre-line dashes (speed cue)
local props = {} -- pooled roadside scenery rigs { trunk, canopy }
local ground: Part
local carRig -- player car rig (body + cabin + 4 wheels)
local boostEmitter: ParticleEmitter -- cyan trail while boosting (marker-0112)
local boostActive = false

-- Audio (marker-0118): bundled rbxasset sounds (no marketplace assets). One ping is
-- re-pitched for checkpoint/countdown/GO/finish; distinct sounds for crash/boost.
local SoundService = game:GetService("SoundService")
local sfxPing, sfxCrash, sfxBoost
local prevCrashS, prevBoostS, prevTimerS, prevFinishS, prevCdBeep = 0, 0, -1, -1, 0

local DASH_SPACING = ROAD_UNIT * 3 -- one centre dash every 3 road units
local PROP_SPACING = ROAD_UNIT * 6 -- a roadside prop slot every 6 road units
local hud: { speed: TextLabel, timer: TextLabel, stage: TextLabel, score: TextLabel, banner: TextLabel }
local board: { frame: Frame, title: TextLabel, rows: { TextLabel } } -- leaderboard panel

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

-- A procedural low-poly car (marker-0104): body + cabin + 4 wheels, each a Part at
-- a fixed local offset. No Model/pivot — placeCar just sets every part's CFrame =
-- base * offset, which is dead-simple and can't mis-pivot. Front is -Z (forward).
local function makeCarRig(bodyColor: Color3, parent: Instance)
	local rig = { parts = {}, body = nil :: Part? }
	local function piece(size, color, offset, shape, material)
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.Size = size
		p.Color = color
		p.Material = material or Enum.Material.SmoothPlastic
		if shape then
			p.Shape = shape
		end
		p.Parent = parent
		table.insert(rig.parts, { part = p, offset = offset })
		return p
	end
	local function wedge(size, color, offset)
		local p = Instance.new("WedgePart")
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
		p.Size, p.Color, p.Material = size, color, Enum.Material.SmoothPlastic
		p.Parent = parent
		table.insert(rig.parts, { part = p, offset = offset })
		return p
	end
	-- Lower, sleeker chassis + a separate greenhouse cabin so the profile reads as a
	-- car, not a box. parts[1]=body and parts[2]=cabin stay first (setCarStyle resizes
	-- them); the detail pieces after are fixed accents.
	rig.body = piece(Vector3.new(6.6, 1.8, 11), bodyColor, CFrame.new(0, 0.1, 0))
	piece(Vector3.new(4.8, 1.7, 5), bodyColor:Lerp(Color3.new(0, 0, 0), 0.32), CFrame.new(0, 1.25, 0.8)) -- cabin toward the rear
	piece(Vector3.new(4.4, 0.25, 3.1), Color3.fromRGB(150, 195, 225), CFrame.new(0, 1.35, -1.3) * CFrame.Angles(math.rad(-32), 0, 0)) -- windshield
	local shadow = piece(Vector3.new(9, 0.2, 13), Color3.fromRGB(18, 10, 18), CFrame.new(0, -1.15, 0))
	shadow.Transparency = 0.55
	local wc = Color3.fromRGB(24, 24, 28)
	local hub = Color3.fromRGB(150, 150, 158)
	local wheel = Vector3.new(1.3, 2.5, 2.5)
	for _, wx in ipairs({ -3.0, 3.0 }) do
		for _, wz in ipairs({ -3.2, 3.2 }) do
			piece(wheel, wc, CFrame.new(wx, -0.9, wz), Enum.PartType.Cylinder)
			piece(Vector3.new(1.35, 1.1, 1.1), hub, CFrame.new(wx, -0.9, wz), Enum.PartType.Cylinder) -- hubcap
		end
	end
	-- Sloped hood (front, high side toward the cabin) and boot (rear) so it's not a box.
	wedge(Vector3.new(5.6, 1.2, 3.6), bodyColor, CFrame.new(0, 0.95, -3.6))
	wedge(Vector3.new(5.4, 0.9, 2.6), bodyColor:Lerp(Color3.new(0, 0, 0), 0.1), CFrame.new(0, 0.9, 3.9) * CFrame.Angles(0, math.rad(180), 0))
	-- Head + tail lights (small glowing accents at the corners).
	piece(Vector3.new(1.1, 0.7, 0.4), Color3.fromRGB(255, 246, 214), CFrame.new(-2.0, 0.2, -5.45), nil, Enum.Material.Neon)
	piece(Vector3.new(1.1, 0.7, 0.4), Color3.fromRGB(255, 246, 214), CFrame.new(2.0, 0.2, -5.45), nil, Enum.Material.Neon)
	piece(Vector3.new(1.3, 0.6, 0.4), Color3.fromRGB(230, 40, 40), CFrame.new(-2.0, 0.45, 5.5), nil, Enum.Material.Neon)
	piece(Vector3.new(1.3, 0.6, 0.4), Color3.fromRGB(230, 40, 40), CFrame.new(2.0, 0.45, 5.5), nil, Enum.Material.Neon)
	-- Rear spoiler on two little posts.
	piece(Vector3.new(6.2, 0.3, 1.5), bodyColor:Lerp(Color3.new(0, 0, 0), 0.2), CFrame.new(0, 1.45, 5.0))
	piece(Vector3.new(0.4, 1.0, 0.5), Color3.fromRGB(30, 30, 34), CFrame.new(-2.5, 1.0, 5.0))
	piece(Vector3.new(0.4, 1.0, 0.5), Color3.fromRGB(30, 30, 34), CFrame.new(2.5, 1.0, 5.0))
	return rig
end

local function placeCar(rig, cf: CFrame)
	for _, e in ipairs(rig.parts) do
		e.part.CFrame = cf * e.offset
	end
end

local function setCarShown(rig, shown: boolean)
	for _, e in ipairs(rig.parts) do
		e.part.Transparency = shown and 0 or 1
	end
end

-- Body silhouettes (marker-0117): resize the body + cabin so cars have distinct
-- shapes. setCarStyle only resizes when the style key changes (cheap).
local STYLES = {
	sport = { body = Vector3.new(7, 2.2, 12), cabin = Vector3.new(4.6, 1.6, 4.5), cabinY = 1.4 },
	suv = { body = Vector3.new(7.4, 3.2, 10.5), cabin = Vector3.new(5.4, 2.4, 6), cabinY = 1.9 },
	compact = { body = Vector3.new(6.4, 2.4, 9), cabin = Vector3.new(5, 1.9, 5), cabinY = 1.5 },
	truck = { body = Vector3.new(7.6, 3.6, 13), cabin = Vector3.new(5.2, 2.6, 4.5), cabinY = 2.2 },
	bus = { body = Vector3.new(7.6, 3.4, 16), cabin = Vector3.new(6.4, 2.6, 12), cabinY = 1.9 },
	bike = { body = Vector3.new(3.2, 2, 7), cabin = Vector3.new(2.4, 1.6, 2.4), cabinY = 1.4 },
}
local RIVAL_STYLES = { "sport", "suv", "compact" }
local function setCarStyle(rig, key: string)
	if rig.styleKey == key then
		return
	end
	rig.styleKey = key
	local s = STYLES[key] or STYLES.sport
	rig.parts[1].part.Size = s.body
	rig.parts[2].part.Size = s.cabin
	rig.parts[2].offset = CFrame.new(0, s.cabinY, 0.8)
end

local function trafficStyleKey(kind: number): string
	if kind == 2 then
		return "truck"
	elseif kind == 3 then
		return "bus"
	elseif kind == 4 then
		return "bike"
	end
	return "sport"
end

-- Sunset mood (marker-0102): warm dusk lighting + haze, no textures. Global +
-- one-time; fog fades the end of the treadmill draw distance into the horizon.
local function setupLighting()
	local L = game:GetService("Lighting")
	L.ClockTime = 17.6
	L.GeographicLatitude = 20
	L.Brightness = 1.7 -- lower so saturated colours (the red car etc.) don't wash out
	L.Ambient = Color3.fromRGB(66, 52, 66)
	L.OutdoorAmbient = Color3.fromRGB(130, 96, 92)
	L.FogColor = Color3.fromRGB(214, 108, 96)
	L.FogStart = 900 -- light haze only; the road's end is faded manually (far strips),
	L.FogEnd = 2200 -- so the gradient sky backdrop stays visible at distance
	L.EnvironmentDiffuseScale = 0.25
	L.EnvironmentSpecularScale = 0.2
	local atmo = L:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmo.Density = 0.28
	atmo.Offset = 0.2
	atmo.Color = Color3.fromRGB(200, 140, 120)
	atmo.Decay = Color3.fromRGB(180, 70, 90)
	atmo.Glare = 0.2
	atmo.Haze = 1.5
	atmo.Parent = L
	local cc = L:FindFirstChildOfClass("ColorCorrectionEffect") or Instance.new("ColorCorrectionEffect")
	cc.TintColor = Color3.fromRGB(255, 238, 228)
	cc.Saturation = 0.12 -- push saturation UP so grass/road/cars read like the browser
	cc.Contrast = 0.05
	cc.Parent = L
end

-- Procedural OutRun sky (marker-0105): a static stack of big coloured Parts far
-- ahead. The camera barely moves (treadmill), so a fixed backdrop reads as the
-- sky in the forward view; the ground plane occludes its lower half at the horizon.
local SKY_BANDS = {
	{ Color3.fromRGB(43, 26, 84), 1600, 2400 }, -- indigo (top): {color, yCentre, height}
	{ Color3.fromRGB(90, 42, 110), 620, 500 }, -- purple
	{ Color3.fromRGB(178, 58, 110), 300, 300 }, -- magenta
	{ Color3.fromRGB(255, 106, 74), 20, 340 }, -- orange (horizon; extends below to meet the ground)
}
local SKY_Z = -1500 -- backdrop wall depth (kept inside fog so it hazes into the horizon)
local function makeSky(parent, baseY)
	for _, b in ipairs(SKY_BANDS) do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.Material = Enum.Material.SmoothPlastic
		p.Size = Vector3.new(9000, b[3], 20)
		p.Color = b[1]
		p.CFrame = CFrame.new(0, baseY + b[2], SKY_Z)
		p.Parent = parent
	end
	-- The setting sun: a big neon disc on the horizon, with dark horizontal cuts
	-- across its lower half (classic OutRun look). Sits just in front of the bands
	-- so it never z-fights, and its lower half dips below the ground horizon.
	local D = 360
	local sun = Instance.new("Part")
	sun.Anchored, sun.CanCollide, sun.CanQuery, sun.CanTouch = true, false, false, false
	sun.Shape = Enum.PartType.Cylinder
	sun.Material = Enum.Material.Neon
	sun.Color = Color3.fromRGB(255, 156, 66)
	sun.Size = Vector3.new(5, D, D)
	sun.CFrame = CFrame.new(0, baseY + 96, SKY_Z + 8) * CFrame.Angles(0, math.rad(90), 0)
	sun.Parent = parent
	-- Gradient glow: a couple of larger, dimmer discs behind the sun.
	for i, g in ipairs({ { 1.5, 0.6, Color3.fromRGB(255, 120, 90) }, { 2.2, 0.8, Color3.fromRGB(214, 80, 120) } }) do
		local halo = sun:Clone()
		halo.Size = Vector3.new(4 - i, D * g[1], D * g[1])
		halo.Transparency = g[2]
		halo.Color = g[3]
		halo.CFrame = CFrame.new(0, baseY + 96, SKY_Z + 6 - i) * CFrame.Angles(0, math.rad(90), 0)
		halo.Parent = parent
	end
	-- Horizontal cut lines across the lower half (they read as sky showing through).
	for i = 0, 5 do
		local cut = Instance.new("Part")
		cut.Anchored, cut.CanCollide, cut.CanQuery, cut.CanTouch = true, false, false, false
		cut.Material = Enum.Material.SmoothPlastic
		cut.Color = Color3.fromRGB(150, 46, 96)
		cut.Size = Vector3.new(D, 5 + i * 1.4, 2)
		cut.CFrame = CFrame.new(0, baseY + 96 - 30 - i * 22, SKY_Z + 10)
		cut.Parent = parent
	end
end

local function mkSound(id: string, vol: number)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = vol
	s.Parent = SoundService
	return s
end
local function ping(speed: number)
	if sfxPing then
		sfxPing.PlaybackSpeed = speed
		sfxPing:Play()
	end
end

function Render.init()
	setupLighting()
	sfxPing = mkSound("rbxasset://sounds/electronicpingshort.wav", 0.5)
	sfxCrash = mkSound("rbxasset://sounds/uuhhh.mp3", 0.55)
	sfxBoost = mkSound("rbxasset://sounds/action_jump.mp3", 0.5)
	local world = Instance.new("Folder")
	world.Name = "SunsetWorld"
	world.Parent = workspace

	makeSky(world, BASE_Y)

	-- A big biome-coloured ground plane. Its FAR edge stops at z ≈ -1410, in front of
	-- the sky wall (z = -1500), so the two never overlap — that overlap was the
	-- flickering "block" on the horizon. Grass material gives recognizable terrain.
	ground = mkPart("ground", Vector3.new(9000, 2, 1900), Color3.fromRGB(60, 150, 70), world, Enum.Material.Grass)
	ground.CFrame = CFrame.new(0, BASE_Y - 0.6, -460) -- spans z ≈ +490 … -1410

	local roadW = ROAD_HALF * 2 * SX
	for k = 1, N do
		local shade = (k % 2 == 0) and Color3.fromRGB(58, 58, 66) or Color3.fromRGB(48, 48, 56)
		strips[k] = mkPart("strip", Vector3.new(roadW, 1, STRIP_LEN + 0.4), shade, world)
		rumbleL[k] = mkPart("rumbleL", Vector3.new(3.5, 1.2, STRIP_LEN + 0.4), Color3.fromRGB(220, 60, 60), world)
		rumbleR[k] = mkPart("rumbleR", Vector3.new(3.5, 1.2, STRIP_LEN + 0.4), Color3.fromRGB(220, 60, 60), world)
		sideL[k] = mkPart("sideL", Vector3.new(130, 0.5, STRIP_LEN + 0.6), Color3.fromRGB(40, 110, 180), world)
		sideR[k] = mkPart("sideR", Vector3.new(130, 0.5, STRIP_LEN + 0.6), Color3.fromRGB(40, 110, 180), world)
		sideL[k].Transparency = 1
		sideR[k].Transparency = 1
	end
	for i = 1, 14 do
		local rig = makeCarRig(Color3.fromRGB(224, 192, 64), world)
		setCarShown(rig, false)
		traffic[i] = rig
	end
	for i = 1, 4 do
		local post = mkPart("post", Vector3.new(1.6, 26, 1.6), Color3.fromRGB(120, 96, 70), world, Enum.Material.Wood)
		local panel = mkPart("panel", Vector3.new(28, 16, 1), Color3.fromRGB(210, 210, 220), world)
		post.Transparency = 1
		panel.Transparency = 1
		signs[i] = { post = post, panel = panel }
	end
	for i = 1, 8 do
		local p = mkPart("pad", Vector3.new(roadW * 0.5, 0.4, 6), Color3.fromRGB(40, 224, 255), world, Enum.Material.Neon)
		p.Transparency = 1
		pads[i] = p
	end
	for i = 1, 28 do
		local d = mkPart("dash", Vector3.new(2.6, 0.4, 11), Color3.fromRGB(255, 214, 60), world) -- bold yellow centre line
		d.Transparency = 1
		dashes[i] = d
	end
	for i = 1, 20 do
		local trunk = mkPart("trunk", Vector3.new(2, 10, 2), Color3.fromRGB(104, 72, 44), world, Enum.Material.Wood)
		trunk.Transparency = 1
		local canopy = mkPart("canopy", Vector3.new(10, 10, 10), Color3.fromRGB(60, 140, 66), world)
		canopy.Shape = Enum.PartType.Ball
		canopy.Transparency = 1
		local frond = mkPart("frond", Vector3.new(18, 8, 18), Color3.fromRGB(46, 132, 60), world) -- palm crown layer
		frond.Shape = Enum.PartType.Ball
		frond.Transparency = 1
		props[i] = { trunk = trunk, canopy = canopy, frond = frond }
	end
	local RIVAL_COLORS = { Color3.fromRGB(224, 72, 48), Color3.fromRGB(72, 132, 224), Color3.fromRGB(72, 200, 96), Color3.fromRGB(224, 192, 64) }
	for i = 1, 8 do
		local rig = makeCarRig(RIVAL_COLORS[(i % 4) + 1], world)
		setCarShown(rig, false)
		ghostRigs[i] = rig
		local bb = Instance.new("BillboardGui")
		bb.Size = UDim2.new(0, 100, 0, 26)
		bb.StudsOffset = Vector3.new(0, 4, 0)
		bb.AlwaysOnTop = true
		bb.Adornee = rig.body
		bb.Parent = rig.body
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
	carRig = makeCarRig(Color3.fromRGB(224, 72, 48), world)
	setCarStyle(carRig, "sport")
	boostEmitter = Instance.new("ParticleEmitter")
	boostEmitter.Enabled = false
	boostEmitter.Color = ColorSequence.new(Color3.fromRGB(120, 240, 255))
	boostEmitter.Lifetime = NumberRange.new(0.3, 0.55)
	boostEmitter.Speed = NumberRange.new(0, 5)
	boostEmitter.Rate = 140
	boostEmitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 3), NumberSequenceKeypoint.new(1, 0) })
	boostEmitter.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.15), NumberSequenceKeypoint.new(1, 1) })
	boostEmitter.LightEmission = 0.9
	boostEmitter.SpreadAngle = Vector2.new(22, 22)
	boostEmitter.Parent = carRig.body

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
		speed = label(UDim2.new(0.6, 0, 0.8, 0), UDim2.new(0.38, 0, 0.16, 0), Enum.TextXAlignment.Right),
		timer = label(UDim2.new(0.35, 0, 0.015, 0), UDim2.new(0.3, 0, 0.16, 0), Enum.TextXAlignment.Center),
		stage = label(UDim2.new(0.02, 0, 0.8, 0), UDim2.new(0.3, 0, 0.16, 0), Enum.TextXAlignment.Left),
		score = label(UDim2.new(0.62, 0, 0.02, 0), UDim2.new(0.36, 0, 0.09, 0), Enum.TextXAlignment.Right),
		banner = label(UDim2.new(0.25, 0, 0.4, 0), UDim2.new(0.5, 0, 0.12, 0), Enum.TextXAlignment.Center),
	}
	hud.stage.TextColor3 = Color3.fromRGB(90, 224, 235) -- cyan like the browser
	hud.score.TextColor3 = Color3.fromRGB(255, 220, 74)

	-- End-of-race leaderboard panel (hidden until the summary phase).
	local frame = Instance.new("Frame")
	frame.Size = UDim2.new(0.44, 0, 0.6, 0)
	frame.Position = UDim2.new(0.28, 0, 0.16, 0)
	frame.BackgroundColor3 = Color3.fromRGB(24, 16, 40)
	frame.BackgroundTransparency = 0.2
	frame.BorderSizePixel = 0
	frame.Visible = false
	frame.Parent = gui
	local title = Instance.new("TextLabel")
	title.BackgroundTransparency = 1
	title.Size = UDim2.new(1, 0, 0.16, 0)
	title.Font = Enum.Font.GothamBold
	title.TextScaled = true
	title.TextColor3 = Color3.fromRGB(255, 220, 74)
	title.Text = "RESULTS"
	title.Parent = frame
	local rows = {}
	for i = 1, 6 do
		local r = Instance.new("TextLabel")
		r.BackgroundTransparency = 1
		r.Position = UDim2.new(0.05, 0, 0.16 + (i - 1) * 0.13, 0)
		r.Size = UDim2.new(0.9, 0, 0.12, 0)
		r.Font = Enum.Font.GothamBold
		r.TextScaled = true
		r.TextXAlignment = Enum.TextXAlignment.Left
		r.TextColor3 = Color3.fromRGB(230, 230, 240)
		r.Text = ""
		r.Parent = frame
		rows[i] = r
	end
	board = { frame = frame, title = title, rows = rows }

	-- Lay a straight flat road immediately so SOMETHING is visible before the first
	-- server view arrives (a straight road that never moves = server not sending;
	-- an empty world = this script never ran).
	for k = 1, N do
		strips[k].CFrame = CFrame.new(0, BASE_Y, ZSHIFT - (k - 1) * STRIP_LEN)
	end
	placeCar(carRig, CFrame.new(0, BASE_Y + 1.6, 4))
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Scriptable
	cam.CFrame = CFrame.lookAt(Vector3.new(0, BASE_Y + 7, 17), Vector3.new(0, BASE_Y + 2, -40))
	print("[SunsetRunner] client render initialised — road built at y=" .. BASE_Y)
end

-- Reposition everything from a fresh view. Returns the car's world position so the
-- camera loop can follow it every RenderStepped (smoother than the 20 Hz updates).
local curBiome = -1 -- last biome whose surface materials were applied (change-gated)
local function renderWorld(rz, laneX, view)
	local seat = view.seat
	if view.courseId and view.courseId ~= curCourse then
		rebuildStageMap(view.courseId)
	end
	local built = buildStrips(seat.segmentId, rz, N, seat.forkChoice)

	-- Recolour the ground to the current segment's biome (grass/sand/snow/etc),
	-- brightened toward the browser's vibrant flat look.
	local scenerySet = seat.segmentId ~= -1 and road.getSegment(courseSet, seat.segmentId).scenerySet or 1
	local theme = themeFor(scenerySet)
	ground.Color = (hexToColor3(theme.grassA) or Color3.fromRGB(60, 150, 70)):Lerp(Color3.fromRGB(255, 255, 255), 0.12)
	local gc = ground.Color
	local foliage = Color3.new(gc.R * 0.45, gc.G * 0.7, gc.B * 0.45) -- roadside greenery from the biome
	local drawDz = (N - 1) * ROAD_UNIT
	local roadHalfStuds = ROAD_HALF * SX
	local fadeFrom = N - 12
	local sideLcol = hexToColor3(theme.sideLeft) -- water strip beside the road (some biomes)
	local sideRcol = hexToColor3(theme.sideRight)
	-- Verge always renders now (recognizable terrain), water where the biome has it,
	-- else a darker shade of the biome grass. Materials only change on a biome change.
	local grassB = hexToColor3(theme.grassB) or gc
	local vergeL = sideLcol or grassB
	local vergeR = sideRcol or grassB
	local vergeLb = vergeL:Lerp(Color3.new(0, 0, 0), 0.14) -- alt band for a textured look
	local vergeRb = vergeR:Lerp(Color3.new(0, 0, 0), 0.14)
	if scenerySet ~= curBiome then
		curBiome = scenerySet
		local gmat = BIOME_MAT[scenerySet] or Enum.Material.Grass
		ground.Material = gmat
		local vergeMat = BIOME_MAT[scenerySet] or Enum.Material.LeafyGrass
		local lMat = sideLcol and Enum.Material.Glass or vergeMat
		local rMat = sideRcol and Enum.Material.Glass or vergeMat
		for k = 1, N do
			sideL[k].Material = lMat
			sideR[k].Material = rMat
		end
	end

	-- Road strips + red/white kerbs + per-biome side ground, with a scrolling band
	-- pattern (speed) and a far-fade so the treadmill dissolves into the sky.
	local bandPhase = math.floor(rz / ROAD_UNIT)
	for k = 1, N do
		local s = built[k]
		local p = strips[k]
		local rl, rr = rumbleL[k], rumbleR[k]
		if s then
			local fade = (k > fadeFrom) and math.min(0.9, (k - fadeFrom) / 12 * 0.9) or 0
			local x, y, z = s.curveX * SX, BASE_Y + s.hill * SY, ZSHIFT - s.dz * SZ
			p.Transparency = fade
			p.Color = ((bandPhase + k) % 2 == 0) and Color3.fromRGB(54, 54, 62) or Color3.fromRGB(44, 44, 52)
			p.CFrame = CFrame.new(x, y, z)
			local kerb = ((bandPhase + k) % 2 == 0) and Color3.fromRGB(230, 66, 66) or Color3.fromRGB(238, 238, 238)
			rl.Transparency, rr.Transparency = fade, fade
			rl.Color, rr.Color = kerb, kerb
			rl.CFrame = CFrame.new(x - roadHalfStuds - 1.6, y + 0.1, z)
			rr.CFrame = CFrame.new(x + roadHalfStuds + 1.6, y + 0.1, z)
			local alt = (bandPhase + k) % 2 == 0
			sideL[k].Transparency = fade
			sideL[k].Color = alt and vergeL or vergeLb
			sideL[k].CFrame = CFrame.new(x - roadHalfStuds - 66, y - 0.25, z)
			sideR[k].Transparency = fade
			sideR[k].Color = alt and vergeR or vergeRb
			sideR[k].CFrame = CFrame.new(x + roadHalfStuds + 66, y - 0.25, z)
		else
			p.Transparency, rl.Transparency, rr.Transparency = 1, 1, 1
			sideL[k].Transparency, sideR[k].Transparency = 1, 1
		end
	end

	-- Scrolling centre-line dashes (the clearest speed cue).
	local dashOff = rz % DASH_SPACING
	for i = 1, #dashes do
		local d = (i - 1) * DASH_SPACING - dashOff
		if d >= 0 and d <= drawDz then
			local s = built[math.min(math.floor(d / ROAD_UNIT) + 1, N)]
			if s then
				dashes[i].Transparency = 0
				dashes[i].CFrame = CFrame.new(s.curveX * SX, BASE_Y + s.hill * SY + 0.6, ZSHIFT - d * SZ)
			else
				dashes[i].Transparency = 1
			end
		else
			dashes[i].Transparency = 1
		end
	end

	-- Pooled roadside props as per-biome trees (palm/fir/bush) + occasional rocks,
	-- stable per world slot so they don't jitter as they approach.
	local isPalm = (scenerySet == 1 or scenerySet == 2)
	local isFir = (scenerySet == 5 or scenerySet == 10 or scenerySet == 11)
	local roadEdge = ROAD_HALF * SX + 10
	local propOff = rz % PROP_SPACING
	local baseSlot = math.floor(rz / PROP_SPACING)
	for i = 1, #props do
		local rig = props[i]
		local d = (i - 1) * PROP_SPACING - propOff
		if d >= 0 and d <= drawDz then
			local s = built[math.min(math.floor(d / ROAD_UNIT) + 1, N)]
			if s then
				local worldSlot = baseSlot + (i - 1)
				local side = if worldSlot % 2 == 0 then -1 else 1
				local x = s.curveX * SX + side * roadEdge
				local baseY = BASE_Y + s.hill * SY
				local z = ZSHIFT - d * SZ
				if worldSlot % 4 == 0 then
					-- rock: grey blob, no trunk / no frond
					rig.trunk.Transparency, rig.frond.Transparency = 1, 1
					rig.canopy.Transparency = 0
					rig.canopy.Color = Color3.fromRGB(122, 118, 112)
					rig.canopy.Size = Vector3.new(11, 7, 11)
					rig.canopy.CFrame = CFrame.new(x, baseY + 3, z)
				else
					local trunkH, canopySize, canopyY
					if isPalm then
						trunkH, canopySize, canopyY = 24, Vector3.new(30, 9, 30), 26 -- tall trunk + wide fronds
					elseif isFir then
						trunkH, canopySize, canopyY = 9, Vector3.new(16, 26, 16), 16 -- short trunk + tall conical foliage
					else
						trunkH, canopySize, canopyY = 7, Vector3.new(17, 17, 17), 11 -- bush
					end
					rig.trunk.Transparency = 0
					rig.trunk.Size = Vector3.new(2, trunkH, 2)
					rig.trunk.CFrame = CFrame.new(x, baseY + trunkH / 2, z)
					rig.canopy.Transparency = 0
					rig.canopy.Color = isFir and Color3.fromRGB(40, 96, 54) or foliage
					rig.canopy.Size = canopySize
					rig.canopy.CFrame = CFrame.new(x, baseY + canopyY, z)
					-- palms get a second, offset crown layer for fuller fronds
					if isPalm then
						rig.frond.Transparency = 0
						rig.frond.Color = Color3.fromRGB(52, 146, 66)
						rig.frond.Size = Vector3.new(22, 7, 22)
						rig.frond.CFrame = CFrame.new(x, baseY + canopyY + 4, z)
					else
						rig.frond.Transparency = 1
					end
				end
			else
				rig.trunk.Transparency, rig.canopy.Transparency, rig.frond.Transparency = 1, 1, 1
			end
		else
			rig.trunk.Transparency, rig.canopy.Transparency, rig.frond.Transparency = 1, 1, 1
		end
	end

	-- Roadside billboards (sparse), further out than the trees. The panel faces the
	-- camera (its wide face is on ±Z).
	local SIGN_SPACING = ROAD_UNIT * 24
	local signOff = rz % SIGN_SPACING
	local signBase = math.floor(rz / SIGN_SPACING)
	for i = 1, #signs do
		local sg = signs[i]
		local d = (i - 1) * SIGN_SPACING - signOff
		if d >= 0 and d <= drawDz then
			local s = built[math.min(math.floor(d / ROAD_UNIT) + 1, N)]
			if s then
				local slot = signBase + (i - 1)
				local side = if slot % 2 == 0 then -1 else 1
				local x = s.curveX * SX + side * (roadHalfStuds + 60)
				local y = BASE_Y + s.hill * SY
				local z = ZSHIFT - d * SZ
				sg.post.Transparency = 0
				sg.post.CFrame = CFrame.new(x, y + 13, z)
				sg.panel.Transparency = 0
				sg.panel.Color = (slot % 3 == 0) and Color3.fromRGB(214, 84, 92) or Color3.fromRGB(198, 204, 220)
				sg.panel.CFrame = CFrame.new(x, y + 24, z)
			else
				sg.post.Transparency, sg.panel.Transparency = 1, 1
			end
		else
			sg.post.Transparency, sg.panel.Transparency = 1, 1
		end
	end

	local near = built[1]
	local baseHill = near and near.hill * SY or 0
	local carX = laneX * SX
	local boosting = seat.boostTicks > 0
	carRig.body.Color = boosting and Color3.fromRGB(120, 240, 255)
		or (seat.crashedTicks > 0 and Color3.fromRGB(255, 255, 255) or Color3.fromRGB(224, 72, 48))
	boostActive = boosting
	if boostEmitter then
		boostEmitter.Enabled = boosting
	end
	placeCar(carRig, CFrame.new(carX, BASE_Y + baseHill + 1.6, 4))

	-- Same-segment traffic ahead.
	-- Sort traffic NEAREST-first and render only the closest #traffic within the
	-- draw distance — otherwise the pool can render an arbitrary far subset and the
	-- car you're about to hit is invisible (you "just stop").
	local nearTraffic = {}
	for _, t in ipairs(view.traffic or {}) do
		local dz = t.roadZ - rz
		if dz >= 0 and dz <= drawDz then
			table.insert(nearTraffic, { dz = dz, t = t })
		end
	end
	table.sort(nearTraffic, function(a, b)
		return a.dz < b.dz
	end)
	local ti = 0
	for _, e in ipairs(nearTraffic) do
		if ti >= #traffic then
			break
		end
		local s = built[math.min(math.floor(e.dz / ROAD_UNIT) + 1, N)]
		if s then
			ti += 1
			local rig = traffic[ti]
			local t = e.t
			setCarShown(rig, true)
			setCarStyle(rig, trafficStyleKey(t.kind))
			rig.body.Color = carColor(t.id or ti, scenerySet)
			placeCar(rig, CFrame.new((s.curveX + t.laneX) * SX, BASE_Y + s.hill * SY + 1.6, ZSHIFT - e.dz * SZ))
		end
	end
	for i = ti + 1, #traffic do
		setCarShown(traffic[i], false)
	end

	-- Rival AI ghosts (same-segment) as car rigs with a name tag.
	local gi = 0
	for _, g in ipairs(view.ghosts or {}) do
		local dz = g.roadZ - rz
		if dz >= 0 and gi < #ghostRigs then
			local k = math.floor(dz / ROAD_UNIT) + 1
			local s = built[math.min(k, N)]
			if s then
				gi += 1
				local rig = ghostRigs[gi]
				setCarShown(rig, true)
				setCarStyle(rig, RIVAL_STYLES[((g.seatId + scenerySet) % 3) + 1]) -- shape varies by seat + biome
				rig.body.Color = carColor(g.seatId + 3, scenerySet) -- distinct from the player (red)
				placeCar(rig, CFrame.new((s.curveX + g.laneX) * SX, BASE_Y + s.hill * SY + 1.6, ZSHIFT - dz * SZ))
				ghostTags[gi].Text = g.name or ("P" .. g.seatId)
			end
		end
	end
	for i = gi + 1, #ghostRigs do
		setCarShown(ghostRigs[i], false)
	end

	-- Boost pads on the current segment.
	local pi = 0
	local seg = seat.segmentId ~= -1 and road.getSegment(courseSet, seat.segmentId) or nil
	local padList = seg and seg.boostPads
	if padList then
		for _, pad in ipairs(padList) do
			local dz = pad.roadZ - rz
			if dz >= 0 and pi < #pads then
				local k = math.floor(dz / ROAD_UNIT) + 1
				local s = built[math.min(k, N)]
				if s then
					pi += 1
					local part = pads[pi]
					part.Transparency = 0.15
					part.CFrame = CFrame.new((s.curveX + pad.laneX) * SX, BASE_Y + s.hill * SY + 0.3, ZSHIFT - dz * SZ)
				end
			end
		end
	end
	for i = pi + 1, #pads do
		pads[i].Transparency = 1
	end

	hud.speed.Text = tostring(math.floor(seat.speed / 256 * 12)) .. " mph"
	hud.timer.Text = tostring(math.max(0, math.floor(seat.timerTicks / 20))) -- TIME (big centre)
	lastStage = stageOf[seat.segmentId] or lastStage
	hud.stage.Text = "STAGE " .. lastStage .. "/" .. STAGE_TOTAL
	hud.score.Text = "SCORE " .. (view.points or 0)
	-- Race framing (marker-0109): countdown 3-2-1, a brief GO!, then the finish/
	-- time-up summary with a "new race in Ns" line.
	local cd = view.countdown or 0
	if prevCd > 0 and cd == 0 then
		goFrames = 45
	end
	prevCd = cd

	-- Audio edges (marker-0118): only during racing (so a fresh-race timer reset
	-- can't fire a false checkpoint); countdown beeps + a GO chime.
	local racing = view.phase == "racing"
	if racing and seat.crashedTicks > 0 and prevCrashS == 0 then
		sfxCrash:Play()
	end
	prevCrashS = seat.crashedTicks
	if racing and seat.boostTicks > 0 and prevBoostS == 0 then
		sfxBoost:Play()
	end
	prevBoostS = seat.boostTicks
	if racing and prevTimerS >= 0 and seat.timerTicks > prevTimerS then
		ping(1.4) -- checkpoint bonus
	end
	prevTimerS = seat.timerTicks
	if racing and seat.finishTicks >= 0 and prevFinishS < 0 then
		ping(1.75)
	end
	prevFinishS = seat.finishTicks
	if cd ~= prevCdBeep and cd > 0 then
		ping(1.0) -- 3-2-1 beeps
	elseif prevCdBeep > 0 and cd == 0 then
		ping(1.9) -- GO chime
	end
	prevCdBeep = cd
	if view.phase == "lobby" then
		hud.banner.Text = "GET READY  " .. (view.lobbyIn or 0) .. "s   " .. (view.readyCount or 0) .. "/" .. (view.playerCount or 0) .. " ready"
		hud.banner.TextColor3 = Color3.fromRGB(120, 240, 120)
	elseif cd > 0 then
		hud.banner.Text = tostring(cd)
		hud.banner.TextColor3 = Color3.fromRGB(255, 220, 74)
	elseif goFrames > 0 then
		goFrames -= 1
		hud.banner.Text = "GO!"
		hud.banner.TextColor3 = Color3.fromRGB(120, 240, 120)
	elseif view.raceOver and not view.watching then
		local fin = seat.finishTicks >= 0
		hud.banner.Text = (fin and "FINISHED  " or "TIME UP  ") .. (view.points or 0) .. " pts"
		hud.banner.TextColor3 = fin and Color3.fromRGB(120, 240, 120) or Color3.fromRGB(255, 120, 90)
	elseif view.watching then
		hud.banner.Text = "SPECTATING"
		hud.banner.TextColor3 = Color3.fromRGB(120, 200, 255)
	elseif view.phase == "summary" then
		hud.banner.Text = "new race in " .. (view.restartIn or 0)
		hud.banner.TextColor3 = Color3.fromRGB(255, 220, 74)
	elseif boosting then
		hud.banner.Text = "BOOST!"
		hud.banner.TextColor3 = Color3.fromRGB(120, 240, 255)
	else
		hud.banner.Text = ""
	end

	-- Leaderboard panel: your live score the moment your race ends, RESULTS during
	-- the summary, ALL-TIME during the lobby. Hidden while spectating the leader.
	if (view.phase == "summary" or (view.raceOver and not view.watching)) and view.standings then
		board.frame.Visible = true
		board.title.Text = view.raceOver
			and ((seat.finishTicks >= 0 and "FINISHED — " or "TIME UP — ") .. (view.points or 0) .. " pts")
			or "RESULTS"
		for i, r in ipairs(board.rows) do
			local e = view.standings[i]
			if e then
				r.Text = string.format("%d.  %s    %s", e.rank, e.name, e.result)
				r.TextColor3 = e.isSelf and Color3.fromRGB(120, 240, 120) or Color3.fromRGB(230, 230, 240)
			else
				r.Text = ""
			end
		end
	elseif view.phase == "lobby" and view.allTime then
		board.frame.Visible = true
		board.title.Text = "ALL-TIME"
		for i, r in ipairs(board.rows) do
			local e = view.allTime[i]
			if e then
				r.Text = string.format("%d.  %s    %d", i, e.name, e.points)
				r.TextColor3 = Color3.fromRGB(230, 230, 240)
			else
				r.Text = ""
			end
		end
	else
		board.frame.Visible = false
	end

	-- (rendered)
end

-- Interpolation (marker-0108): the server view arrives at 20 Hz. We render every
-- RenderStepped (~60 fps) from a locally EXTRAPOLATED road position — roadZ
-- advances by speed each tick, so between views we advance it by speed*20*dt and
-- gently correct toward each authoritative view; laneX eases toward the view.
-- roadZ resets per segment, so on a segment change we SNAP (no backward jump).
local latest = nil
local renderRoadZ, renderLaneX = 0, 0
local interpSeg = nil
local haveState = false

function Render.update(view)
	latest = view
	local sid = view.seat.segmentId
	if not haveState or sid ~= interpSeg then
		renderRoadZ = view.seat.roadZ
		renderLaneX = view.seat.laneX
		interpSeg = sid
		haveState = true
	else
		renderRoadZ += (view.seat.roadZ - renderRoadZ) * 0.3 -- drift correction
	end
end

function Render.step(dt: number)
	if not haveState or not latest then
		return
	end
	local seat = latest.seat
	if seat.finishTicks < 0 and seat.timedOut == 0 then
		renderRoadZ += seat.speed * 20 * dt -- engine advances roadZ by speed each tick
	end
	renderLaneX += (seat.laneX - renderLaneX) * math.min(1, dt * 12)
	renderWorld(renderRoadZ, renderLaneX, latest)
end

-- Chase camera derived from the car body each RenderStepped (smoother than 20 Hz).
function Render.cameraCFrame(): CFrame
	if not carRig or not carRig.body then
		return workspace.CurrentCamera.CFrame
	end
	local cp = carRig.body.Position
	local eye = Vector3.new(cp.X * 0.4, cp.Y + 7, cp.Z + 17)
	local look = Vector3.new(cp.X * 0.15, cp.Y + 2, cp.Z - 40)
	-- FOV kick while boosting adds to the sense of speed.
	local cam = workspace.CurrentCamera
	cam.FieldOfView += ((boostActive and 82 or 70) - cam.FieldOfView) * 0.12
	return CFrame.lookAt(eye, look)
end

return Render

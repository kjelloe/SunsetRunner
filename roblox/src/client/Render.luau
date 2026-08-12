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

-- Player car colours by selected car id (must match Main's CAR_COLORS 1..4).
local PLAYER_CAR_COLORS = {
	Color3.fromRGB(224, 72, 48), Color3.fromRGB(72, 132, 224),
	Color3.fromRGB(72, 200, 96), Color3.fromRGB(240, 196, 64),
}

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
local vehPool: { [string]: { any } } = {} -- traffic rigs by vehicle type (marker-0133)
-- Decorative ONCOMING stream (marker-0136): visual-only cars in the opposing (left)
-- lane that rush toward the player. Not collidable — the engine traffic above is the
-- real, same-direction, avoidable traffic. { rig } pool + { roadZ, laneX, init } state.
local oncPool: { any } = {}
local oncState: { { roadZ: number, laneX: number, init: boolean } } = {}
local ONC_N = 8
local ONC_SPEED = 15000 -- extra closing speed (road units / sec) on top of the treadmill
local signs = {} -- roadside billboards { post, panel, label }
local gantries = {} -- over-road CHECKPOINT / FINISH arches { postL, postR, beam, sign, label }
local signMyName = "" -- local player's display name (for "GO <name>" boards)
local SIGN_ADS = { "SUNSET COLA", "NEON TYRES", "TURBO FUEL", "RETRO RADIO", "VOLT ENERGY", "CHROME WHEELS" }
local pads: { Part } = {}
local ghostRigs = {} -- rival car rigs (marker-0104)
local ghostTags: { TextLabel } = {}
local dashes: { Part } = {} -- scrolling centre-line dashes (speed cue)
local props = {} -- pooled roadside scenery rigs { trunk, canopy }
local ground: Part
local carRig -- player car rig (body + cabin + 4 wheels)
local boostEmitter: ParticleEmitter -- cyan trail while boosting (marker-0112)
local boostActive = false
local camShake = 0 -- decaying crash shake magnitude (marker-0137)

-- Audio (marker-0118): bundled rbxasset sounds (no marketplace assets). One ping is
-- re-pitched for checkpoint/countdown/GO/finish; distinct sounds for crash/boost.
local SoundService = game:GetService("SoundService")
local sfxPing, sfxCrash, sfxBoost
local prevCrashS, prevBoostS, prevTimerS, prevFinishS, prevCdBeep = 0, 0, -1, -1, 0

local DASH_SPACING = ROAD_UNIT * 3 -- one centre dash every 3 road units
local PROP_SPACING = ROAD_UNIT * 6 -- a roadside prop slot every 6 road units
local hud: { speed: TextLabel, timer: TextLabel, stage: TextLabel, score: TextLabel, banner: TextLabel, pos: TextLabel, prog: Frame }
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
-- A detailed low-poly SPORTS car (marker-0123): a sculpted silhouette from ~24
-- Parts/Wedges — long low hood, raked screen, fastback roof, rear haunches,
-- splitter, side skirts, wing, and light bars — so it reads like a classic
-- coupe (Porsche/Corvette/Ferrari/Mustang) rather than a box. `variant` (1..3)
-- shifts the proportions so the field looks varied without runtime restyling.
local function makeCarRig(bodyColor: Color3, parent: Instance, variant: number?)
	local v = variant or 1
	local rig = { parts = {}, body = nil :: Part? }
	local trim = bodyColor:Lerp(Color3.new(0, 0, 0), 0.35)
	local glass = Color3.fromRGB(120, 165, 200)
	local function add(p, offset, shownT)
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
		p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
		p.Parent = parent
		p.Transparency = shownT or 0
		table.insert(rig.parts, { part = p, offset = offset, t = shownT or 0 })
		return p
	end
	local function box(size, color, offset, material, shownT)
		local p = Instance.new("Part")
		p.Size, p.Color, p.Material = size, color, material or Enum.Material.SmoothPlastic
		return add(p, offset, shownT)
	end
	local function cyl(size, color, offset, material)
		local p = Instance.new("Part")
		p.Shape = Enum.PartType.Cylinder
		p.Size, p.Color, p.Material = size, color, material or Enum.Material.SmoothPlastic
		return add(p, offset)
	end
	-- WedgePart: tall vertical face at +Z, slope descends toward -Z.
	local function wedge(size, color, offset, material)
		local p = Instance.new("WedgePart")
		p.Size, p.Color, p.Material = size, color, material or Enum.Material.SmoothPlastic
		return add(p, offset)
	end

	-- Per-variant proportions: length, ride height, roof rake, wing size.
	local L = ({ 12.5, 13.5, 12.0 })[v] -- overall body length
	local rideY = ({ 0.0, 0.15, -0.15 })[v] -- muscle sits higher, supercar lower
	local roofZ = ({ 0.7, 1.1, 0.4 })[v] -- cabin bias (muscle roof further back)
	local wingH = ({ 1.35, 1.5, 1.6 })[v]

	-- Shadow first (kept subtle even when the pooled car is "shown").
	box(Vector3.new(8.4, 0.2, L + 2), Color3.fromRGB(16, 10, 18), CFrame.new(0, -1.35 + rideY, 0), Enum.Material.SmoothPlastic, 0.55)
	-- [1] main lower hull, [2] cabin — kept first for compatibility with setCarStyle.
	rig.body = box(Vector3.new(6.2, 1.5, L), bodyColor, CFrame.new(0, rideY, 0))
	box(Vector3.new(4.3, 1.15, 4.4), trim, CFrame.new(0, rideY + 1.15, roofZ)) -- greenhouse cabin
	-- Long sloping hood (front) and a fastback roofline (rear of the cabin).
	local hood = wedge(Vector3.new(5.7, 1.0, L * 0.34), bodyColor, CFrame.new(0, rideY + 0.85, -L * 0.28))
	wedge(Vector3.new(4.3, 1.15, L * 0.3), trim, CFrame.new(0, rideY + 1.1, roofZ + L * 0.24) * CFrame.Angles(0, math.rad(180), 0)) -- fastback
	rig.bodyParts = { rig.body, hood } -- body-coloured panels (tinted together on boost/crash)
	-- Raked windshield + rear glass.
	box(Vector3.new(4.0, 0.18, 2.7), glass, CFrame.new(0, rideY + 1.55, roofZ - 2.2) * CFrame.Angles(math.rad(-32), 0, 0), Enum.Material.Glass, 0.25)
	box(Vector3.new(3.9, 0.18, 2.3), glass, CFrame.new(0, rideY + 1.5, roofZ + 2.3) * CFrame.Angles(math.rad(34), 0, 0), Enum.Material.Glass, 0.25)
	-- Belt/side stripe + skirts to break up the slab sides.
	box(Vector3.new(6.3, 0.5, L * 0.9), trim, CFrame.new(0, rideY - 0.55, 0))
	box(Vector3.new(0.4, 0.5, L * 0.7), Color3.fromRGB(24, 24, 28), CFrame.new(-3.05, rideY - 0.5, 0.3))
	box(Vector3.new(0.4, 0.5, L * 0.7), Color3.fromRGB(24, 24, 28), CFrame.new(3.05, rideY - 0.5, 0.3))
	-- Rear haunches (small wedges over the back wheels) for a muscular stance.
	table.insert(rig.bodyParts, wedge(Vector3.new(1.3, 0.9, 3.2), bodyColor, CFrame.new(-2.7, rideY + 0.35, L * 0.22) * CFrame.Angles(0, math.rad(180), 0)))
	table.insert(rig.bodyParts, wedge(Vector3.new(1.3, 0.9, 3.2), bodyColor, CFrame.new(2.7, rideY + 0.35, L * 0.22) * CFrame.Angles(0, math.rad(180), 0)))
	-- Front splitter + rear diffuser.
	box(Vector3.new(6.0, 0.3, 1.1), Color3.fromRGB(28, 28, 32), CFrame.new(0, rideY - 0.75, -L * 0.5 + 0.4))
	box(Vector3.new(6.0, 0.35, 1.0), Color3.fromRGB(28, 28, 32), CFrame.new(0, rideY - 0.7, L * 0.5 - 0.4))
	-- Wheels (wide, low) + bright hubcaps + dark arches.
	local wheel = Vector3.new(1.5, 2.7, 2.7)
	local wz = L * 0.3
	for _, wx in ipairs({ -3.05, 3.05 }) do
		for _, z in ipairs({ -wz, wz }) do
			cyl(wheel, Color3.fromRGB(22, 22, 26), CFrame.new(wx, rideY - 0.85, z))
			cyl(Vector3.new(1.55, 1.2, 1.2), Color3.fromRGB(180, 182, 190), CFrame.new(wx, rideY - 0.85, z))
		end
	end
	-- Headlights (slim neon), full-width taillight bar (neon red).
	box(Vector3.new(1.3, 0.45, 0.35), Color3.fromRGB(255, 248, 220), CFrame.new(-1.9, rideY + 0.15, -L * 0.5 + 0.2), Enum.Material.Neon)
	box(Vector3.new(1.3, 0.45, 0.35), Color3.fromRGB(255, 248, 220), CFrame.new(1.9, rideY + 0.15, -L * 0.5 + 0.2), Enum.Material.Neon)
	box(Vector3.new(5.2, 0.45, 0.3), Color3.fromRGB(235, 42, 42), CFrame.new(0, rideY + 0.35, L * 0.5 - 0.2), Enum.Material.Neon)
	-- Rear wing on two posts (bigger on the supercar variant).
	box(Vector3.new(6.0, 0.28, 1.5), trim, CFrame.new(0, rideY + wingH, L * 0.45))
	box(Vector3.new(0.4, wingH - 0.5, 0.5), Color3.fromRGB(28, 28, 32), CFrame.new(-2.4, rideY + wingH * 0.55, L * 0.45))
	box(Vector3.new(0.4, wingH - 0.5, 0.5), Color3.fromRGB(28, 28, 32), CFrame.new(2.4, rideY + wingH * 0.55, L * 0.45))
	-- Detail accents: wing mirrors, hood vents, door line, twin exhaust tips.
	box(Vector3.new(0.5, 0.4, 1.0), trim, CFrame.new(-3.0, rideY + 1.15, roofZ - 2.3)) -- mirrors
	box(Vector3.new(0.5, 0.4, 1.0), trim, CFrame.new(3.0, rideY + 1.15, roofZ - 2.3))
	box(Vector3.new(1.6, 0.14, 2.4), Color3.fromRGB(28, 28, 32), CFrame.new(0, rideY + 1.0, -L * 0.26)) -- hood vent
	box(Vector3.new(3.6, 0.14, 0.14), trim, CFrame.new(-3.12, rideY + 0.15, 0.4)) -- door crease
	box(Vector3.new(3.6, 0.14, 0.14), trim, CFrame.new(3.12, rideY + 0.15, 0.4))
	cyl(Vector3.new(0.7, 0.5, 0.5), Color3.fromRGB(70, 70, 78), CFrame.new(-1.3, rideY - 0.7, L * 0.5 + 0.1)) -- exhaust
	cyl(Vector3.new(0.7, 0.5, 0.5), Color3.fromRGB(70, 70, 78), CFrame.new(1.3, rideY - 0.7, L * 0.5 + 0.1))
	return rig
end

local function placeCar(rig, cf: CFrame)
	for _, e in ipairs(rig.parts) do
		e.part.CFrame = cf * e.offset
	end
end

local function setCarShown(rig, shown: boolean)
	for _, e in ipairs(rig.parts) do
		e.part.Transparency = shown and e.t or 1
	end
end

-- Recolour the whole body shell (hull + hood + haunches) so a car is one colour.
local function tintCar(rig, color: Color3)
	for _, bp in ipairs(rig.bodyParts) do
		bp.Color = color
	end
end

-- Shape variety is now baked per rig at creation (variant 1..3 in makeCarRig), so
-- these are no-ops kept only so existing call sites stay valid.
local RIVAL_STYLES = { 1, 2, 3 }
local function setCarStyle(_rig, _key)
end
local function trafficStyleKey(_kind: number)
	return 1
end

-- Varied TRAFFIC vehicles (marker-0133): sedan / estate / fast / bus / lorry / bike,
-- each a distinct silhouette. Shared rig scaffold produces the same table shape as
-- makeCarRig (parts/bodyParts) so placeCar/setCarShown/tintCar all work unchanged.
local function rigBuilder(parent)
	local rig = { parts = {}, body = nil :: Part?, bodyParts = {} }
	local function add(p, offset, shownT, isBody)
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
		p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
		p.Parent = parent
		p.Transparency = shownT or 0
		table.insert(rig.parts, { part = p, offset = offset, t = shownT or 0 })
		if isBody then
			table.insert(rig.bodyParts, p)
		end
		return p
	end
	local function box(size, color, offset, material, shownT, isBody)
		local p = Instance.new("Part")
		p.Size, p.Color, p.Material = size, color, material or Enum.Material.SmoothPlastic
		return add(p, offset, shownT, isBody)
	end
	local function cyl(size, color, offset)
		local p = Instance.new("Part")
		p.Shape = Enum.PartType.Cylinder
		p.Size, p.Color, p.Material = size, color, Enum.Material.SmoothPlastic
		return add(p, offset)
	end
	local function wedge(size, color, offset, isBody)
		local p = Instance.new("WedgePart")
		p.Size, p.Color, p.Material = size, color, Enum.Material.SmoothPlastic
		return add(p, offset, nil, isBody)
	end
	return rig, box, cyl, wedge
end

local WHEEL_C = Color3.fromRGB(24, 24, 28)
local GLASS_C = Color3.fromRGB(140, 175, 205)
local function makeVehicleRig(vtype: string, parent: Instance)
	local rig, box, cyl, wedge = rigBuilder(parent)
	local base = Color3.fromRGB(200, 200, 210)
	local function shadow(len)
		local p = box(Vector3.new(7, 0.2, len), Color3.fromRGB(16, 10, 18), CFrame.new(0, -1.9, 0), Enum.Material.SmoothPlastic, 0.55)
		return p
	end
	local function wheelSet(list, wheel)
		for _, w in ipairs(list) do
			cyl(wheel, WHEEL_C, CFrame.new(w[1], w[2], w[3]))
		end
	end
	if vtype == "bus" then
		shadow(24)
		rig.body = box(Vector3.new(7.4, 5, 22), base, CFrame.new(0, 0.6, 0), nil, nil, true)
		box(Vector3.new(7.5, 1.6, 20), GLASS_C, CFrame.new(0, 2.2, 0), Enum.Material.Glass, 0.2)
		box(Vector3.new(5.4, 1, 3), Color3.fromRGB(255, 246, 214), CFrame.new(0, 0.4, -11), Enum.Material.Neon)
		box(Vector3.new(6.4, 0.7, 0.4), Color3.fromRGB(235, 42, 42), CFrame.new(0, 0.6, 11), Enum.Material.Neon)
		wheelSet({ { -3.2, -1.7, -7 }, { 3.2, -1.7, -7 }, { -3.2, -1.7, 7 }, { 3.2, -1.7, 7 } }, Vector3.new(1.6, 3.2, 3.2))
	elseif vtype == "lorry" then
		shadow(21)
		box(Vector3.new(6.6, 4.2, 6), base, CFrame.new(0, 0.4, -6), nil, nil, true) -- cab
		box(Vector3.new(5.6, 1.2, 0.4), GLASS_C, CFrame.new(0, 1.6, -9), Enum.Material.Glass, 0.2)
		rig.body = box(Vector3.new(7, 4.8, 13), Color3.fromRGB(160, 160, 170), CFrame.new(0, 0.7, 3.2), nil, nil, true) -- box trailer
		wheelSet({ { -3.1, -1.6, -6 }, { 3.1, -1.6, -6 }, { -3.2, -1.6, 3 }, { 3.2, -1.6, 3 }, { -3.2, -1.6, 8 }, { 3.2, -1.6, 8 } }, Vector3.new(1.5, 3, 3))
	elseif vtype == "bike" then
		shadow(7)
		rig.body = box(Vector3.new(1.6, 1.6, 6.5), base, CFrame.new(0, 0, 0), nil, nil, true)
		box(Vector3.new(1.8, 2.6, 2), Color3.fromRGB(38, 38, 46), CFrame.new(0, 1.4, 0.6)) -- rider
		box(Vector3.new(2.2, 0.5, 0.6), Color3.fromRGB(30, 30, 34), CFrame.new(0, 0.9, -2.6)) -- handlebars
		cyl(Vector3.new(0.7, 3, 3), WHEEL_C, CFrame.new(0, -0.7, -2.8))
		cyl(Vector3.new(0.7, 3, 3), WHEEL_C, CFrame.new(0, -0.7, 2.8))
	elseif vtype == "estate" then
		shadow(13)
		rig.body = box(Vector3.new(6, 2, 12), base, CFrame.new(0, 0, 0), nil, nil, true)
		box(Vector3.new(5, 2, 7), base, CFrame.new(0, 1.7, 1.6), nil, nil, true) -- long wagon roof
		box(Vector3.new(4.6, 1.5, 4.6), GLASS_C, CFrame.new(0, 1.7, 0.4), Enum.Material.Glass, 0.2)
		box(Vector3.new(1.1, 0.5, 0.3), Color3.fromRGB(255, 246, 214), CFrame.new(-1.9, 0.2, -6), Enum.Material.Neon)
		box(Vector3.new(1.1, 0.5, 0.3), Color3.fromRGB(255, 246, 214), CFrame.new(1.9, 0.2, -6), Enum.Material.Neon)
		wheelSet({ { -3, -1, -3.8 }, { 3, -1, -3.8 }, { -3, -1, 3.8 }, { 3, -1, 3.8 } }, Vector3.new(1.3, 2.5, 2.5))
	elseif vtype == "fast" then
		shadow(12)
		rig.body = box(Vector3.new(6, 1.5, 12), base, CFrame.new(0, -0.1, 0), nil, nil, true)
		box(Vector3.new(4.2, 1.2, 4.2), Color3.fromRGB(30, 30, 36), CFrame.new(0, 1, 0.8))
		wedge(Vector3.new(5.4, 1, 4), base, CFrame.new(0, 0.8, -4), true)
		box(Vector3.new(5.8, 0.26, 1.4), Color3.fromRGB(30, 30, 34), CFrame.new(0, 1.3, 5)) -- wing
		box(Vector3.new(5.2, 0.45, 0.3), Color3.fromRGB(235, 42, 42), CFrame.new(0, 0.35, 5.9), Enum.Material.Neon)
		wheelSet({ { -3, -0.9, -3.4 }, { 3, -0.9, -3.4 }, { -3, -0.9, 3.4 }, { 3, -0.9, 3.4 } }, Vector3.new(1.4, 2.6, 2.6))
	else -- sedan
		shadow(11)
		rig.body = box(Vector3.new(6, 2, 11), base, CFrame.new(0, 0, 0), nil, nil, true)
		box(Vector3.new(4.8, 1.8, 5.2), base, CFrame.new(0, 1.6, 0.6), nil, nil, true) -- roof
		box(Vector3.new(4.4, 1.4, 4.4), GLASS_C, CFrame.new(0, 1.6, 0.2), Enum.Material.Glass, 0.2)
		box(Vector3.new(1.1, 0.5, 0.3), Color3.fromRGB(255, 246, 214), CFrame.new(-1.9, 0.2, -5.5), Enum.Material.Neon)
		box(Vector3.new(1.1, 0.5, 0.3), Color3.fromRGB(255, 246, 214), CFrame.new(1.9, 0.2, -5.5), Enum.Material.Neon)
		box(Vector3.new(5, 0.4, 0.3), Color3.fromRGB(235, 42, 42), CFrame.new(0, 0.35, 5.5), Enum.Material.Neon)
		wheelSet({ { -3, -1, -3.4 }, { 3, -1, -3.4 }, { -3, -1, 3.4 }, { 3, -1, 3.4 } }, Vector3.new(1.3, 2.5, 2.5))
	end
	return rig
end

local function trafficType(kind: number, id: number?): string
	if kind == 2 then
		return "lorry"
	elseif kind == 3 then
		return "bus"
	elseif kind == 4 then
		return "bike"
	end
	local m = (id or 0) % 3 -- vary plain "car" kind into three body types
	return (m == 0 and "sedan") or (m == 1 and "estate") or "fast"
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
	L.FogStart = 1400 -- light haze only; the road's end is faded manually (far strips),
	L.FogEnd = 3600 -- pushed back so the sunset backdrop stays SATURATED to the screen edges
	L.EnvironmentDiffuseScale = 0.25
	L.EnvironmentSpecularScale = 0.2
	local atmo = L:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmo.Density = 0.1 -- low: high haze was washing the horizon edges to grey-blue
	atmo.Offset = 0.2
	atmo.Color = Color3.fromRGB(220, 150, 120)
	atmo.Decay = Color3.fromRGB(190, 80, 100)
	atmo.Glare = 0.15
	atmo.Haze = 0.3
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
-- Bold OutRun sunset gradient. Tall, warm bands dominate so the sunset fills the
-- whole forward view (indigo only at the very top); very wide so it spans the
-- screen at any FOV. {color, yCentre, height}
local SKY_W = 24000
local SKY_BANDS = {
	{ Color3.fromRGB(255, 146, 70), 40, 520 }, -- orange horizon (tall)
	{ Color3.fromRGB(234, 84, 92), 420, 380 }, -- coral / red
	{ Color3.fromRGB(188, 60, 118), 760, 360 }, -- magenta
	{ Color3.fromRGB(110, 50, 130), 1120, 480 }, -- purple
	{ Color3.fromRGB(48, 32, 92), 2000, 1800 }, -- indigo (top only)
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
		p.Size = Vector3.new(SKY_W, b[3], 20)
		p.Color = b[1]
		p.CFrame = CFrame.new(0, baseY + b[2], SKY_Z)
		p.Parent = parent
	end
	-- Full-width warm neon glow in front of the wall, so the sunset around the sun
	-- reaches both screen edges (not a central patch).
	local SUN_Y = baseY + 110
	for _, g in ipairs({
		{ 520, 90, Color3.fromRGB(255, 140, 80), 0.2 }, -- {height, yOff, color, transparency}
		{ 420, 380, Color3.fromRGB(228, 84, 110), 0.4 }, -- magenta above
		{ 520, 720, Color3.fromRGB(120, 58, 140), 0.6 }, -- purple, blends up
	}) do
		local band = Instance.new("Part")
		band.Anchored, band.CanCollide, band.CanQuery, band.CanTouch = true, false, false, false
		band.Material = Enum.Material.Neon
		band.Size = Vector3.new(SKY_W, g[1], 2)
		band.Color = g[3]
		band.Transparency = g[4]
		band.CFrame = CFrame.new(0, baseY + g[2], SKY_Z + 4)
		band.Parent = parent
	end
	-- The setting sun: a big neon disc on the horizon, with dark horizontal cuts
	-- across its lower half (classic OutRun look). Sits just in front of the glow so
	-- it never z-fights; its lower half dips below the ground horizon.
	local D = 360
	local sun = Instance.new("Part")
	sun.Anchored, sun.CanCollide, sun.CanQuery, sun.CanTouch = true, false, false, false
	sun.Shape = Enum.PartType.Cylinder
	sun.Material = Enum.Material.Neon
	sun.Color = Color3.fromRGB(255, 168, 78)
	sun.Size = Vector3.new(5, D, D)
	sun.CFrame = CFrame.new(0, SUN_Y, SKY_Z + 8) * CFrame.Angles(0, math.rad(90), 0)
	sun.Parent = parent
	-- Horizontal cut lines across the lower half (they read as sky showing through).
	for i = 0, 5 do
		local cut = Instance.new("Part")
		cut.Anchored, cut.CanCollide, cut.CanQuery, cut.CanTouch = true, false, false, false
		cut.Material = Enum.Material.SmoothPlastic
		cut.Color = Color3.fromRGB(150, 46, 96)
		cut.Size = Vector3.new(D, 5 + i * 1.4, 2)
		cut.CFrame = CFrame.new(0, SUN_Y - 30 - i * 22, SKY_Z + 10)
		cut.Parent = parent
	end
	-- A few soft dusk clouds high across the sky for depth (flat, warm, off-centre so
	-- they don't sit on the sun). Static — the treadmill camera barely moves.
	local clouds = {
		{ -2600, 780, 1500, 0.45 }, { 2200, 900, 1300, 0.5 }, { -900, 1150, 1100, 0.55 },
		{ 3000, 1250, 1400, 0.6 }, { -3400, 1050, 1200, 0.6 },
	}
	for _, c in ipairs(clouds) do
		local cl = Instance.new("Part")
		cl.Anchored, cl.CanCollide, cl.CanQuery, cl.CanTouch = true, false, false, false
		cl.Material = Enum.Material.SmoothPlastic
		cl.Color = Color3.fromRGB(226, 150, 150)
		cl.Transparency = c[4]
		cl.Size = Vector3.new(c[3], 120, 2)
		cl.CFrame = CFrame.new(c[1], baseY + c[2], SKY_Z + 2)
		cl.Parent = parent
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
	-- Traffic rigs pooled per vehicle type (varied shapes; assigned by kind + id).
	for vtype, n in pairs({ sedan = 4, estate = 2, fast = 3, bus = 2, lorry = 2, bike = 2 }) do
		vehPool[vtype] = {}
		for i = 1, n do
			local rig = makeVehicleRig(vtype, world)
			setCarShown(rig, false)
			vehPool[vtype][i] = rig
		end
	end
	-- Decorative oncoming cars (varied types), hidden until placed each frame.
	local oncTypes = { "sedan", "estate", "fast", "sedan", "bus", "estate", "sedan", "lorry" }
	for i = 1, ONC_N do
		local rig = makeVehicleRig(oncTypes[i] or "sedan", world)
		setCarShown(rig, false)
		oncPool[i] = rig
		oncState[i] = { roadZ = 0, laneX = -200, init = false }
	end
	local myName = game:GetService("Players").LocalPlayer.DisplayName
	for i = 1, 4 do
		local post = mkPart("post", Vector3.new(1.4, 20, 1.4), Color3.fromRGB(110, 88, 66), world, Enum.Material.Wood)
		local panel = mkPart("panel", Vector3.new(30, 16, 1), Color3.fromRGB(210, 210, 220), world)
		post.Transparency = 1
		panel.Transparency = 1
		-- Text on the board face toward the camera (+Z = Back face).
		local sg = Instance.new("SurfaceGui")
		sg.Face = Enum.NormalId.Back
		sg.CanvasSize = Vector2.new(600, 320)
		sg.Adornee = panel
		sg.Parent = panel
		local lbl = Instance.new("TextLabel")
		lbl.BackgroundTransparency = 1
		lbl.Size = UDim2.new(0.9, 0, 0.8, 0)
		lbl.Position = UDim2.new(0.05, 0, 0.1, 0)
		lbl.Font = Enum.Font.GothamBold
		lbl.TextScaled = true
		lbl.TextColor3 = Color3.fromRGB(30, 20, 40)
		lbl.Text = ""
		lbl.Parent = sg
		signs[i] = { post = post, panel = panel, label = lbl }
	end
	signMyName = myName
	for i = 1, 8 do
		local p = mkPart("pad", Vector3.new(roadW * 0.5, 0.4, 6), Color3.fromRGB(40, 224, 255), world, Enum.Material.Neon)
		p.Transparency = 1
		pads[i] = p
	end
	-- Over-road CHECKPOINT / FINISH gantries (pool of 3; few visible at once).
	for i = 1, 3 do
		local postL = mkPart("gpostL", Vector3.new(2, 34, 2), Color3.fromRGB(70, 72, 84), world, Enum.Material.Metal)
		local postR = mkPart("gpostR", Vector3.new(2, 34, 2), Color3.fromRGB(70, 72, 84), world, Enum.Material.Metal)
		local beam = mkPart("gbeam", Vector3.new(roadW + 26, 5, 3), Color3.fromRGB(44, 46, 58), world, Enum.Material.Metal)
		local sign = mkPart("gsign", Vector3.new(roadW + 12, 7, 1), Color3.fromRGB(30, 180, 90), world)
		local sg = Instance.new("SurfaceGui")
		sg.Face = Enum.NormalId.Back
		sg.CanvasSize = Vector2.new(900, 140)
		sg.Adornee = sign
		sg.Parent = sign
		local lbl = Instance.new("TextLabel")
		lbl.BackgroundTransparency = 1
		lbl.Size = UDim2.new(1, 0, 1, 0)
		lbl.Font = Enum.Font.GothamBlack
		lbl.TextScaled = true
		lbl.TextColor3 = Color3.fromRGB(255, 255, 255)
		lbl.Text = "CHECKPOINT"
		lbl.Parent = sg
		for _, p in ipairs({ postL, postR, beam, sign }) do
			p.Transparency = 1
		end
		gantries[i] = { postL = postL, postR = postR, beam = beam, sign = sign, label = lbl }
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
		local rig = makeCarRig(RIVAL_COLORS[(i % 4) + 1], world, ((i + 1) % 3) + 1)
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
	carRig = makeCarRig(Color3.fromRGB(224, 72, 48), world, 3) -- player = low supercar
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
	-- Stage progress bar along the very top (fill grows with stages cleared).
	local progBg = Instance.new("Frame")
	progBg.Position = UDim2.new(0.3, 0, 0.005, 0)
	progBg.Size = UDim2.new(0.4, 0, 0.012, 0)
	progBg.BackgroundColor3 = Color3.fromRGB(30, 22, 44)
	progBg.BackgroundTransparency = 0.35
	progBg.BorderSizePixel = 0
	progBg.Parent = gui
	local progFill = Instance.new("Frame")
	progFill.Size = UDim2.new(0, 0, 1, 0)
	progFill.BackgroundColor3 = Color3.fromRGB(90, 224, 235)
	progFill.BorderSizePixel = 0
	progFill.Parent = progBg

	hud = {
		speed = label(UDim2.new(0.6, 0, 0.8, 0), UDim2.new(0.38, 0, 0.16, 0), Enum.TextXAlignment.Right),
		timer = label(UDim2.new(0.35, 0, 0.015, 0), UDim2.new(0.3, 0, 0.16, 0), Enum.TextXAlignment.Center),
		stage = label(UDim2.new(0.02, 0, 0.8, 0), UDim2.new(0.3, 0, 0.16, 0), Enum.TextXAlignment.Left),
		score = label(UDim2.new(0.62, 0, 0.02, 0), UDim2.new(0.36, 0, 0.09, 0), Enum.TextXAlignment.Right),
		banner = label(UDim2.new(0.25, 0, 0.4, 0), UDim2.new(0.5, 0, 0.12, 0), Enum.TextXAlignment.Center),
		pos = label(UDim2.new(0.02, 0, 0.68, 0), UDim2.new(0.3, 0, 0.12, 0), Enum.TextXAlignment.Left),
		prog = progFill,
	}
	hud.stage.TextColor3 = Color3.fromRGB(90, 224, 235) -- cyan like the browser
	hud.score.TextColor3 = Color3.fromRGB(255, 220, 74)
	hud.pos.TextColor3 = Color3.fromRGB(255, 255, 255)

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
					-- Much fuller canopies + slimmer trunks (playtest: trees looked sparse).
					local trunkH, canopySize, canopyY
					if isPalm then
						trunkH, canopySize, canopyY = 26, Vector3.new(52, 16, 52), 30 -- tall trunk + wide fronds
					elseif isFir then
						trunkH, canopySize, canopyY = 10, Vector3.new(30, 46, 30), 24 -- short trunk + tall conical foliage
					else
						trunkH, canopySize, canopyY = 8, Vector3.new(34, 30, 34), 16 -- bush
					end
					rig.trunk.Transparency = 0
					rig.trunk.Size = Vector3.new(1, trunkH, 1) -- slimmer stem
					rig.trunk.CFrame = CFrame.new(x, baseY + trunkH / 2, z)
					rig.canopy.Transparency = 0
					rig.canopy.Color = isFir and Color3.fromRGB(40, 96, 54) or foliage
					rig.canopy.Size = canopySize
					rig.canopy.CFrame = CFrame.new(x, baseY + canopyY, z)
					-- palms get a second, offset crown layer for fuller fronds
					if isPalm then
						rig.frond.Transparency = 0
						rig.frond.Color = Color3.fromRGB(52, 146, 66)
						rig.frond.Size = Vector3.new(42, 12, 42)
						rig.frond.CFrame = CFrame.new(x, baseY + canopyY + 6, z)
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
				-- Post BEHIND the board (z - 1.6) and BELOW it, so it never shows through.
				sg.post.Transparency = 0
				sg.post.CFrame = CFrame.new(x, y + 10, z - 1.6)
				sg.panel.Transparency = 0
				local goBoard = slot % 3 == 0
				sg.panel.Color = goBoard and Color3.fromRGB(70, 190, 90) or Color3.fromRGB(236, 232, 214)
				sg.panel.CFrame = CFrame.new(x, y + 27, z)
				if sg.label then
					if goBoard and signMyName ~= "" then
						sg.label.Text = "GO " .. string.upper(signMyName) .. "!"
						sg.label.TextColor3 = Color3.fromRGB(255, 255, 255)
					else
						sg.label.Text = SIGN_ADS[(slot % #SIGN_ADS) + 1]
						sg.label.TextColor3 = Color3.fromRGB(40, 26, 52)
					end
				end
			else
				sg.post.Transparency, sg.panel.Transparency = 1, 1
			end
		else
			sg.post.Transparency, sg.panel.Transparency = 1, 1
		end
	end

	-- Over-road CHECKPOINT / FINISH gantries at upcoming segment boundaries.
	local gi2 = 0
	local prevSeg = built[1] and built[1].seg or nil
	for k = 2, N do
		local s = built[k]
		if s and s.seg ~= prevSeg then
			prevSeg = s.seg
			local isCp = (s.seg.checkpointTicks or 0) > 0
			local isFinish = road.nextSegment(courseSet, s.seg.id, seat.forkChoice or 0) == -1
			if (isCp or isFinish) and gi2 < #gantries then
				gi2 += 1
				local g = gantries[gi2]
				local x, y, z = s.curveX * SX, BASE_Y + s.hill * SY, ZSHIFT - s.dz * SZ
				local topY = y + 30
				g.postL.Transparency, g.postR.Transparency, g.beam.Transparency, g.sign.Transparency = 0, 0, 0, 0
				g.postL.CFrame = CFrame.new(x - roadHalfStuds - 5, y + 17, z)
				g.postR.CFrame = CFrame.new(x + roadHalfStuds + 5, y + 17, z)
				g.beam.CFrame = CFrame.new(x, topY, z)
				g.sign.CFrame = CFrame.new(x, topY - 4, z + 0.6)
				g.sign.Color = isFinish and Color3.fromRGB(238, 238, 244) or Color3.fromRGB(30, 180, 90)
				g.label.Text = isFinish and "FINISH" or "CHECKPOINT"
				g.label.TextColor3 = isFinish and Color3.fromRGB(20, 20, 24) or Color3.fromRGB(255, 255, 255)
			end
		end
	end
	for i = gi2 + 1, #gantries do
		local g = gantries[i]
		g.postL.Transparency, g.postR.Transparency, g.beam.Transparency, g.sign.Transparency = 1, 1, 1, 1
	end

	local near = built[1]
	local baseHill = near and near.hill * SY or 0
	local carX = laneX * SX
	local boosting = seat.boostTicks > 0
	local baseCol = PLAYER_CAR_COLORS[view.car or 1] or Color3.fromRGB(224, 72, 48)
	-- Steady base = your SELECTED car colour; only boost (cyan) / crash (white) change it.
	local carCol = boosting and Color3.fromRGB(120, 240, 255)
		or (seat.crashedTicks > 0 and Color3.fromRGB(255, 255, 255) or baseCol)
	tintCar(carRig, carCol) -- whole shell (hull, hood, haunches) together
	boostActive = boosting
	if boostEmitter then
		boostEmitter.Enabled = boosting
	end
	placeCar(carRig, CFrame.new(carX, BASE_Y + baseHill + 1.6, 4))

	-- Same-segment traffic ahead, NEAREST-first, each drawn with a rig of the right
	-- vehicle type (sedan/estate/fast/bus/lorry/bike) from that type's pool. Left-lane
	-- traffic faces the camera (ONCOMING); right-lane faces away (you overtake).
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
	local vehUsed = {}
	for _, e in ipairs(nearTraffic) do
		local t = e.t
		local vtype = trafficType(t.kind, t.id)
		local pool = vehPool[vtype]
		local idx = (vehUsed[vtype] or 0) + 1
		if pool and idx <= #pool then
			local s = built[math.min(math.floor(e.dz / ROAD_UNIT) + 1, N)]
			if s then
				vehUsed[vtype] = idx
				local rig = pool[idx]
				setCarShown(rig, true)
				tintCar(rig, carColor(t.id or idx, 0)) -- stable colour by identity
				-- Engine traffic is SAME-direction (you overtake) -> faces away (taillights).
				placeCar(rig, CFrame.new((s.curveX + t.laneX) * SX, BASE_Y + s.hill * SY + 1.6, ZSHIFT - e.dz * SZ))
			end
		end
	end
	for vtype, pool in pairs(vehPool) do
		for i = (vehUsed[vtype] or 0) + 1, #pool do
			setCarShown(pool[i], false)
		end
	end

	-- Decorative oncoming cars (left lane, facing the camera). Purely visual: their
	-- roadZ is advanced toward the player in Render.step; here we respawn far ahead
	-- once they pass and place them along the road curve.
	for i = 1, ONC_N do
		local o = oncState[i]
		local dz = o.roadZ - rz
		if (not o.init) or dz < -1600 then
			o.roadZ = rz + drawDz + math.random(0, 4000) -- staggered far ahead
			o.laneX = -math.random(150, 360) -- opposing (left) lane
			o.init = true
			dz = o.roadZ - rz
		end
		local rig = oncPool[i]
		if dz >= 0 and dz <= drawDz then
			local s = built[math.min(math.floor(dz / ROAD_UNIT) + 1, N)]
			if s then
				setCarShown(rig, true)
				tintCar(rig, carColor(i + 5, 0))
				placeCar(rig, CFrame.new((s.curveX + o.laneX) * SX, BASE_Y + s.hill * SY + 1.6, ZSHIFT - dz * SZ) * CFrame.Angles(0, math.pi, 0))
			else
				setCarShown(rig, false)
			end
		else
			setCarShown(rig, false)
		end
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
				tintCar(rig, carColor(g.seatId + 3, 0)) -- stable colour by seat (no biome flicker)
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
	local field = view.fieldSize or 6
	hud.pos.Text = "P" .. (view.position or 1) .. "/" .. field
	hud.pos.TextColor3 = (view.position == 1) and Color3.fromRGB(255, 220, 74) or Color3.fromRGB(235, 235, 245)
	local frac = (STAGE_TOTAL > 0) and math.clamp(lastStage / STAGE_TOTAL, 0, 1) or 0
	hud.prog.Size = UDim2.new(frac, 0, 1, 0)
	-- show race HUD only while a race is on-screen
	local onTrack = view.phase == "racing" or view.raceOver
	hud.pos.Visible = onTrack
	hud.prog.Parent.Visible = onTrack
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
		camShake = 1 -- kick the camera on a fresh crash
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
		hud.banner.Text = "SPECTATING  " .. (view.watchingName or "leader")
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
	-- Advance decorative oncoming cars toward the player (only during the race).
	if latest.phase == "racing" then
		for i = 1, ONC_N do
			oncState[i].roadZ -= ONC_SPEED * dt
		end
	end
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
	-- Decaying crash shake.
	if camShake > 0.02 then
		local m = camShake * 3.5
		eye += Vector3.new((math.random() - 0.5) * m, (math.random() - 0.5) * m, 0)
		camShake *= 0.86
	else
		camShake = 0
	end
	-- FOV kick while boosting adds to the sense of speed.
	local cam = workspace.CurrentCamera
	cam.FieldOfView += ((boostActive and 82 or 70) - cam.FieldOfView) * 0.12
	return CFrame.lookAt(eye, look)
end

return Render

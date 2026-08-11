--!strict
-- Sunset Runner — authoritative server. Runs the SAME deterministic reducer as the
-- browser/lune twin (ReplicatedStorage.Shared) at 20 Hz. ONE SHARED race of a fixed
-- number of seats (marker-0110): players take over AI seats on join (drop-in) and a
-- seat reverts to AI on leave, so no mid-race seat insertion is needed (the Luau
-- twin builds seats up front). Each client gets a view centred on its own seat with
-- the others as ghosts. Host only — no gameplay logic here.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local RS = game:GetService("ReplicatedStorage")

-- Camera-only racer: no avatars. The car is a rendered Part, not a character.
Players.CharacterAutoLoads = false

local Shared = RS:WaitForChild("Shared")
local GameData = RS:WaitForChild("GameData")

local road = require(Shared.road_data)
local carData = require(Shared.car_data)
local trafficData = require(Shared.traffic_data)
local stateMod = require(Shared.state)
local reducer = require(Shared.reducer)
local ai = require(Shared.ai_driver)

local courseSet = road.loadCourseSet(require(GameData.roads))
local carSet = carData.loadCarSet(require(GameData.cars))
local trafficConfig = trafficData.loadTrafficConfig(require(GameData.traffic))
local ctx = { courseSet = courseSet, carSet = carSet, trafficConfig = trafficConfig }

print("[SunsetRunner] server booting — engine + course data loaded")

local COURSE_ID = 4
local START_TIME_TICKS = 3000
local TICK_DT = 1 / 20
local SEATS = 6 -- fixed field size; players fill from seat 1, the rest are AI
local COUNTDOWN_TICKS = 60 -- 3 s
local SUMMARY_TICKS = 100 -- 5 s finish/summary hold
local AI_NAMES = { "Max", "Zoe", "Kai", "Ava", "Leo", "Mia" }
local AI_SKILLS = { "hard", "medium", "hard", "medium", "easy", "medium" }

-- Two channels: intents in, per-seat views out.
local inputEvent = Instance.new("RemoteEvent")
inputEvent.Name = "SunsetInput"
inputEvent.Parent = RS
local viewEvent = Instance.new("RemoteEvent")
viewEvent.Name = "SunsetView"
viewEvent.Parent = RS

local room -- { state, phase, cd, summ, seed }
local seatOfPlayer: { [Player]: number } = {}
local playerOfSeat: { [number]: Player } = {}
local inputBySeat: { [number]: { steer: number, accel: number, brake: number } } = {}
local forkBySeat: { [number]: number } = {}

local function freshRoom(seed: number)
	local seats = {}
	for i = 1, SEATS do
		table.insert(seats, { id = i, carId = (i % 4) + 1 })
	end
	local state = stateMod.createInitialState({
		seed = seed,
		courseSet = courseSet,
		carSet = carSet,
		courseId = COURSE_ID,
		seats = seats,
		startTimeTicks = START_TIME_TICKS,
		trafficConfig = trafficConfig,
	})
	-- Spread seats across lanes so the field races instead of stacking.
	for i = 1, #state.seats do
		state.seats[i].laneX = math.floor((i - (SEATS + 1) / 2) * 180)
	end
	room = { state = state, phase = "countdown", cd = COUNTDOWN_TICKS, summ = 0, seed = seed }
	for i = 1, SEATS do
		inputBySeat[i] = { steer = 0, accel = 0, brake = 0 }
		forkBySeat[i] = 0
	end
end

freshRoom(12345)

-- Stage index per segment (walk the default path from the start) for progress
-- ranking of non-finishers on the end-of-race leaderboard.
local stageIndexOf: { [number]: number } = {}
do
	local id = road.getCourse(courseSet, COURSE_ID).startSegment
	local n, guard = 0, 0
	while id and id ~= -1 and not stageIndexOf[id] and guard < 500 do
		n += 1
		stageIndexOf[id] = n
		id = road.nextSegment(courseSet, id, 0)
		guard += 1
	end
end

local function computeStandings(state)
	local order = {}
	for j = 1, #state.seats do
		table.insert(order, j)
	end
	table.sort(order, function(a, b)
		local sa, sb = state.seats[a], state.seats[b]
		local finA, finB = sa.finishTicks >= 0, sb.finishTicks >= 0
		if finA ~= finB then
			return finA -- finishers rank above non-finishers
		end
		if finA and finB then
			return sa.finishTicks < sb.finishTicks -- earlier finish wins
		end
		local pa = (stageIndexOf[sa.segmentId] or 0) * 1e7 + sa.roadZ
		local pb = (stageIndexOf[sb.segmentId] or 0) * 1e7 + sb.roadZ
		return pa > pb -- more progress wins
	end)
	return order
end

local function resultStr(seat): string
	if seat.finishTicks >= 0 then
		return string.format("%.1fs", seat.finishTicks / 20)
	end
	return "Stage " .. (stageIndexOf[seat.segmentId] or 1)
end

local function nameOfSeat(sid: number): string
	local p = playerOfSeat[sid]
	if p then
		return p.DisplayName
	end
	return AI_NAMES[sid] or ("P" .. sid)
end

-- View centred on the player's seat (or seat 1 as a spectator if the field is full).
local function buildViewFor(player: Player)
	local sid = seatOfPlayer[player] or 1
	local state = room.state
	local s = state.seats[sid]
	local traffic = {}
	for _, t in ipairs(state.traffic) do
		if t.segmentId == s.segmentId and t.roadZ >= s.roadZ then
			table.insert(traffic, { id = t.id, roadZ = t.roadZ, laneX = t.laneX, kind = t.kind })
		end
	end
	local ghosts = {}
	for j = 1, #state.seats do
		local g = state.seats[j]
		if j ~= sid and g.segmentId == s.segmentId then
			table.insert(ghosts, { seatId = j, name = nameOfSeat(j), carId = g.carId, roadZ = g.roadZ, laneX = g.laneX })
		end
	end
	local standings = nil
	if room.phase == "summary" and room.standings then
		standings = {}
		for rank, j in ipairs(room.standings) do
			table.insert(standings, { rank = rank, name = nameOfSeat(j), result = resultStr(state.seats[j]), isSelf = (j == sid) })
		end
	end
	return {
		tick = state.tick,
		phase = room.phase,
		countdown = (room.phase == "countdown") and math.ceil(room.cd / 20) or 0,
		restartIn = (room.phase == "summary") and math.ceil(room.summ / 20) or 0,
		spectating = seatOfPlayer[player] == nil,
		standings = standings,
		ghosts = ghosts,
		seat = {
			segmentId = s.segmentId,
			roadZ = s.roadZ,
			laneX = s.laneX,
			speed = s.speed,
			boostTicks = s.boostTicks,
			timerTicks = s.timerTicks,
			finishTicks = s.finishTicks,
			timedOut = s.timedOut,
			crashedTicks = s.crashedTicks,
			forkChoice = s.forkChoice,
		},
	}
end

local function assignSeat(player: Player)
	for i = 1, SEATS do
		if not playerOfSeat[i] then
			playerOfSeat[i] = player
			seatOfPlayer[player] = i
			print("[SunsetRunner] " .. player.Name .. " took seat " .. i)
			return
		end
	end
	print("[SunsetRunner] field full — " .. player.Name .. " is spectating")
end

inputEvent.OnServerEvent:Connect(function(player, msg)
	local sid = seatOfPlayer[player]
	if not sid or typeof(msg) ~= "table" then
		return
	end
	local steer = math.clamp(tonumber(msg.steer) or 0, -256, 256)
	inputBySeat[sid] = { steer = steer, accel = (msg.accel == 1) and 1 or 0, brake = (msg.brake == 1) and 1 or 0 }
	if msg.fork == -1 or msg.fork == 1 then
		forkBySeat[sid] = msg.fork
	end
end)

Players.PlayerAdded:Connect(assignSeat)
Players.PlayerRemoving:Connect(function(player)
	local sid = seatOfPlayer[player]
	if sid then
		playerOfSeat[sid] = nil -- seat reverts to AI
		seatOfPlayer[player] = nil
	end
end)
for _, p in ipairs(Players:GetPlayers()) do
	assignSeat(p)
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	acc += math.min(dt, 0.25)
	while acc >= TICK_DT do
		acc -= TICK_DT
		if room.phase == "countdown" then
			room.cd -= 1
			if room.cd <= 0 then
				room.phase = "racing"
			end
		elseif room.phase == "summary" then
			room.summ -= 1
			if room.summ <= 0 then
				freshRoom(room.seed + 1)
			end
		else -- racing
			local st = room.state
			local allDone = true
			for _, s in ipairs(st.seats) do
				if s.finishTicks < 0 and s.timedOut == 0 then
					allDone = false
					break
				end
			end
			if allDone then
				room.phase = "summary"
				room.summ = SUMMARY_TICKS
				room.standings = computeStandings(st)
			else
				for i = 1, #st.seats do
					local seat = st.seats[i]
					if seat.finishTicks < 0 and seat.timedOut == 0 then
						local inp
						if playerOfSeat[i] then
							inp = inputBySeat[i]
							if forkBySeat[i] ~= 0 then
								st = reducer.apply(st, { type = "forkChoice", seatId = i, choice = forkBySeat[i] }, ctx)
								forkBySeat[i] = 0
							end
						else
							inp = ai.chooseInput(st, i, ai.skillFor(AI_SKILLS[i]))
						end
						st = reducer.apply(st, { type = "input", seatId = i, steer = inp.steer, accel = inp.accel, brake = inp.brake }, ctx)
					end
				end
				st = reducer.apply(st, { type = "advance_tick" }, ctx)
				room.state = st
			end
		end
	end
	for _, player in ipairs(Players:GetPlayers()) do
		viewEvent:FireClient(player, buildViewFor(player))
	end
end)
